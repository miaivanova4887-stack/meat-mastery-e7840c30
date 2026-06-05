// Firebase / FCM bridge for CarnivoreX.
//
// Firebase modules (FirebaseCore, FirebaseMessaging) are linked into the
// CapApp-SPM Swift package, not into the App target directly. We expose a
// thin helper (`CarnivoreXPush`) that the App target's AppDelegate calls
// into. This avoids hand-editing project.pbxproj (which `npx cap sync ios`
// would clobber) while still letting AppDelegate stay minimal.
//
// AppDelegate responsibilities preserved:
//   • Configure FirebaseApp on launch.
//   • Forward APNs device token to FCM (FirebaseAppDelegateProxyEnabled is NO).
//   • Repost the NSNotifications that Capacitor's PushNotifications plugin
//     observes so its JS `registration` / `registrationError` events still fire.
//   • Dispatch a `fcm-token` window CustomEvent to JS so src/lib/pushFcm.ts
//     can persist the token in device_tokens.

import Foundation
import UIKit
import WebKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

public final class CarnivoreXPush: NSObject, MessagingDelegate {
    public static let shared = CarnivoreXPush()

    private var configured = false

    private override init() { super.init() }

    /// Call from `application(_:didFinishLaunchingWithOptions:)`.
    public func configure() {
        if configured {
            NSLog("[Push] CarnivoreXPush.configure skipped — already configured")
            return
        }
        configured = true
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        NSLog("[Push] FirebaseApp.configure done")
    }

    /// Call from `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`.
    public func handleAPNsToken(_ deviceToken: Data) {
        NSLog("[Push] iOS APNs token registered len=%d", deviceToken.count)
        Messaging.messaging().apnsToken = deviceToken
        // Capacitor's PushNotifications plugin observes this NSNotification
        // and emits its JS `registration` event with the APNs token.
        NotificationCenter.default.post(
            name: Notification.Name(rawValue: "Capacitor.didRegisterForRemoteNotificationsWithDeviceToken"),
            object: deviceToken
        )
    }

    /// Call from `application(_:didFailToRegisterForRemoteNotificationsWithError:)`.
    public func handleAPNsError(_ error: Error) {
        NSLog("[Push] iOS registrationError: %@", error.localizedDescription)
        NotificationCenter.default.post(
            name: Notification.Name(rawValue: "Capacitor.didFailToRegisterForRemoteNotificationsWithError"),
            object: error
        )
    }

    // MARK: - MessagingDelegate

    public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else {
            NSLog("[Push] FCM token nil")
            return
        }
        NSLog("[Push] FCM token registered len=%d", token.count)
        DispatchQueue.main.async {
            let escaped = token
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            let js = "window.dispatchEvent(new CustomEvent('fcm-token', { detail: { token: '\(escaped)', platform: 'ios' } }));"

            guard let webView = Self.findBridgeWebView() else {
                NSLog("[Push] FCM token received but no CAPBridgeViewController webview found — JS dispatch skipped")
                return
            }
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // MARK: - Helpers

    /// Locate the active Capacitor bridge's webview by walking connected
    /// UIScenes. Works regardless of whether AppDelegate retains `window`.
    private static func findBridgeWebView() -> WKWebView? {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows {
                if let bridgeVC = window.rootViewController as? CAPBridgeViewController,
                   let webView = bridgeVC.bridge?.webView {
                    return webView
                }
                // Fallback: scan presented / child controllers.
                if let found = scanController(window.rootViewController) {
                    return found
                }
            }
        }
        return nil
    }

    private static func scanController(_ vc: UIViewController?) -> WKWebView? {
        guard let vc = vc else { return nil }
        if let bridgeVC = vc as? CAPBridgeViewController,
           let webView = bridgeVC.bridge?.webView {
            return webView
        }
        if let presented = vc.presentedViewController,
           let found = scanController(presented) {
            return found
        }
        for child in vc.children {
            if let found = scanController(child) {
                return found
            }
        }
        return nil
    }
}

// Needed for the WKWebView return type above.
