## Plan

Implement a real permission-state fix for Snap & Log by making the same authoritative `getUserMedia` probe used by Barcode Scan gate the photo picker, and by resetting the hidden file input so repeated taps cannot silently no-op.

### 1. Update `PhotoRecognition.tsx`

- Use `requestPermission()` from `useCameraPermission()` before opening the `capture="environment"` file picker.
- Keep `refreshPermission()` only as a lightweight state sync after picker/file events, not as the source of truth before opening camera.
- On first-use purpose modal Continue:
  - mark the explainer as seen,
  - run `requestPermission()`,
  - only open the picker if the probe returns `granted`,
  - if denied, close cleanly and keep the denied state for the next tap.
- On normal Snap & Log tap:
  - if live state is `denied`, show the existing “Camera is off” settings modal,
  - otherwise run `requestPermission()` before opening the picker,
  - if granted, open the picker,
  - if denied, show the denied modal on the next interaction instead of opening a dead/dark picker.
- When `requestPermission()` returns `denied` on the purpose-modal Continue path, show the denied modal **immediately**, not merely “on the next tap.”

### 2. Reset the hidden file input reliably

- Add a small helper around `fileRef.current` that clears `fileRef.current.value = ""` before each picker click.
- Keep clearing the value after `onChange`, including when a file is selected.
- Add cancel/fallback cleanup where supported so canceling the picker does not leave the input in a stale state.

### 3. Keep Barcode Scan behavior stable

- Do not change the working Barcode Scan scanner flow except if a tiny shared helper adjustment is required.
- Preserve the first-use explainer and Settings-only CTA rules.

### 4. Inspect other `capture="environment"` camera picker entries

- Review the Meal Plan Snap photo inputs already found in `MealPlan.tsx`.
- Apply the same reset-before-open / reset-after-change protection there if those inputs can no-op after cancel or repeated selection.
- If Meal Plan needs permission gating too, wire it through the same hook without expanding the UI beyond the current camera behavior.

### 5. Verification

- Deny iOS camera prompt from Snap & Log: no dark/dead camera picker should remain.
- Tap Snap & Log again after denial: the app should respond by showing the “Camera is off” modal, not silently doing nothing.
- Enable camera in iOS Settings and return: Snap & Log should run the live permission probe, clear stale denial, and open the picker.
- Repeated picker cancel/success attempts should continue responding because the input value is reset every time.