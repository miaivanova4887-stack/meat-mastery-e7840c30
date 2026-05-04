## Diagnosis

The reason all three fixes "don't appear in the new APK" is most likely a **single root cause**: the build script aborts before producing an APK, so the device keeps running the previous install.

### Issue 1 — Build stamp still visible
`src/components/BuildStamp.tsx` is no longer imported by `App.tsx` (verified). However, `scripts/build-android-fresh.sh` still requires the string `"build-version"` to be present in the synced JS bundle (REQUIRED_MARKERS, line 70). That string only exists inside `BuildStamp.tsx` as `aria-label="build-version"`. Since the component is now unreferenced, Vite tree-shakes it out → marker missing → script aborts with "Synced bundle is MISSING required marker: build-version" → no new APK is installed → user sees the old build (with the stamp).

### Issue 2 — Phone still rotates
Same root cause — the new `MainActivity.java` portrait code never reaches the device because the build aborts. Code itself is correct but defensive hardening is warranted (see plan).

### Issue 3 — Notification prompt still crashes / shows for opted-in users
Two contributing problems even after the build is unblocked:
- `usePushConsentFallback` short-circuits on `osPerm === "granted"`, but `PushNotifications.checkPermissions()` can return `"prompt"` on some Android 14 OEM builds even when notifications are enabled at OS level. We need a secondary signal (local mirror + profile consent) checked **before** the OS call.
- `requestNativePush()` calls `PushNotifications.register()` even on the granted-skip path. On a stale Firebase init this can throw and surface as a WebView crash. Need to gate `register()` behind `bindListenersOnce` having actually bound, and never let a thrown register error reach React.

---

## Plan

### A. Unblock the build (root cause for all three)

1. Delete `src/components/BuildStamp.tsx` (dead code).
2. In `scripts/build-android-fresh.sh`, remove `"build-version"` from `REQUIRED_MARKERS` (keep `"BuildInfo"` — it lives in `main.tsx` as a console-only log, not visible UI).
3. Confirm no other file imports `BuildStamp` (already verified: zero references).

### B. Portrait lock — defense in depth

`MainActivity.java`:
- Move `setRequestedOrientation` to **after** `super.onCreate(...)` (BridgeActivity initializes the window in super; some OEMs ignore orientation set before super).
- Add `android.util.Log.i("CarnivoreXOrientation", "isTablet=" + isTablet + " applied=" + (!isTablet))` so we can verify on device with `adb logcat | grep CarnivoreXOrientation`.
- Use `SCREEN_ORIENTATION_PORTRAIT` (hard portrait) instead of `USER_PORTRAIT` to guarantee no landscape on phones (USER_PORTRAIT honours user-set system rotation overrides on some Samsung builds).

### C. Notification prompt — never re-prompt, never crash

`src/hooks/usePushConsentFallback.ts`:
- Reorder checks. New order: (1) sessionStorage already-shown, (2) **local mirror consent !== "unset" → skip**, (3) for logged-in users, **profile.push_consent in {granted,denied} → skip** (read this BEFORE the OS check), (4) OS perm check → if granted, reconcile to local + profile and skip, (5) only then open the sheet.
- Add explicit log lines at every decision branch labelled `[PushDecision]` so they are greppable.
- Wrap the entire async timer body in try/catch so any throw is swallowed (cannot crash React).

`src/lib/pushFcm.ts`:
- In `requestNativePush()`, only call `PushNotifications.register()` after `bindListenersOnce` actually bound (it already does — but add an inner try/catch around `register()` on every code path, including the granted-skip branch, so a Firebase init failure cannot propagate).
- Add `[PushDecision]` log before each `register()` and `requestPermissions()` call.

`src/components/NotificationConsentSheet.tsx`:
- On `handleEnable`, before doing anything, re-check `getNativePushPermission()`. If already granted, save consent, close sheet, return — never call `requestNativePush()` again.

### D. Adb log filters for on-device verification

After installing the new APK, the user can verify with:

```text
adb logcat -c
adb logcat -v time | grep -E 'CarnivoreXOrientation|PushDecision|BuildInfo'
```

Expected on phone launch:
- `CarnivoreXOrientation: isTablet=false applied=true`
- `[BuildInfo] fingerprint=build-<recent-ts> ...`
- For an opted-in user: `[PushDecision] skip reason=profile-consent-granted` (or similar) and **no** sheet open log.

---

## Files to modify

1. `scripts/build-android-fresh.sh` — drop `"build-version"` marker
2. `src/components/BuildStamp.tsx` — delete file
3. `android/app/src/main/java/com/mi4labs/carnivorex/MainActivity.java` — order + Log + hard portrait
4. `src/hooks/usePushConsentFallback.ts` — reorder checks, add `[PushDecision]` logs, outer try/catch
5. `src/lib/pushFcm.ts` — defensive try/catch around every `register()`, add `[PushDecision]` logs
6. `src/components/NotificationConsentSheet.tsx` — re-check OS perm in `handleEnable`

No DB/edge function changes needed.