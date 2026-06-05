import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase + FCM. FirebaseAppDelegateProxyEnabled is NO (see Info.plist)
        // so we forward the APNs token to FCM manually below.
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        return true
    }

    // Capacitor's PushNotifications plugin observes this NSNotification name to
    // emit its JS `registration` event with the APNs token. We preserve that
    // behavior AND hand the raw APNs token to Firebase so it can mint an FCM
    // registration token (delivered via MessagingDelegate below).
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NSLog("[Push] iOS APNs token registered len=%d", deviceToken.count)
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(
            name: Notification.Name(rawValue: "Capacitor.didRegisterForRemoteNotificationsWithDeviceToken"),
            object: deviceToken
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NSLog("[Push] iOS registrationError: %@", error.localizedDescription)
        NotificationCenter.default.post(
            name: Notification.Name(rawValue: "Capacitor.didFailToRegisterForRemoteNotificationsWithError"),
            object: error
        )
    }

    // FCM token arrives here (and on every rotation). Forward to JS via a
    // window event so src/lib/pushFcm.ts can persist it in device_tokens.
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else {
            NSLog("[Push] FCM token nil")
            return
        }
        NSLog("[Push] FCM token registered len=%d", token.count)
        DispatchQueue.main.async {
            let escaped = token.replacingOccurrences(of: "\\", with: "\\\\")
                                .replacingOccurrences(of: "'", with: "\\'")
            let js = "window.dispatchEvent(new CustomEvent('fcm-token', { detail: { token: '\(escaped)', platform: 'ios' } }));"
            if let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController,
               let webView = bridgeVC.bridge?.webView {
                webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
