## Goal

Automatically deliver three scheduled push notifications — Daily meal reminder, Streak reminder, Weekly progress summary — to users who have OS-level push granted AND the corresponding alert toggle on in Profile, in their preferred language at a sensible local time. Reuse the existing FCM + VAPID pipeline (`fcm-send`, `push-notifications`, `device_tokens`, `profiles.notification_preferences`, `push_campaigns` / `push_campaign_runs`).

## Architecture (reuse + extend)

Existing infra already supports: device token registration, multi-device sending, consent gating, dedupe per (campaign,user), and a `push-scheduler` cron. We extend it with **scheduled (time-of-day) campaigns** in addition to the current event-based ones, plus a per-locale templating layer.

```text
profiles ──┐
           │ push_consent + notification_preferences + locale + timezone
device_tokens (1..n per user, web/android/ios)
           │
push_campaigns (trigger_type=scheduled, schedule + i18n templates)
           │
pg_cron (every 15 min) ──► push-reconcile edge fn
           │  - finds users matching each scheduled campaign whose
           │    local time has crossed today's send time
           │  - upserts push_campaign_runs (campaign_id,user_id,scheduled_for)
           │  - idempotent via UNIQUE (campaign_id,user_id,scheduled_for)
           ▼
push-scheduler (existing, every minute) sends due runs via fcm-send,
picks step copy by user locale, marks runs done.
```

No new long-running services. Everything is cron + edge functions.

## Schema changes (one migration)

1. `profiles`: add `timezone text` (IANA, default `'UTC'`) and `locale text` (default `'en'`).
2. `notification_preferences` JSONB defaults extended to include the three keys (already partly there): `daily_meal_reminder`, `streak_reminder`, `weekly_summary`. Backfill existing rows with defaults `true,true,true` while preserving any explicit `false`.
3. `push_campaigns`:
  - allow `trigger_type='scheduled'`.
  - new column `schedule jsonb` — e.g. `{ "kind": "daily", "local_time": "19:00", "preference_key": "daily_meal_reminder" }` or `{ "kind": "weekly", "weekday": 1, "local_time": "09:00", "preference_key": "weekly_summary" }`.
  - `steps` extended so each step's `title`/`body` is `{ en: "...", fr: "..." }` (renderer picks by profile locale, fallback `en`).
4. `push_campaign_runs`:
  - add `scheduled_for timestamptz null` (the local wall-clock instant for this user's run).
  - replace existing UNIQUE `(campaign_id,user_id)` with UNIQUE `(campaign_id,user_id, coalesce(scheduled_for, 'epoch'))` so event campaigns keep one-shot dedupe while scheduled campaigns dedupe per occurrence.

Seed three rows in `push_campaigns` (active=false initially so admin can flip on):

- Daily meal reminder — daily 19:00 local (user can adjust reminder time), key `daily_meal_reminder`.
- Streak reminder — daily 20:00 local, key `streak_reminder` (v1 sends to anyone with the toggle on; "at risk" gating noted as follow-up).
- Weekly summary — Sunday 18:00 local, key `weekly_summary`.

## New edge function: `push-reconcile`

Cron every 15 minutes. For each active scheduled campaign:

1. Compute the local "now" per timezone bucket using `AT TIME ZONE` SQL.
2. Select candidate users from `profiles` where `push_consent='granted'`, the campaign's `preference_key` is `true` in `notification_preferences`, AND today's `local_time` for `timezone` falls within `[reconcile_window_start, now]` AND no run already exists for `(campaign_id,user_id, today's scheduled_for)`.
3. Upsert `push_campaign_runs` with `next_send_at = now()` and `scheduled_for = computed UTC instant`. Conflict on the new UNIQUE = idempotent across reopens, multi-device, reinstalls.

The existing `push-scheduler` then sends due runs unchanged, with two small edits:

- pick `step.title[locale] ?? step.title.en` etc. from the user's `profiles.locale`.
- after send, mark run `done` (already does).

## Client-side reconciliation triggers

Just one tiny touchpoint — no client cron. The server cron does all heavy lifting. We only ensure the profile fields are kept fresh so the server can target correctly:

- `pushFcm.savePushConsent` → already writes `push_consent`; extend to also write `timezone: Intl.DateTimeFormat().resolvedOptions().timeZone` and `locale: i18n.language` when missing/changed.
- `LanguageSwitcher` → on change, update `profiles.locale` for signed-in users.
- `Profile` notification toggles → already persist to `notification_preferences`; no change beyond exposing the three new keys in the UI.
- `register-device-token` → unchanged; multi-device already supported via UNIQUE on `token`.
- Token invalidation: `fcm-send` already deletes invalid tokens on FCM `UNREGISTERED`/`INVALID_ARGUMENT`. Keep as-is.

## Localization

Centralized in DB (campaign `steps[].title/body` per locale) so non-engineers can edit via admin without code deploy. A small shared helper `supabase/functions/_shared/i18nStep.ts` resolves `{en,fr}` → string with `en` fallback. Initial seed uses the EN/FR copy from the request brief verbatim.

## Failure handling


| Case                  | Behavior                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| Invalid/expired token | `fcm-send` deletes; next reconcile naturally re-targets remaining tokens                                        |
| OS permission revoked | Client `savePushConsent('denied')` on next app open → reconcile excludes user                                   |
| Missing timezone      | Default `'UTC'`; reconcile still works, fires at UTC time                                                       |
| Missing locale        | Fallback `en`                                                                                                   |
| Multiple devices      | `fcm-send` already loops all tokens for the user                                                                |
| Logged-out user       | No `profiles` row matched → excluded                                                                            |
| Duplicate sends       | UNIQUE `(campaign_id,user_id,scheduled_for)` prevents double enqueue across reopens, multi-device, cron overlap |


## Files touched

**New**

- `supabase/migrations/<ts>_scheduled_push.sql` — schema + seed + unique index + cron registration via `supabase/insert` (cron is data, not schema).
- `supabase/functions/push-reconcile/index.ts`
- `supabase/functions/_shared/i18nStep.ts`

**Edited**

- `supabase/functions/push-scheduler/index.ts` — locale-aware copy picker; honor `scheduled_for` already-past filter.
- `src/lib/pushFcm.ts` (`savePushConsent`) — persist `timezone` + `locale`.
- `src/components/LanguageSwitcher.tsx` — persist locale to `profiles` on change.
- `src/pages/Profile.tsx` — surface three alert toggles (Daily meal reminder, Streak reminder, Weekly summary) wired to `notification_preferences`.

## Implementation order (low → high risk)

1. Migration: add `timezone`, `locale`, extend preferences defaults, add `schedule` col and new UNIQUE, seed inactive campaigns.
2. Client: persist `locale` + `timezone` on consent + language change. Surface Profile toggles.
3. `_shared/i18nStep.ts` + scheduler locale picker.
4. `push-reconcile` function + pg_cron schedule (every 15 min).
5. Flip the three seeded campaigns `active=true` after smoke-test with one admin user.

## Open follow-ups (intentionally out of scope for v1)

- "Streak at risk" gating: needs reading today's `progress_entries`; v1 sends to anyone with the toggle on. Add a `condition` JSON later evaluated in `push-reconcile`.
- Per-user quiet hours / custom send times — currently global defaults.
- iOS APNs key — pipeline already routes `platform='ios'` through FCM, untouched here.

- Do **not** backfill the three new alert keys to `true` for existing users; use `false` unless explicitly enabled.
- Normalize `profiles.locale` to supported values like `en` / `fr` before save and at send time.