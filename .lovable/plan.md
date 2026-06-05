# Fix: "Send test reminder" failing + misleading admin empty state

## Root cause

The `coaching-reminder-test` edge function only ever sees `OPTIONS` preflights — no `POST` ever lands (confirmed in edge logs, function_id `48d35635…`: only `OPTIONS | 200` entries, zero invocations of the handler body).

The function's `Access-Control-Allow-Headers` is:

```
authorization, apikey, content-type
```

But `supabase.functions.invoke()` always adds `x-client-info` (and sometimes `x-supabase-api-version`). The browser sees those headers are not in the preflight's allow-list and silently blocks the POST. The frontend then catches a generic error and shows "Failed to send a test reminder".

Verified DB state for the signed-in user (`e90213d4-7b8a-4ae7-a980-b0f212fac206`):

- `device_tokens`: 1 android token (registered Apr 2026) ✅
- `push_subscriptions`: 0 ✅ (web push never granted)
- `coaching_reminder_log`: 0 rows globally → admin audit is correctly empty; test sends are intentionally not logged.

So tokens, JWT, and auth are all fine. It's purely CORS blocking the POST.

## Changes

### 1. Fix CORS on `coaching-reminder-test`

- Expand `Access-Control-Allow-Headers` to: `authorization, apikey, content-type, x-client-info, x-supabase-api-version`.
- Add `Access-Control-Allow-Methods: POST, OPTIONS`.
- Add `Access-Control-Max-Age: 86400` so the preflight is cached.

### 2. Fix CORS on `admin-coaching-reminders` (same hardening, prevent future breakage)

- Same expanded allow-headers + `GET, OPTIONS` methods.

### 3. Sharper errors in `coaching-reminder-test`

Today the function returns generic 200 even when nothing is delivered. Make it return structured error codes the frontend can map:

- `no_devices` — user has 0 device_tokens AND 0 push_subscriptions.
- `permission_denied` — profile.push_consent !== 'granted' (best-effort hint).
- `fcm_failed` / `web_push_failed` — provider rejected; include sanitized provider error in `errors[]`.
- `vapid_missing` — VAPID env not configured (defensive log only).
- Keep existing rate-limit `429` and `401` paths.

### 4. Frontend: precise toasts in `CoachingReminderSettings.tsx`

Replace the single generic toast with mapped messages (EN/FR):

- `no_devices` → "No registered devices on this account. Enable notifications first."
- `permission_denied` → "Notifications are disabled in your settings."
- `fcm_failed` / `web_push_failed` → "Push provider rejected the message. Check that notifications are enabled on this device."
- network/CORS catch → "Couldn't reach the reminder service. Please try again."
- success → "Test reminder sent to N device(s)."

Also log the structured response to the console for in-app debugging.

### 5. Clarify Admin → Coaching reminders empty state

Test sends are intentionally **not** written to `coaching_reminder_log` (keeps the audit a clean record of real scheduled sends). Update the empty card on `AdminCoachingReminders.tsx`:

- Title: "No reminder attempts yet."
- Subline: "Only scheduled cron reminders are logged here. Test reminders triggered from Profile are not recorded."

No schema, no new tables. No change to the cron dispatcher or to which rows count toward the audit.

User feedback: **Approved. The CORS diagnosis is correct and matches the edge logs.**

**Please proceed with:**

- **fixing CORS on** `coaching-reminder-test` **and** `admin-coaching-reminders`**,**
- **ensuring the same CORS headers are included on all responses, not just** `OPTIONS`**,**
- **preferably using Supabase’s shared** `corsHeaders` **helper if our SDK version supports it,**
- **returning structured error codes for the test-send flow,**
- **updating the frontend to map those codes to clear toasts,**
- **clarifying the admin empty state that only scheduled cron reminders are logged there.**

**One addition:**

- **if delivery succeeds on at least one device but fails on another, return a partial-success response and show the success count instead of a full failure.**
- &nbsp;

## Out of scope

- Logging test sends into the audit table.
- Bootstrapping web push for users who haven't granted it.
- Cleaning up stale FCM tokens (already handled in dispatcher on `invalid` response — the test path will reuse the same delete-on-invalid logic).

## Verification

1. Redeploy `coaching-reminder-test` + `admin-coaching-reminders`.
2. In edge logs, the next "Send test reminder" tap shows a `POST | 200` entry (not just OPTIONS) and a `[reminder-test] sent { deliveredNative: 1, … }` log line.
3. Toast in the app reflects the actual outcome (success count or specific error).
4. Admin page empty-state copy now reads the clarified subline.