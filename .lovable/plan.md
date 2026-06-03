# Fix stale camera permission state

## Root cause

`BarcodeScanner.tsx` and `PhotoRecognition.tsx` each store a localStorage flag (`camera-denied-once`, `camera-photo-explainer-seen`) the first time the OS denies camera access. On subsequent taps, the code short-circuits to the "Camera is off" re-entry modal based on that flag and the Permissions API result. On iOS WKWebView the Permissions API does not reliably report `camera` (returns `unknown`), so the cached `denied` flag wins — even after the user enables camera in iOS Settings and returns to the app. Nothing currently listens to `appStateChange` to reconcile.

## Fix

Centralize all camera permission logic in a new hook, treat localStorage as a UX hint only, and make the live OS check (Permissions API + actual `getUserMedia` attempt) the source of truth. Reconcile on app resume. Keep the new hook exactly as planned, but make the app-resume listener registration explicitly singleton-safe to avoid duplicate listeners.

### 1. New file: `src/hooks/useCameraPermission.ts`

Single source of truth. Exports:

- `state`: `"granted" | "denied" | "prompt" | "unknown"` (live, refreshed on mount + on `appStateChange` active).
- `refreshPermission()`: re-queries `navigator.permissions.query({ name: "camera" })`; if result is `granted`, clears the stale `camera-denied-once` localStorage flag and emits the new state.
- `requestPermission()`: calls `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`, immediately stops all tracks. Returns `"granted" | "denied" | "unavailable"`. On `granted` it clears the stale flag; on `denied` it sets it. This is the authoritative check on iOS where the Permissions API is unreliable.
- `shouldShowDeniedModal()`: returns `true` only when live state is `denied` (or Permissions API is `unknown` AND localStorage flag is set AND the last `requestPermission()` returned `denied`). Pure `unknown` + stale flag no longer auto-shows the modal — we let the real `getUserMedia` attempt decide.

Lifecycle:

- On mount: call `refreshPermission()`.
- Subscribe to `CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) refreshPermission(); })` (dynamic import of `@capacitor/app`, no-op on web).
- Also listen to `document.visibilitychange` as a web fallback.
- Unsubscribe on unmount.

The hook owns the `camera-denied-once` key; no other file reads/writes it directly.

### 2. `src/components/progress/BarcodeScanner.tsx`

- Remove local `CAMERA_DENIED_KEY`, `queryCameraPermission`, and the `localStorage.getItem(...)` short-circuit in `handleStartTap`.
- Use `useCameraPermission()`.
- New `handleStartTap` flow:
  1. `await refreshPermission()` (forces a fresh OS check).
  2. If state === `"granted"` → go straight to `beginScanning()`.
  3. If state === `"denied"` → show explainer in `"denied"` mode.
  4. Otherwise (`"prompt"` / `"unknown"`) → show explainer in `"purpose"` mode; on Continue call `beginScanning()` which triggers the real prompt via `Html5Qrcode.start` (which calls `getUserMedia` internally). The success path of `beginScanning` already calls back into the hook to clear the stale flag (replace the inline `localStorage.removeItem` with a hook method, e.g. `markGranted()` exposed by the hook, or just call `refreshPermission()` after a successful start).
- On `getUserMedia` failure that looks like a permission denial, call hook's `markDenied()` (replaces the inline `localStorage.setItem`).

### 3. `src/components/progress/PhotoRecognition.tsx`

- Keep `PHOTO_EXPLAINER_SEEN_KEY` (that's a "have we shown the purpose copy once" hint, not a permission flag — fine to leave).
- Add `useCameraPermission()`.
- Before opening the file picker via `fileRef.current?.click()` with `capture="environment"`:
  1. `await refreshPermission()`.
  2. If `denied` → show `CameraPermissionExplainer` in `"denied"` mode (currently this component only uses `"purpose"`; extend the existing mode prop usage — `BarcodeScanner` already passes both modes, so the component supports it).
  3. If `granted` → open picker directly (skip purpose explainer if `PHOTO_EXPLAINER_SEEN_KEY` is set).
  4. Else show purpose explainer; on Continue open picker.
- After picker resolves with a file (success), call `refreshPermission()` to clear any stale flag.

### 4. App-level resume reconciliation (defensive)

The hook handles its own `appStateChange` subscription per consumer. No global listener needed — but to guarantee the flag is cleared even when neither camera component is mounted at resume time, also add a tiny module-scope listener inside `useCameraPermission.ts` (registered once at module load via a singleton guard) that, on `isActive`, runs the Permissions API check and clears `camera-denied-once` if `granted`. This is what guarantees: user denies → backgrounds → toggles Settings → returns → opens Profile → later taps Barcode Scan → no stale modal.

### 5. Files changed

- `src/hooks/useCameraPermission.ts` (new)
- `src/components/progress/BarcodeScanner.tsx` (use hook, remove local key + query fn)
- `src/components/progress/PhotoRecognition.tsx` (use hook, gate picker on live state)

No changes to `CameraPermissionExplainer`, routing, i18n, or other camera-adjacent code.

## Verification

- Deny camera → see "Camera is off" → enable in iOS Settings → return to app → tap Barcode Scan → camera opens directly (no stale modal).
- Same flow for Snap & Log photo picker.
- First-ever tap still shows purpose explainer before the OS prompt (App Review 5.1.1 compliance preserved).
- After a real denial that hasn't been reversed, the neutral re-entry modal still appears with the "Open Settings" CTA.
- Web (Chrome desktop) Permissions API path still works; `appStateChange` import is dynamic so web builds don't break.