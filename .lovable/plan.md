# Trigger native push prompt from Profile toggle

## Problem
In Profile → Alerts, the **Enable Notifications** switch currently only checks the OS permission and, if not `granted`, jumps straight to system Settings. On a fresh install where iOS has never been asked, the user never sees the native `"CarnivoreX" Would Like to Send You Notifications` system dialog (the one in the screenshot). It should fire that prompt first; only fall back to Settings if the OS has already permanently denied.

## Change (single file)

**`src/pages/Profile.tsx`** — the `<Switch onCheckedChange>` at lines ~1060-1081 for **Enable Notifications**.

New off→on flow:

1. `updateNotifPref("enabled", true)` (unchanged).
2. If not native → return.
3. Read `getNativePushPermission()`.
   - `"granted"` → done, optionally `toast.success("Notifications enabled")`.
   - `"prompt"` or `"prompt-with-rationale"` → call `requestNativePush()` from `@/lib/pushFcm`. This triggers the native iOS/Android system dialog shown in the screenshot. After it resolves:
     - `"granted"` → `toast.success("Notifications enabled")`, persist `savePushConsent("granted", …)` for parity with the consent sheet path.
     - otherwise → revert the toggle (`updateNotifPref("enabled", false)`) and `toast.info("Notifications were not enabled.")`.
   - `"denied"` (already permanently denied by the OS — system prompt will not reappear) → keep current behavior: `toast.info("Opening system notification settings…")` then `openAppSettings()`, and revert the toggle so it doesn't show as enabled while the OS says no.
4. Wrap in try/catch with `[NotifSettings] toggle-enable` trace logs (perm before, action taken, perm after) for evidence in Xcode console.

No changes to the toggle-off branch, the CTA button below, the consent sheet, or any other notification card.

## Verification
- Fresh install, tap toggle on → native iOS dialog appears (matches screenshot). Allow → toast "Notifications enabled", toggle stays on. Don't Allow → toggle reverts.
- Reopen, OS perm already `granted` → toast confirms, no dialog, no Settings jump.
- OS perm already `denied` → Settings opens, toggle reverts.
- Xcode console shows `[NotifSettings] toggle-enable perm-before=… action=… perm-after=…`.
