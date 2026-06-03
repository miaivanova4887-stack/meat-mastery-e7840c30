//
//  MainViewController.swift
//  CarnivoreX
//
//  Custom Capacitor bridge view controller that registers app-local
//  plugins (plugins living in the app target, not an SPM package) and
//  hosts a hardened WKUIDelegate that explicitly handles WKWebView
//  media-capture permission prompts.
//
//  Without this delegate, iOS's default behavior is to silently
//  auto-deny `getUserMedia` requests from a WKWebView, even when
//  `NSCameraUsageDescription` is set and the user has granted camera
//  permission in Settings. The primary Snap & Log flow uses
//  `@capacitor/camera` (native), but this is the belt-and-suspenders
//  fix for any WKWebView fallback path.
//

import UIKit
import WebKit
import AVFoundation
import Capacitor

/// First-party origins the host app actually loads. Any other origin
/// requesting camera/microphone is denied — no wildcard, no
/// header-driven trust.
private let TRUSTED_MEDIA_ORIGINS: Set<String> = [
    "capacitor://localhost",
    "https://app.carnivorex.app",
    "https://carnivorex.app",
    "https://carnivore-coach-pro.lovable.app",
    "https://id-preview--8cc44691-15e2-40ab-844f-f90c5fa95cc6.lovable.app",
]

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthConnectPlugin())
        bridge?.registerPluginInstance(AudioSessionPlugin())

        // Layer our WKUIDelegate on top of Capacitor's. Capacitor
        // doesn't implement requestMediaCapturePermissionFor itself,
        // so taking over the delegate slot is the supported escape
        // hatch for this hook.
        bridge?.webView?.uiDelegate = self
    }
}

// MARK: - WKUIDelegate media capture

extension MainViewController: WKUIDelegate {

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView,
                 requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {

        let decide: (WKPermissionDecision) -> Void = { decision in
            if Thread.isMainThread {
                decisionHandler(decision)
            } else {
                DispatchQueue.main.async { decisionHandler(decision) }
            }
        }

        // Guardrail 1: trusted first-party origin only.
        let originString = Self.originString(from: origin)
        guard TRUSTED_MEDIA_ORIGINS.contains(originString) else {
            decide(.deny)
            return
        }

        // Guardrail 2: only grant when the corresponding native
        // permission(s) have already been authorized by the user.
        let decision: WKPermissionDecision
        switch type {
        case .camera:
            decision = Self.decision(for: .video)
        case .microphone:
            decision = Self.decision(for: .audio)
        case .cameraAndMicrophone:
            decision = Self.mostRestrictive(
                Self.decision(for: .video),
                Self.decision(for: .audio)
            )
        @unknown default:
            decision = .deny
        }

        decide(decision)
    }

    private static func originString(from origin: WKSecurityOrigin) -> String {
        let proto = origin.`protocol`
        let host = origin.host
        let port = origin.port
        let isDefaultPort = (proto == "https" && port == 443)
            || (proto == "http" && port == 80)
            || port == 0
        if isDefaultPort {
            return "\(proto)://\(host)"
        }
        return "\(proto)://\(host):\(port)"
    }

    private static func decision(for media: AVMediaType) -> WKPermissionDecision {
        switch AVCaptureDevice.authorizationStatus(for: media) {
        case .authorized:    return .grant
        case .notDetermined: return .prompt
        case .denied, .restricted: return .deny
        @unknown default:    return .deny
        }
    }

    /// `.deny` beats `.prompt` beats `.grant`.
    private static func mostRestrictive(_ a: WKPermissionDecision,
                                        _ b: WKPermissionDecision) -> WKPermissionDecision {
        if a == .deny || b == .deny { return .deny }
        if a == .prompt || b == .prompt { return .prompt }
        return .grant
    }
}
