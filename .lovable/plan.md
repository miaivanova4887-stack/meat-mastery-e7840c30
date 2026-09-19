# Push delivery tied to consent, not sign-in

## Goal
Anyone who opts in to notifications gets the scheduled reminders (daily meal 19:00, streak, weekly, etc.) — even if they never created an account or are signed out. Consent, not login, decides delivery.

## Current behavior (confirmed in code)
- The app only saves the phone's push token to the backend when a session exists — signed-out users are skipped (`pushFcm.ts`: "skipping token register — no session").
- The reminder scheduler only enrolls people with a profile/account (`push-reconcile`), so anonymous phones are never reached.

## Changes

### 1. Database (one migration)
- `device_tokens.user_id` becomes optional (empty = anonymous phone).
- Add `timezone` and `locale` columns to `device_tokens` so anonymous phones get reminders at the right local time and language.
- New small table `push_anon_sends` to record which reminder was already sent to which anonymous phone (prevents duplicates).

### 2. Token registration (`register-device-token` function)
- Accept registrations with or without a sign-in session.
- No session: save the token as anonymous, storing the phone's timezone and language.
- With session: behaves as today, and also links any previously anonymous token on that phone to the account (so the moment someone signs in, their reminders follow their personal settings instead).

### 3. Reminder scheduling (`push-reconcile` function)
- After enrolling signed-in users as today, also pick up anonymous phones: for each scheduled reminder, compute the send time in the phone's own timezone, and if it's due, send it directly and record it in `push_anon_sends`.
- Anonymous phones get the default reminder set (all reminder types on, marketing off) — same defaults new accounts get.

### 4. App changes (`src/lib/pushFcm.ts`)
- Remove the "no session → skip" checks so the token is registered as soon as the person grants notification permission, signed in or not.
- Keep the existing behavior where signing in later upgrades the phone's registration to the account automatically.

### 5. Rollout
- Database change + both functions deploy immediately (no app update needed for that part).
- The app change requires a rebuild: version 24 / 1.2.6, uploaded to Play Console after 23 / 1.2.5.
- Web push (browser) stays sign-in-only in this round; native Android/iOS is covered. Can extend to web later if wanted.

## Technical details
- Migration: `ALTER TABLE public.device_tokens ALTER COLUMN user_id DROP NOT NULL`, add `timezone text NOT NULL DEFAULT 'UTC'`, `locale text NOT NULL DEFAULT 'en'`; `CREATE TABLE public.push_anon_sends (token text, campaign_id uuid, scheduled_for timestamptz, UNIQUE(token, campaign_id, scheduled_for))` with RLS enabled and grants to `service_role` only.
- `register-device-token`: session optional; parse `timezone`/`locale` from body (validated); upsert on `token` conflict, setting `user_id` when a session exists (never clearing an existing link when anonymous).
- `push-reconcile`: after the per-profile loop, query `device_tokens WHERE user_id IS NULL AND platform IN ('android','ios')`; reuse `computeOccurrenceUtc` per token timezone; send step-0 localized copy via `sendFcmToToken`; insert into `push_anon_sends` for idempotency; delete tokens FCM reports as invalid.
- `pushFcm.ts`: `registerDeviceTokenWithBackend` no longer requires a session and passes timezone/locale; `retryNativeRegistrationIfGranted` drops the no-session deferral.
