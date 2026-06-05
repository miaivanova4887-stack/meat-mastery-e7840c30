# iOS Push Notifications — Capability Verification

If CarnivoreX does **not** appear in iOS Settings → Notifications after launching
the app and tapping "Enable notifications", the most common cause is that the
Xcode project is missing the **Push Notifications** capability, even though
`App.entitlements` already contains `aps-environment = development`.

The entitlement key alone is not sufficient — Xcode needs the capability
checkbox in order for APNs to register the bundle ID with Apple's push
service. Without that, the OS never adds the app to Settings → Notifications.

## One-time setup (copy-paste these steps)

1. Open the workspace in Xcode:

       open ios/App/App.xcworkspace

2. In the left sidebar, click the blue **App** project icon.
3. In the editor area, click the **App** target (under TARGETS).
4. Click the **Signing & Capabilities** tab.
5. Click the **+ Capability** button (top-left of the editor area).
6. Add **Push Notifications**. Confirm a "Push Notifications" row now appears
   under Signing & Capabilities.
7. Add **Background Modes**. Under the new "Background Modes" row, check
   **Remote notifications**.
8. Close Xcode.

## Verify from the terminal

Run these exact commands from the repo root:

    grep -A1 'aps-environment' ios/App/App/App.entitlements
    grep -A2 'UIBackgroundModes' ios/App/App/Info.plist

You should see:

- `<string>development</string>` under `aps-environment` (Xcode flips this
  to `production` automatically on Release archives).
- `<string>remote-notification</string>` under `UIBackgroundModes`.

## Clean rebuild after adding the capability

    cd ios/App
    rm -rf build DerivedData
    cd ../..
    npx cap sync ios
    open ios/App/App.xcworkspace

Then in Xcode: **Product → Clean Build Folder** (Shift+Cmd+K), then **Run**.

## What we do NOT do (confirmed)

We never call `UIApplication.unregisterForRemoteNotifications` anywhere in the
codebase, so once the OS records the app under Settings → Notifications it
stays there until the app is uninstalled.

## Diagnostic logs to look for

Filter the Xcode console for `[Push]` and `[PushTap]`. The expected sequence
on the first launch after granting permission is:

    [Push] FirebaseApp.configure done
    [Push] requestPermissions called platform=ios
    [Push] requestPermissions result receive=granted
    [Push] register called platform=ios receive=granted
    [Push] iOS APNs token registered len=64
    [Push] FCM token registered len=...

If you see `requestPermissions result receive=denied` without ever seeing the
APNs token line, the OS prompt was either auto-denied (user previously chose
"Don't allow") or the capability is missing. The watchdog will also print:

    [Push] WATCHDOG no APNs token after register() within 4000ms — capability likely missing

In that case follow the capability steps above.
