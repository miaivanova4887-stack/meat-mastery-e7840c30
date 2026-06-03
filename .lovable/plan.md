## Goal

Implement `webView(_:requestMediaCapturePermissionFor:initiatedByFrame:type:decisionHandler:)` on the iOS host app so any WKWebView-initiated `getUserMedia` / `<input capture>` fallback path is explicitly handled instead of silently auto-denied. This is the belt-and-suspenders fix alongside the existing `@capacitor/camera` native flow.

The handler must be conservative — it grants only when BOTH guardrails pass.

## Guardrails

1. **Trusted first-party origin only.** Build an allowlist of origins the app actually loads:
  - `capacitor://localhost` (Capacitor's native scheme on iOS)
  - `https://app.carnivorex.app` (production custom domain)
  - `https://carnivorex.app`
  - `https://carnivore-coach-pro.lovable.app` (Lovable published URL)
  - `https://id-preview--8cc44691-15e2-40ab-844f-f90c5fa95cc6.lovable.app` (preview, useful for in-app `server.url` hot-reload during dev)
   Any other origin → `.deny`. No wildcard, no header-driven trust.
2. **Native camera auth required.** Even for a trusted origin, check:
  ```
   AVCaptureDevice.authorizationStatus(for: .video)
  ```
  - `.authorized` → `.grant`
  - `.notDetermined` → `.prompt` (lets iOS show the system sheet so `NSCameraUsageDescription` kicks in)
  - `.denied` / `.restricted` → `.deny`
   For `type == .microphone` or `.cameraAndMicrophone`, additionally require `AVCaptureDevice.authorizationStatus(for: .audio) == .authorized` for the audio leg (mirror the same `.notDetermined → .prompt`, `.denied → .deny` mapping).

## Changes

### `ios/App/App/MainViewController.swift`

- Add `import AVFoundation` and `import WebKit`.
- In `capacitorDidLoad()`, after registering the existing plugins, set `bridge?.webView?.uiDelegate = self` (CAPBridgeViewController already conforms to WKUIDelegate via its own extensions for things like file picker, so we layer on top — using `bridge.webView.uiDelegate = self` is the standard Capacitor escape hatch).
- Add an `extension MainViewController: WKUIDelegate` implementing:
  ```swift
  @available(iOS 15.0, *)
  func webView(_ webView: WKWebView,
               requestMediaCapturePermissionFor origin: WKSecurityOrigin,
               initiatedByFrame frame: WKFrameInfo,
               type: WKMediaCaptureType,
               decisionHandler: @escaping (WKPermissionDecision) -> Void)
  ```
- Body:
  1. Reconstruct origin string (`"\(origin.protocol)://\(origin.host)"` plus port when non-default) and check against the hard-coded `Set<String>` allowlist. Miss → `decisionHandler(.deny)`.
  2. Map `AVCaptureDevice.authorizationStatus` to a `WKPermissionDecision` per the table above. For `.cameraAndMicrophone`, take the **most restrictive** of the two legs (`deny` > `prompt` > `grant`).
  3. Call `decisionHandler(...)` exactly once on the main queue.

### Out of scope

- No changes to `Info.plist` (already has `NSCameraUsageDescription` and `NSPhotoLibraryAddUsageDescription` from prior work).
- No changes to the JS/TS camera flow — `PhotoRecognition.tsx` and `useCameraPermission` stay as-is.
- No new plugin, no Capacitor config change, no entitlement change.

## Verification

After `npx cap sync ios` and a fresh build:

1. In Xcode, set a breakpoint inside `requestMediaCapturePermissionFor` and confirm it fires when the WKWebView fallback path runs (e.g. force the web `getUserMedia` probe in `useCameraPermission.requestPermission`).
2. Confirm:
  - With iOS camera permission **granted** + trusted origin → `.grant`, camera stream opens.
  - With iOS camera permission **denied** in Settings → `.deny`, no stream, app surfaces the existing "Camera is off" recovery modal.
  - With camera permission **not yet determined** → `.prompt`, iOS system sheet appears with our usage string.
  - With a forged/foreign origin (manually navigate to e.g. `https://example.com` in dev) → `.deny`.
3. Sanity-check the `@capacitor/camera` native Snap & Log path still works end-to-end (it does not go through this delegate, so it should be unchanged).
4. if the handler covers `.microphone` or `.cameraAndMicrophone`, verify `NSMicrophoneUsageDescription` exists in `Info.plist`; otherwise either add it or scope the handler to camera-only behavior.