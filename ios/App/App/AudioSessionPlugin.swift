//
//  AudioSessionPlugin.swift
//  CarnivoreX
//
//  Custom Capacitor plugin that exposes AVAudioSession reset helpers to JS.
//
//  Why this exists:
//  The capacitor-community/speech-recognition plugin starts an
//  AVAudioEngine + SFSpeechRecognizer per session. On rapid successive
//  `start` calls the previous audio session isn't fully torn down, which
//  leaves SFSpeechRecognizer in a state where it opens the mic (iOS
//  orange dot) but emits no partial results and eventually rejects with
//  "no-speech". Calling `resetAudioSession` between sessions forces a
//  deactivate + reactivate of the shared audio session, which reliably
//  unblocks the 2nd+ speech session on iPhone 17 Pro (and older).
//
//  Exposed methods:
//    AudioSession.resetAudioSession({ delayMs?: number })
//    AudioSession.deactivate()
//
//  Both resolve with { ok: true } on success; errors are rejected with
//  the underlying OSStatus code.
//

import Foundation
import Capacitor
import AVFoundation

@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "resetAudioSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise)
    ]

    /// Deactivate + reactivate the shared audio session. Optionally sleeps
    /// `delayMs` between deactivate and reactivate to give CoreAudio time
    /// to fully release resources (default 200ms). Notifies other apps of
    /// the deactivation so playback apps can resume cleanly.
    @objc func resetAudioSession(_ call: CAPPluginCall) {
        let delayMs = call.getInt("delayMs") ?? 200
        DispatchQueue.global(qos: .userInitiated).async {
            let session = AVAudioSession.sharedInstance()
            do {
                try session.setActive(false, options: [.notifyOthersOnDeactivation])
            } catch {
                // Non-fatal: recognizer may already be inactive. Continue.
                NSLog("AudioSessionPlugin: deactivate on reset failed: \(error)")
            }
            if delayMs > 0 {
                Thread.sleep(forTimeInterval: Double(delayMs) / 1000.0)
            }
            do {
                // Record category matches what SFSpeechRecognizer expects;
                // .measurement mode reduces DSP latency which helps short
                // utterances.
                try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
                try session.setActive(true, options: [])
                call.resolve(["ok": true])
            } catch {
                call.reject("Failed to reactivate audio session: \(error.localizedDescription)")
            }
        }
    }

    /// Just deactivate without reactivating. Useful when the app is going
    /// to the background or the user cancels mid-session.
    @objc func deactivate(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
                call.resolve(["ok": true])
            } catch {
                call.reject("Failed to deactivate audio session: \(error.localizedDescription)")
            }
        }
    }
}
