# Refactor: OS permission is the source of truth for the push toggle

## Problem

Today the **Enable Notifications** switch in Profile is bound to a per-user saved preference (`notifPrefs.enabled`) from the DB/local cache. That means:

- After signing out of SIWA and back in with email/password, the saved pref can be `false` while the OS permission is already `granted`, so the user sees the toggle off and (worse) flipping it on triggers extra logic instead of just enabling app prefs.
- Conversely the toggle can show ON while iOS Settings has revoked the permission, because we never reconcile against the OS.
- The on-toggle handler mixes "save user pref" with "request OS permission" instead of branching purely on OS state.

The fix is to treat **OS permission as the source of truth for whether push is enabled on this device**, and use `notifPrefs.enabled` only as a soft "the user wants categories on once permission exists".

## Scope (single file)

`**src/pages/Profile.tsx**` — Enable Notifications card + a small reconciliation effect. No backend changes, no new files, no changes to other notification sub-toggles' logic (they keep using `notifPrefs.*`).

## Changes

### 1. Track OS permission state in Profile

- Add `const [osPushPerm, setOsPushPerm] = useState<NativePushPermission>("unsupported")`.
- New `refreshOsPushPerm()` helper: on native, `await getNativePushPermission()` and `setOsPushPerm(...)`; on web, leave as `"unsupported"`.
- Call it:
  - once on mount,
  - whenever the Profile tab becomes visible (existing `tab === "settings"` effect),
  - on Capacitor `App.appStateChange` `isActive=true` (bind listener inside an effect, unsubscribe on unmount),
  - right after any toggle action below.

### 2. Derive the displayed switch state from OS perm

Replace the Switch `checked` binding with:

```
const pushEnabledEffective =
  Capacitor.isNativePlatform()
    ? (osPushPerm === "granted" && notifPrefs.enabled)
    : notifPrefs.enabled;
```

`<Switch checked={pushEnabledEffective} ... />` and the dependent block (`opacity-50 pointer-events-none`) keys off `pushEnabledEffective` instead of `notifPrefs.enabled`. This makes the UI honest: if iOS Settings revoked permission, the toggle reads OFF even if the saved pref is true.

### 3. Rewrite `onCheckedChange` to branch on OS state only

```text
onCheckedChange(v):
  traceId = nsx_tog_<ts>
  log [NotifSettings] toggle v= permBefore=

  if (!v) {
    // Turning OFF is purely an app-pref change. Never touch OS.
    updateNotifPref("enabled", false)
    return
  }

  // Turning ON.
  if (!Capacitor.isNativePlatform()) {
    updateNotifPref("enabled", true)   // web path unchanged
    return
  }

  const perm = await getNativePushPermission()
  switch (perm) {
    case "granted":
      // Permission already exists for this device. No prompt, no settings jump.
      updateNotifPref("enabled", true)
      await savePushConsent("granted", {})       // server reconciliation only
      toast.success("Notifications enabled")
      break

    case "prompt":
    case "prompt-with-rationale":
      // First-ever ask on this device → fire the native prompt exactly once.
      const result = await requestNativePush()
      if (result === "granted") {
        updateNotifPref("enabled", true)
        // savePushConsent already called inside requestNativePush
        toast.success("Notifications enabled")
      } else {
        updateNotifPref("enabled", false)
        toast.info("Notifications were not enabled.")
      }
      break

    case "denied":
      // OS has permanently denied — re-requesting is a no-op. Send user to
      // the app-specific Settings pane and keep pref OFF until OS flips it.
      toast.info("Opening system notification settings…")
      await openAppSettings(traceId)
      updateNotifPref("enabled", false)
      break

    case "unsupported":
    default:
      updateNotifPref("enabled", true)
      break
  }

  await refreshOsPushPerm()
  log [NotifSettings] toggle permAfter=
```

Critically: the `granted` branch never calls `requestNativePush()` (no prompt) and never opens Settings — exactly the SIWA→email login scenario the user described.

### 4. Reconcile saved pref on resume / on permission change

After `refreshOsPushPerm()` resolves:

- If `osPushPerm === "denied"` and `notifPrefs.enabled === true`, write `updateNotifPref("enabled", false)` locally so stale "on" state from another device or a previous OS-grant disappears. Do NOT call `savePushConsent("denied")` here — pref is per-device UI, server consent is updated only via the explicit toggle/native prompt path.
- If `osPushPerm === "granted"` we leave `notifPrefs.enabled` alone (user may legitimately want it off in-app).

### 5. Logging for evidence

Keep the existing `[NotifSettings] toggle-*` trace lines and add:

- `[NotifSettings] osPerm refresh perm=<...> source=<mount|resume|tabSwitch|postToggle>`
- `[NotifSettings] reconcile action=<force-off|noop> osPerm=<...> savedPref=<...>`

Approved with one clarification and one safeguard.

I agree with the refactor direction: the toggle flow must branch on current OS notification permission state, not login method or stale saved user preference.

Please implement exactly this logic:

prompt / undetermined → request native permission once

granted → never request again, just enable app prefs

denied → never request again, open settings and keep effective UI off

Two notes:

Please describe this as “OS permission is the source of truth for whether push is possible on this device,” since the visible ON state still depends on both OS permission and notifPrefs.enabled.

Be explicit whether updateNotifPref("enabled", false) in the denied/reconcile path is local-only or synced, because I do not want cross-device user intent accidentally overwritten by a single device’s OS state.

Also add a log line for:

[NotifSettings] action=already-granted

That is the key proof for the SIWA → email-login same-device case.

## Out of scope

- No changes to `requestNativePush`, `openAppSettings`, consent sheet, CTA button, Daily Reminder / Streak / Weekly / News sub-toggles, server schema, or push edge functions.
- No changes to the SIWA login flow itself — the perceived "fresh prompt after relogin" disappears as a side effect of step 3's `granted` branch never prompting.

## Verification (manual, on device)

1. Fresh install, OS perm = `prompt`. Toggle ON → native dialog shown once. Allow → toast, toggle stays ON. Logs show `permBefore=prompt action=request permAfter=granted`.
2. Same device, sign out of SIWA, sign back in with email/password. Open Profile → toggle reads ON (because OS=granted). Flip OFF then ON → no native dialog, no Settings jump, just `permBefore=granted action=already-granted`.
3. Revoke notifications in iOS Settings, return to app. Toggle now reads OFF automatically (reconciliation). Tap ON → Settings opens, toggle stays OFF.
4. Web build: behavior unchanged (OS is `unsupported`, toggle = saved pref).
5. Xcode console shows the new `[NotifSettings] osPerm refresh` and `reconcile` lines on mount, tab switch, and app resume.