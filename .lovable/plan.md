# Scheduled Push Notifications — Admin CMS

Add a new admin screen to manage the three (and future) `scheduled` rows in `push_campaigns` without redesigning the backend.

## 1. Admin entry point

- Add a new tile on `src/pages/Admin.tsx` → "Scheduled Push" → `/admin/scheduled-push`.
- New route in `src/App.tsx` guarded by `useIsAdmin` (same pattern as `AdminNotifications`).

## 2. List view — `src/pages/AdminScheduledPush.tsx`

Fetch `push_campaigns` where `trigger_type = 'scheduled'`, ordered by name.

For each row show:

- Name + active/inactive pill (green/grey)
- Preference key chip (`daily_meal_reminder`, `streak_reminder`, `weekly_summary`)
- Schedule summary, derived from `schedule` JSONB:
  - daily → "Daily at HH:MM local" (or "Daily at user's reminder time" if `use_profile_reminder_time`)
  - weekly → "{Weekday} at HH:MM local"
- Locales available — computed from `steps[0].title` keys (always shows `EN`, `FR` for current seeds)
- `updated_at` timestamp
- Inline toggle (Switch) to flip `active` with an optimistic update + guardrail (see §6)

## 3. Edit screen — `src/components/admin/ScheduledPushEditor.tsx` (drawer/modal)

Opens from the list. Form fields, bound to a local draft of the row:

- `name` (text)
- `active` (switch — same guardrail as list)
- Schedule block:
  - `kind` → segmented `daily` / `weekly`
  - `local_time` → native `<input type="time">`
  - `weekday` → 0–6 select, only when `kind=weekly`
  - `use_profile_reminder_time` → checkbox, only when `kind=daily`
  - `preference_key` → read-only display (changing it would orphan user toggles)
- Copy block (only step 0 — current seeds are single-step):
  - EN title, EN body (required when active)
  - FR title, FR body (optional, fallback to EN — see §6)

Save writes back to `push_campaigns` (`name`, `active`, `schedule`, `steps`) via the existing admin RLS. `trigger_type`, `id`, `preference_key` are never mutated.

## 4. Preview UI

In the editor, render an iOS-style notification card component:

```text
┌───────────────────────────────┐
│ 🔥  CarnivoreX        now    │
│ Title (live)                  │
│ Body (live)                   │
└───────────────────────────────┘
```

- Tabs above the card: `EN` | `FR`. Switching swaps which `steps[0].title/body` localized value is shown.
- Below the card: human-readable schedule summary recomputed from the draft.
- Updates on every keystroke (controlled inputs).

## 5. Test send

Add `supabase/functions/admin-test-push/index.ts`:

- `verify_jwt = false` (matches other admin functions), validates JWT in code.
- Requires caller has `admin` role (via `has_role`).
- Body: `{ campaignId: string, locale: "en" | "fr" }`.
- Reads campaign from DB, picks `steps[0]`, resolves localized title/body via the same `pickLocalized` helper (locale already normalized client-side, server normalizes again).
- Fetches caller's own `device_tokens` (`android`/`ios`) and calls `sendFcmToToken` for each.
- Does NOT touch `push_campaign_runs`, so no real-user enqueueing.
- Returns `{ sent: number, invalid: number }`.

Editor button: "Send test to me" (one per locale tab). Disabled if no FCM tokens registered for this admin.

## 6. Validation & guardrails

Client-side, enforced before save and before activating:

- EN `title` and EN `body` required.
- FR fallback: if FR title or body is empty, send layer already falls back to EN via `pickLocalized` — show an inline "Will use EN" hint rather than blocking. Documented in the editor.
- `local_time` matches `^\d{2}:\d{2}$`, hours 0–23, minutes 0–59.
- `kind=weekly` requires `weekday` in 0..6.
- Activating a row that fails any check is blocked with a toast.
- `push-reconcile` already filters by `active=true`, so inactive rows are inert with no extra change.
- Keep JWT verification enabled for `admin-test-push`; enforce admin role in function code.
- Ensure the active toggle rolls back cleanly if validation fails or save fails.

## 7. Backend changes

None to schema. All operations use existing tables and RLS. Only one new edge function (`admin-test-push`).

## 8. i18n

Admin UI strings are English-only (matches existing `AdminNotifications.tsx`). No `en.json` / `fr.json` keys added.

## 9. Files touched

New:

- `src/pages/AdminScheduledPush.tsx`
- `src/components/admin/ScheduledPushEditor.tsx`
- `src/components/admin/NotificationPreviewCard.tsx`
- `supabase/functions/admin-test-push/index.ts`

Edited:

- `src/pages/Admin.tsx` — add tile
- `src/App.tsx` — add `/admin/scheduled-push` route

## Out of scope

- Draft-vs-live separation (edits are live-on-save, per spec v1).
- Multi-step campaigns (current seeds are single-step; editor exposes step 0 only).
- Editing `preference_key` or `trigger_type`.
- Localizing the admin UI itself.