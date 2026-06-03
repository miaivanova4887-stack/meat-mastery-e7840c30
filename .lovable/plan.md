# Stop the barcode reader from re-prompting after Snap & Log was granted

## Root cause

Snap & Log uses `@capacitor/camera` (`Camera.getPhoto`), which triggers the **native** iOS camera permission. After the user accepts, `AVCaptureDevice.authorizationStatus(for: .video) == .authorized` and the new `WKUIDelegate` in `MainViewController.swift` will auto-grant any WKWebView `getUserMedia` from a trusted origin — no second OS prompt.

But the barcode reader never reaches `getUserMedia`. 

Furthermore barcode in-app camera access triggers every time after app was killed

Before opening the scanner, `BarcodeScanner.handleStartTap` calls `useCameraPermission.refreshPermission()`, which only knows one API:

```ts
const res = await perms.query({ name: "camera" });
```

On iOS WKWebView the Permissions API is unreliable for `camera` — it returns `"prompt"` (or `"unknown"`) even after the native permission was granted, because WKWebView's permission scope is separate from `AVCaptureDevice`'s. So `refreshPermission()` returns `"prompt"`, the code falls into the `prompt / unknown` branch, and our own `CameraPermissionExplainer` modal opens in `purpose` mode. That is the "permission" the user sees the second time.

(The same hook is why `PhotoRecognition.handleSnapTap` also drops into the explainer on the first tap — but there it's intentional because of `PHOTO_EXPLAINER_SEEN_KEY`. The barcode flow has no such "seen" flag, so the modal appears on every tap until WKWebView's `getUserMedia` is actually invoked once.)

## Fix

Make `useCameraPermission` consult the **native** `@capacitor/camera` permission status on Capacitor platforms, and broadcast grants so sibling components refresh.

### 1. `src/hooks/useCameraPermission.ts`

Extend `queryPermissionsApi` to prefer the native plugin when running under Capacitor:

- On `Capacitor.isNativePlatform()`, dynamically `import("@capacitor/camera")` and call `Camera.checkPermissions()`.
  - Map `camera`:
    - `"granted"` → `"granted"`
    - `"denied"` → `"denied"`
    - `"prompt"` / `"prompt-with-rationale"` → `"prompt"`
    - anything else → `"unknown"`
  - On any error (plugin missing on web build, etc.) fall through to the existing `navigator.permissions.query` path.
- On non-native (web/PWA), keep the existing Permissions-API path unchanged.

Also have the existing `installResumeListener` reconcile via the same path so an iOS Settings round-trip still clears `camera-denied-once`.

### 2. `src/components/progress/PhotoRecognition.tsx`

After a successful `Camera.getPhoto(...)` in `openNativeCamera`, call `markGranted()` (already imported via the hook — add it to the destructure). This:

- Clears the stale `camera-denied-once` flag immediately.
- Dispatches `camera-permission-changed` so the BarcodeScanner's hook instance refreshes without waiting for app resume.

No behavior change for the web file-picker path.

after successful `Camera.getPhoto(...)`, call `markGranted()` and then `refreshPermission()` so all hook consumers immediately converge on the native permission state

### 3. No changes required

- `MainViewController.swift` — the WKUIDelegate already handles the WKWebView side correctly; we just have to stop blocking on our own explainer before we ever hand off to it.
- `BarcodeScanner.tsx` — its logic is already correct (`granted` → `beginScanning`, `denied` → denied modal, otherwise purpose modal). Once `refreshPermission()` returns `"granted"` on iOS, the modal is skipped and `html5-qrcode` calls `getUserMedia`, which the new `WKUIDelegate` auto-grants silently.
- `CameraPermissionExplainer.tsx` — unchanged.

## Verification (line-by-line, fresh build)

```bash
cd ~/path/to/carnivore-coach-pro
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:

```text
Product → Clean Build Folder
Product → Run (physical iPhone)
```

On the device:

1. **Reset state** — Settings → CarnivoreX → toggle Camera **off** then **on** (or delete the app and reinstall) so AVCaptureDevice goes back to `.notDetermined`.
2. **First Snap & Log tap** → in-app explainer (`purpose`) appears once → Continue → iOS system camera sheet appears → tap **Allow** → camera UI opens.
3. **Tap Scan Barcode** → expected: scanner opens directly into the live camera viewfinder. **No** in-app explainer, **no** second iOS sheet, **no** WKWebView prompt.
4. **Background the app**, change camera to Deny in Settings, return to app → tap Scan Barcode → "Camera is off" denied modal appears (existing behavior preserved).
5. **Cold-start** the app with camera already authorized → tap Scan Barcode first (skipping Snap & Log) → scanner opens directly, no explainer.

## Out of scope

- No changes to Stripe / push-subscription / WKUIDelegate code from earlier turns.
- No Android changes — Android uses a different permission pipeline already handled by Capacitor.