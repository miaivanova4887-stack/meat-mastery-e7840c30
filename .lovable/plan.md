## Plan

Fix the Snap & Log dead-camera state that persists after the user enables camera access in iOS Settings. The permission probe is correct, but the reused hidden `<input type="file" capture="environment">` node is the blocker inside WKWebView.

### 1. Stop reusing the hidden file input in `PhotoRecognition.tsx`

- Remove the persistent `<input ref={fileRef} … />` from JSX.
- Replace `openPicker()` with a helper that on each invocation:
  - Creates a brand-new `HTMLInputElement` via `document.createElement("input")`.
  - Sets `type="file"`, `accept="image/*"`, `capture="environment"`.
  - Attaches a fresh `onchange` listener that calls `handlePhoto(file)` and then removes the node from the DOM.
  - Appends the node to `document.body` (off-screen / `display:none`), calls `.click()`, and schedules cleanup on `onchange`, on window `focus` (cancel detection), and on unmount.
- Track the active node in a `useRef<HTMLInputElement | null>` purely so unmount cleanup can remove a dangling node.

### 2. Gate the picker on the authoritative probe

- Keep `handleSnapTap` flow: `refreshPermission()` → if `denied`, show denied modal; first-tap purpose explainer when not yet seen; otherwise `await requestPermission()`.
- Only call the new "create + click" helper when `requestPermission()` returns `granted`.
- On `denied`, show the "Camera is off" settings modal immediately.
- On `unavailable`, still create a fresh input (no `capture`) so library fallback works on desktop.

### 3. Purpose-explainer Continue path

- Same change: after marking the explainer seen and getting `granted` from `requestPermission()`, call the create-fresh-input helper instead of `openPicker()` on a reused ref.

### 4. Native camera fallback (only if step 1 still fails on device)

- If the fresh-node approach still does not launch the camera after a Settings round-trip, switch Snap & Log off the file-input path entirely:
  - Add `@capacitor/camera` and use `Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Base64, quality: 80 })` when running on a native platform (`Capacitor.isNativePlatform()`).
  - Keep the fresh-input path only as the web fallback.
  - Reuse the same `useCameraPermission` gating; on `NotAllowed`/`UserCancelled` errors, surface the existing denied modal.
- Barcode Scan already proves OS permission state is correctly readable, so this fallback is the safety net, not the default.

Approve the plan **only with this modification**:

- make step 4 the default path for native platforms now, not only “if step 1 still fails on device”;
- keep the fresh-input approach as the web fallback.

That means:

- `Capacitor.isNativePlatform()` → use `@capacitor/camera`,
- browser/web → use fresh file input fallback.

### 5. Keep Barcode Scan untouched

- No changes to `BarcodeScanner.tsx` or `useCameraPermission.ts` behavior. The hook already reconciles on resume.

### 6. Verification

- Cold install, deny camera, enable in iOS Settings, return to app → tap Snap & Log → camera opens on the first tap.
- Repeated taps (cancel, retake, success) each open a fresh picker; no silent no-op.
- Denied state still shows the "Camera is off" modal with Open Settings.
- Barcode Scan flow unchanged.
- Desktop/web build still opens a library picker (no `capture` on fallback).

### Files touched

- `src/components/progress/PhotoRecognition.tsx` — remove persistent hidden input, add `createCameraInput()` helper, wire `handleSnapTap` and explainer Continue to it, add unmount cleanup.
- (Conditional, only if fresh-input fix is insufficient on device) `package.json` + `PhotoRecognition.tsx` — add `@capacitor/camera` and branch on `Capacitor.isNativePlatform()`.