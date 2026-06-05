# Coaching reminders — review tools + test send + editable copy

Three additions, scoped tightly and independent of each other.

---

## A. Admin "Coaching reminders" audit page

New read-only admin page at `**/admin/coaching-reminders**` that lists every push sent (or attempted) by the `coaching-reminder-dispatch` cron, with filtering by status.

### Data source

- Table: `public.coaching_reminder_log` (already exists, RLS lets users read own rows).
- Joined fields: `coaching_sessions.scheduled_at`, `coaching_sessions.timezone`, `profiles.email`, `profiles.display_name`.

### Backend

- **New edge function `admin-coaching-reminders**` (`verify_jwt = false`, auth-checked in code, admin-only via `has_role`). Uses service role to read across users + join, returns last 200 rows ordered by `sent_at desc`.
- Optional query params: `?status=success|failure|all`, `?limit=50..500`.
- Returns: `[{ id, sent_at, offset_minutes, channel, success, error, session_id, user_id, user_email, user_name, scheduled_at, timezone }]`.

### UI

- `src/pages/AdminCoachingReminders.tsx` — matches existing `AdminNotifications`/`AdminScheduledPush` style (sticky header, admin gate via `has_role`, list of cards).
- Each row shows: time sent, offset chip (15m / 30m / 1h / 2h / 24h), success/failure pill, recipient name+email, scheduled time, and (on failure) the error message in muted text.
- Filter toggle: All / Success / Failures only.
- Add tile to `src/pages/Admin.tsx` index list ("Coaching reminders — Audit sent reminders & failures").
- Add route `/admin/coaching-reminders` in `src/App.tsx`.

### Permissions

- Edge function rejects non-admin callers.
- No schema change. Existing RLS on `coaching_reminder_log` already restricts user reads to own rows; admin path goes through the edge function with service role.

---

## B. "Send test reminder to me now" in user settings

User-facing button inside `**src/components/CoachingReminderSettings.tsx**` so anyone can preview the actual push end-to-end (validates token registration, copy, deep-link).

### Backend

- **New edge function `coaching-reminder-test**` (`verify_jwt = false`, validates JWT in code).
- Looks up caller's `profiles` (locale, display_name) and their `device_tokens` + `push_subscriptions`.
- Sends the same title/body the cron would send, using a fake "now" target so the body reads `Your call starts at <current time + 5 min>.`
- Reuses `sendFcmToToken()` and `web-push` exactly as `coaching-reminder-dispatch` does.
- Does **not** write to `coaching_reminder_log` (keeps audit clean), but logs `[reminder-test] sent { native, web, errors }`.
- Returns `{ ok, deliveredNative, deliveredWeb, errors }`.

### UI

- "Send test reminder" button under the existing offset selector.
- Toast on success: `Test reminder sent to N devices.` On zero devices: `No registered devices — enable notifications first.` On failure: shows truncated server error.
- Disabled while in-flight.

---

## C. Move reminder copy into the CMS

So you can edit title/body without redeploying. Uses the existing `content_blocks` table (page/section/key/locale/value).

### Seeded keys (page = `coaching`, section = `reminder`)


| key     | en value                      | fr value                         |
| ------- | ----------------------------- | -------------------------------- |
| `title` | `Coaching call reminder`      | `Rappel : appel de coaching`     |
| `body`  | `Your call starts at {time}.` | `Votre appel commence à {time}.` |


`{time}` is a literal placeholder the dispatcher substitutes with the user's local start time.

### Dispatcher change

- `supabase/functions/coaching-reminder-dispatch/index.ts` and the new `coaching-reminder-test`:
  - Fetch the four `content_blocks` rows once per invocation (cache for the run).
  - Build title/body from CMS values per the user's locale; fall back to current hardcoded strings if a row is missing.
  - Replace `{time}` with the existing `whenLocal` string.

### Seed migration

- One-shot insert of the four rows into `content_blocks` (idempotent via `ON CONFLICT (page, section, key, locale) DO NOTHING` — requires that unique index; check existing schema and add only if missing).

### CMS exposure

- No new UI: these are visible/editable via the existing CMS editor (already covers `content_blocks` rows).

---

## Out of scope

- Adding new offsets, channels (email/SMS), or A/B copy variants.
- Editing reminder logic (still cron-only, 5-min window, one send per `(session_id, offset)`).
- Backfilling history before this feature ships.

## Verification

- **A.** Visit `/admin/coaching-reminders` as admin → see recent rows; non-admin → 403/redirect.
- **B.** Tap "Send test reminder" with notifications enabled on iOS/Android/web → push arrives within seconds with correct localized copy and tappable deep link to booking URL.
- **C.** Edit `coaching/reminder/title` in CMS → next dispatch (or "Send test") uses the new copy without redeploy. Delete a row → falls back to hardcoded string.

User feedback: Plan approved with a few adjustments:

Keep the three-part scope: admin audit page, user test-send button, and CMS-managed reminder copy.

For admin-coaching-reminders, do not leave it publicly callable unless absolutely necessary. Require auth and verify admin role in code, then use service role only for the data read.

For coaching-reminder-test, validate the caller identity before looking up tokens or sending anything; add simple rate limiting per user.

Confirm coaching_reminder_log actually stores both successes and failures, plus channel / error fields if the admin page is going to display them. If not, update the dispatcher/logging so the audit page reflects all attempts, not only successful sends.

CMS reminder copy is approved. Use locale fallback order: user locale → English → hardcoded default, and never fail a send if {time} is missing from the template.

Keep the existing reminder timing logic unchanged.

&nbsp;

## Order of execution

1. Migration: seed `content_blocks` rows (+ unique index if missing).
2. Edge functions: `coaching-reminder-test` (new), `admin-coaching-reminders` (new), `coaching-reminder-dispatch` (CMS lookup).
3. Frontend: `AdminCoachingReminders` page + route + Admin tile, "Send test" button in `CoachingReminderSettings`.