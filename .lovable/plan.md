Two parallel tracks. Push-tap diagnostics from the previous turn stay in place until you confirm cold-start / background / foreground routing all work — no log removal in this plan.

---

## Track 1 — Why CarnivoreX isn't in iOS Settings → Notifications, and a real "Open settings" fallback

### Diagnosis (from current code)

- `App.entitlements` has `aps-environment = development` ✓ (correct for dev/TestFlight debug build; release build needs `aps-environment = production` — Xcode flips this automatically when archiving with the matching provisioning profile, but confirm the Release entitlements override is not stripped).
- `Info.plist` has `UIBackgroundModes → remote-notification` ✓.
- `FirebaseAppDelegateProxyEnabled = false` ✓ (matches our manual APNs forwarding in `CarnivoreXPush.swift`).
- We never call `UIApplication.unregisterForRemoteNotifications` anywhere — confirmed by ripgrep target.
- `pushFcm.ts` already calls `PushNotifications.register()` on iOS regardless of grant verdict (lines 308–326), which is what causes iOS to register the app under Settings → Notifications.

The most likely real cause the app is missing from Settings → Notifications:

1. On the test device, the user never tapped **Allow** on the system prompt, OR the prompt was suppressed because our pre-check returned `denied` from a previous run. iOS only adds an entry to Settings → Notifications **after** the app calls `registerForRemoteNotifications` (which we do) **and** the user has answered the prompt (allow or deny). If `requestPermissions` resolved to `denied` without a visible prompt, iOS will not show the row.
2. The Xcode project may be missing the **Push Notifications** capability (separate from the `aps-environment` entitlement key). The entitlement key alone is sometimes set without the capability checkbox, which causes APNs registration to silently fail on the first real provisioning sync.

### Changes

**1. Add Xcode capability verification step (manual + script)**

