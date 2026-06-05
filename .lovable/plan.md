## Goal

Make booked coaching sessions and their reminders reliable by treating our DB (not Cal.com) as source of truth. Adds a Cal.com webhook to persist scheduled times, a device-token capture path on app bootstrap, reminder preferences on the profile, and a cron-driven reminder dispatcher.

## 1. Schema changes (single migration)

`**profiles**` — add:

- `email text` (mirrored from `auth.users` via `handle_new_user` + an update trigger; needed so the reminder worker doesn't have to read `auth.users` per row)
- `reminders_enabled boolean not null default true`
- `reminder_offset_minutes int not null default 60` (allowed values: 15, 30, 60, 120, 1440 — enforced via CHECK)

Push token is **already** in `device_tokens` (token, platform, user_id, last_seen_at) — reuse it, do not add `push_token` to profiles.

`**coaching_sessions**` — extend (currently only has user_id/session_month/source/transaction_id):

- `scheduled_at timestamptz null`
- `timezone text null`
- `status text not null default 'pending'` — `pending | scheduled | completed | cancelled | no_show`
- `booking_url text null`
- `external_booking_id text null unique` (Cal.com booking uid)
- `attendee_email text null`, `attendee_name text null`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` + touch trigger
- Index: `(status, scheduled_at)` for the reminder scanner

`**coaching_reminder_log**` (new) — prevents duplicate sends:

- `id`, `session_id uuid`, `user_id uuid`, `offset_minutes int`, `sent_at timestamptz default now()`
- Unique `(session_id, offset_minutes)`
- RLS: user can read own; service_role full. GRANTs included.

All new tables get explicit GRANTs (authenticated select-own, service_role all).

## 2. Edge functions

`**cal-webhook**` (new, `verify_jwt = false`, public)

- Receives Cal.com `BOOKING_CREATED`, `BOOKING_RESCHEDULED`, `BOOKING_CANCELLED`.
- Validates an `X-Cal-Signature` HMAC against `CAL_WEBHOOK_SECRET` (new secret — will request via add_secret).
- Matches user by attendee email → `profiles.email`. If no match, inserts a row with `user_id = null` only for audit log? — instead: reject with 200 + log, no orphan row.
- Upserts on `external_booking_id`: writes `scheduled_at`, `timezone`, `booking_url`, `status`, `attendee_*`. On cancel sets `status='cancelled'`.

`**record-coaching-purchase**` (existing) — unchanged, still inserts the `pending` row at purchase time so we have a paid-but-unscheduled record. The webhook later fills `scheduled_at`.

`**coaching-reminder-dispatch**` (new, `verify_jwt = false`, called by cron)

- Selects sessions where `status='scheduled'` AND `scheduled_at` is within `[now() + offset - 5min, now() + offset + 5min]` for each user's `reminder_offset_minutes`, AND no row in `coaching_reminder_log` for `(session_id, offset)`.
- Joins `device_tokens` for the user; sends via existing `fcm-send` shared helper for native and existing web-push path for web subscriptions.
- Inserts `coaching_reminder_log` row on success. Skips users with `reminders_enabled=false`.

**Cron** (via `supabase--insert`, not migration): `pg_cron` schedule every 5 minutes calling `coaching-reminder-dispatch` with the anon key header.

## 3. Client changes

**Push-token capture on bootstrap** — already implemented in `src/lib/pushFcm.ts` (`register-device-token` invoked from the `registration` listener once user has a session). Confirm it runs after sign-in by calling `requestNativePush()` (or just `bindListenersOnce + register` if perm already granted) from `AuthContext` after auth state becomes signed-in, gated by `NATIVE_FCM_ENABLED`. No prompt added — uses existing user-action gated consent flow. **No change to iOS push prompt timing.**

**Reminder preferences UI** — small section in `src/pages/Profile.tsx` (Settings tab) with a toggle (`reminders_enabled`) and a select for offset (15m / 30m / 1h / 2h / 1day). Writes to `profiles`. Optional; default on but booking never blocks on it.

**Coaching booking flow** — no UX redesign. After successful purchase, `record-coaching-purchase` already inserts the row (now as `status='pending'`). The Cal.com webhook fills in `scheduled_at` once the user picks a time. Remove the duplicate client-side insert in `CoachingBooking.handleDone` (the edge function is already the canonical writer).

**Profile email backfill** — migration backfills `profiles.email` from `auth.users` for existing rows; `handle_new_user` updated to set it on signup; trigger on `auth.users` email-change updates the mirror.

## 4. iOS / Apple

- No new permission prompts at app launch. Push permission is still requested only from the existing user-initiated consent UI (`NotificationConsentSheet`).
- Reminders toggle defaults on but is independent of OS push permission — if denied, booking still succeeds, we simply have nothing to send to.
- Native FCM register remains gated by `NATIVE_FCM_ENABLED`; reminder dispatch via FCM is a no-op for iOS until that flag flips. Web push works today.

## 5. Out of scope (confirmed)

- No change to Stripe or StoreKit purchase UX.
- No Cal.com page redesign — only the booking record is captured via webhook.
- No changes to existing `record-coaching-purchase` response shape.

User: **Approved with minor adjustments:**

- **Keep** `profiles.email`**,** `reminders_enabled`**, and** `reminder_offset_minutes`**.**
- **Reuse** `device_tokens`**; do not add** `push_token` **to** `profiles`**.**
- **Add CHECK constraints for** `reminder_offset_minutes` **and** `coaching_sessions.status`**.**
- **Add** `coaching_reminder_log(session_id, offset_minutes)` **uniqueness for dedupe.**
- **Keep the Cal.com webhook as the canonical source for** `scheduled_at`**,** `timezone`**,** `booking_url`**,** `external_booking_id`**, and attendee fields.**
- **Remove the duplicate client-side insert in** `CoachingBooking.handleDone`**.**
- **Cron every 5 minutes is fine.**
- **Use one reminder at the selected offset only; no second reminder for now.**

**Open items:**

1. **Confirm the Cal.com webhook URL can be registered.**
2. **Confirm** `reminder_offset_minutes` **stays on the preset list.**
3. **Confirm no second reminder is needed.**

## Secrets to add (will prompt)

- `CAL_WEBHOOK_SECRET` — HMAC signing secret configured in Cal.com webhook settings.

## Open questions

1. **Cal.com webhook URL & secret**: do you already have a Cal.com account with webhook access on the `coaching-session` + `coaching-session-ios` event types? I need to register `https://gueosugzlebbaijzcxgh.functions.supabase.co/cal-webhook` and copy the signing secret into `CAL_WEBHOOK_SECRET`.
2. **Reminder offsets**: OK with the preset list (15m / 30m / 1h / 2h / 1day, default 1h), or do you want a free-form minute input?
3. **Multi-reminder**: send one reminder at the chosen offset, or also a fixed second reminder at 15 min before the call?