//
//  AudioSessionPlugin.swift
//  CarnivoreX
//
//  Custom Capacitor plugin that exposes AVAudioSession + microphone
//  permission helpers and a non-backed-up install marker to JS.
//
//  Why this exists:
//  1. The capacitor-community/speech-recognition plugin only requests
//     SFSpeechRecognizer authorization on iOS — NOT the microphone
//     permission. Without an explicit mic prompt, CarnivoreX never
//     appears in Settings -> Privacy & Security -> Microphone and the
//     recognizer fails silently on the 1st use. We expose
//     `requestMicrophonePermission` / `checkMicrophonePermission` so JS
//     can force the OS dialog before starting recognition.
//  2. AVAudioEngine + SFSpeechRecognizer per-session occasionally fails
//     to fully release between rapid sessions. `resetAudioSession`
//     deactivates + reactivates the shared audio session to recover.
//  3. iOS WKWebView localStorage is backed up to iCloud, which means
//     onboarding flags can survive a "fresh" install on a restored
//     device. `readInstallMarker` / `writeInstallMarker` store a tiny
//     file in NSCachesDirectory (which iOS NEVER backs up) so JS can
//     detect a genuinely fresh install and clear stale flags.
//
//  Exposed methods:
//    AudioSession.resetAudioSession({ delayMs?: number })
//    AudioSession.deactivate()
//    AudioSession.requestMicrophonePermission()
//      -> { status: "granted" | "denied" | "undetermined" }
//    AudioSession.checkMicrophonePermission()
//      -> { status: "granted" | "denied" | "undetermined" }
//    AudioSession.readInstallMarker()
//      -> { present: boolean, value?: string }
//    AudioSession.writeInstallMarker({ value: string })
//      -> { ok: true }
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
        CAPPluginMethod(name: "deactivate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestMicrophonePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkMicrophonePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readInstallMarker", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeInstallMarker", returnType: CAPPluginReturnPromise)
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

    // MARK: - Microphone permission

    private func recordPermissionString() -> String {
        let perm = AVAudioSession.sharedInstance().recordPermission
        switch perm {
        case .granted: return "granted"
        case .denied: return "denied"
        case .undetermined: return "undetermined"
        @unknown default: return "undetermined"
        }
    }

    @objc func checkMicrophonePermission(_ call: CAPPluginCall) {
        call.resolve(["status": recordPermissionString()])
    }

    /// Forces the iOS microphone permission dialog. After the user
    /// responds (or if a previous response was remembered) iOS adds
    /// CarnivoreX to Settings -> Privacy & Security -> Microphone.
    @objc func requestMicrophonePermission(_ call: CAPPluginCall) {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            call.resolve(["status": granted ? "granted" : "denied"])
        }
    }

    // MARK: - Install marker (non-backed-up)

    private func markerURL() -> URL? {
        let fm = FileManager.default
        guard let cache = fm.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        return cache.appendingPathComponent("carnivorex-install-marker")
    }

    @objc func readInstallMarker(_ call: CAPPluginCall) {
        guard let url = markerURL(), FileManager.default.fileExists(atPath: url.path) else {
            call.resolve(["present": false])
            return
        }
        let value = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
        call.resolve(["present": true, "value": value])
    }

    @objc func writeInstallMarker(_ call: CAPPluginCall) {
        guard let url = markerURL() else {
            call.reject("Cache directory unavailable")
            return
        }
        let value = call.getString("value") ?? ""
        do {
            try value.write(to: url, atomically: true, encoding: .utf8)
            call.resolve(["ok": true])
        } catch {
            call.reject("Failed to write install marker: \(error.localizedDescription)")
        }
    }
}