- Add a short README in `ios/README-push-capability.md` with the exact Xcode steps: Target → Signing & Capabilities → `+` → "Push Notifications" and "Background Modes → Remote notifications". (User-actionable; can't be set from code.)
- Add a one-time diagnostic log on launch in `src/lib/pushFcm.ts` that prints the resolved `aps-environment` consequence — i.e. after `register()` returns, log `existing` permission, `finalReceive`, whether APNs token event fired within 4s (timer). This makes "stuck in `prompt` with no APNs callback" visible in Xcode logs.

**2. Force-show the iOS prompt even after a prior `denied**`

- In `requestNativePush()`: if `existing === "denied"`, do not silently bail — open the system settings deep link via the new fallback (below) so the user can flip the toggle. Currently we just return `"denied"` and the row never appears.

**3. "Enable notifications" CTA → real system-settings deep link**

- `src/lib/openAppSettings.ts` already wraps `capacitor-native-settings` (`IOSSettings.App`). That opens the **app's settings page**, which on iOS contains the **Notifications** row — this is as deep as iOS allows without private API. Verify it works; document the limitation.
- Update every "Enable notifications" CTA (NotificationConsentSheet "Open Settings" branch when denied, and Profile → Notifications section) to call `openAppSettings()` instead of any in-app re-prompt when `permission === "denied"`.
- Add a new helper `openNotificationSettings()` that on iOS tries `App-Prefs:NOTIFICATIONS_ID&path=<bundle-id>` first (works on some iOS versions) and falls back to `openAppSettings()`. On Android it stays at app-details. Wire this everywhere a "Open settings" CTA exists.

**4. Confirm we never unregister**

- Already verified — no `unregisterForRemoteNotifications` call exists. No change needed; note this in the diagnostic README.

---

## Track 2 — Paid-but-unscheduled coaching sessions

### Data model

`public.coaching_sessions` already supports `status = 'pending'` (CHECK constraint includes it). `record-coaching-purchase` already inserts new purchases with `status='pending'`. We just need to:

- Treat `status='pending'` as the canonical **paid_unscheduled** state. No schema change required beyond optionally renaming via a tolerant UI label.
- Add an index helper: nothing new; existing `status_scheduled_idx` is enough.
- Migration: add two nullable columns to `coaching_sessions`:
  - `unscheduled_reminder_count int not null default 0`
  - `unscheduled_reminder_last_sent_at timestamptz`
  These let the new dispatcher rate-limit nudges (no schema change to existing rows; defaults backfill).

### UI: Profile → Your Coaching

`src/components/CoachingSessionsList.tsx` currently filters out `pending` (`visible = sessions.filter(s => s.status !== "pending")`). Change to:

- New section **"Action needed — Schedule your session"** rendered above Upcoming, listing all `status='pending'` rows.
- Each row shows: "1-hour coaching call — paid, awaiting schedule" + a primary CTA **Schedule** that opens `CoachingBooking` modal (already exists) in **no-payment / already-paid** mode using the iOS no-payment Cal.com URL when `source='paid_ios'` and the regular paid URL fallback for web.
- Keep the existing Upcoming / Past sections unchanged for `status='scheduled'` etc.

### Booking flow

- `CoachingBooking.tsx`: accept an optional `mode: "already_paid"` + `sessionId` prop. When set, skip payment, open `CAL_IOS_NO_PAYMENT_URL` (iOS) or paid URL with `?reschedule=...` for web. Listen to `cal-webhook` flipping the row to `status='scheduled'` (already happens). The pending row's `id` is used as `external_booking_id` linkage via existing webhook matching by `attendee_email`/`transaction_id` — no change needed if we pass the same email.

### Reminder nudges (paid but unscheduled)

- New shared utility in `supabase/functions/_shared/reminderCopy.ts`: add `unscheduledNudge` copy (en/fr) with a CMS row fallback.
- New edge function `supabase/functions/coaching-unscheduled-nudge/index.ts`:
  - Selects `coaching_sessions` where `status='pending'` AND `created_at < now() - interval '15 minutes'` (immediate "schedule now" nudge) OR `unscheduled_reminder_last_sent_at IS NULL OR < now() - interval '2 days'` (every 48h follow-up).
  - Caps at `unscheduled_reminder_count < 4` so we never spam.
  - Dispatches FCM + web push with payload `{ type: "coaching_unscheduled", target: "coaching_upcoming_session", path: "/profile?tab=settings&section=coaching&sessionId=<id>" }` — reuses existing push-tap deep-link plumbing.
  - On send: increment counter, set `unscheduled_reminder_last_sent_at`.
- Schedule via `pg_cron` every 30 minutes using `supabase--insert` (URL + anon key, per project rules).

### Once scheduled, switch to normal reminders

- No code change needed. The existing `coaching-reminder-dispatch` already keys off `status='scheduled'`. The new nudge function keys off `status='pending'`. The `cal-webhook` flip from `pending → scheduled` is the natural cut-over.

---

## Track 3 — Keep push-tap diagnostics

- No changes to `src/lib/pushFcm.ts` and `src/hooks/usePushNavigation.ts` diagnostic logs.
- Do **not** remove `[PushTap]` / `[PushNav]` lines until you've shared logs for cold-start, background, and foreground tap and we've confirmed `/profile?tab=settings&section=coaching&sessionId=...` actually mounts.

---

## Files touched

- `ios/README-push-capability.md` (new) — Xcode capability checklist.
- `src/lib/pushFcm.ts` — add APNs-callback watchdog log + force-settings on prior denial.
- `src/lib/openAppSettings.ts` — add `openNotificationSettings()` with iOS preference-URL attempt, app-details fallback.
- `src/components/NotificationConsentSheet.tsx` + Profile notifications section — use `openNotificationSettings()` when denied.
- `src/components/CoachingSessionsList.tsx` — render Action-needed section for `status='pending'`, wire Schedule CTA.
- `src/components/CoachingBooking.tsx` — accept `mode="already_paid"` + `sessionId`.
- `supabase/functions/_shared/reminderCopy.ts` — add unscheduled nudge copy.
- `supabase/functions/coaching-unscheduled-nudge/index.ts` (new).
- Migration: add `unscheduled_reminder_count` + `unscheduled_reminder_last_sent_at` to `coaching_sessions`.
- `supabase--insert` SQL: cron schedule for the new function every 30 minutes.

User: Approved, with two adjustments.

Track 1

I agree with:

Xcode Push Notifications + Background Modes verification

keeping APNs registration watchdog logs

sending denied users to system settings

updating all “Enable notifications” CTAs to open settings instead of trying to re-prompt

Adjustment:

use openAppSettings() as the primary supported iOS path

do not depend on App-Prefs:... notification URLs as core behavior, since they are not consistently supported across iOS versions

Track 2

I agree with:

using status='pending' as the canonical paid-but-unscheduled state

showing a visible Schedule card in Profile → Your Coaching

adding a no-payment scheduling mode

adding rate-limited unscheduled reminder nudges

switching naturally to existing scheduled reminders after booking

One required confirmation:

explicitly verify the exact linkage mechanism that converts a pending coaching_sessions row into the later scheduled booking row, so we do not create orphaned pending purchases or duplicate scheduled sessions

Track 3

Keep all current push-tap diagnostics until we have confirmed routing works from cold start, background, and foreground tap.

## Verification

1. iOS: clean build, launch, tap "Enable notifications". Confirm prompt appears AND a row now exists in Settings → Notifications → CarnivoreX. If previously denied, confirm CTA deep-links to settings.
2. Buy a coaching session via TestFlight → backgrounds App Store sheet → return to Profile → confirm new **Schedule** card appears. Tap it → CoachingBooking opens in no-payment mode.
3. After 15 min with the row still pending, confirm a push arrives with title "Schedule your coaching call". Tap it → app deep-links to the Schedule card.
4. Complete a Cal.com booking → confirm the row moves from Action-needed to Upcoming, and standard reminder cadence resumes.
5. Push-tap diagnostics: re-run cold-start / background / foreground tests and capture `[PushTap]` / `[PushNav]` logs.