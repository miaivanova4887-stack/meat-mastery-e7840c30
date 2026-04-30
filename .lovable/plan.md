# Fix: Verification emails never reach the branded hook

## Diagnosis (from live system)

- Domain `notify.carnivorex.app` is **Verified** (SPF/DKIM/DMARC pass).
- Latest signup attempt (`carnivorex.app@gmail.com`, 19:39:23 UTC) returned 200 in Supabase Auth as `user_repeated_signup` — meaning the address was already registered (still unconfirmed). Supabase Auth does **not** re-issue a confirmation email on repeated signup of an existing address.
- More importantly, the `auth-email-hook` Edge Function has **zero invocations** since deploy:
  - `email_send_log` is empty (0 rows ever).
  - `auth_emails` pgmq queue is empty (0 total messages).
  - No edge logs for `auth-email-hook`.
- The dispatcher (`process-email-queue`) cron is healthy and scheduled every 5s — it just has nothing to dispatch.

So even when a *new* address signs up, Supabase Auth is using its **default email path**, never invoking our branded hook.

## Two things to fix

### 1. Force the hook re-bind (root cause of zero invocations)

Re-scaffold `auth-email-hook` and redeploy. Lovable's setup reconcile re-binds the hook into Supabase Auth's "Send Email" webhook config when the function is (re)deployed. This is the supported recovery path when no invocations are observed.

Steps (default mode):

1. Run `email_domain--scaffold_auth_email_templates` with `confirm_overwrite: true` (templates already exist; we keep the current branding by re-checking the file diff before accepting).
2. Run `supabase--deploy_edge_functions` for `["auth-email-hook"]`.
3. Lovable's Cloud → Emails reconcile loop re-binds the hook automatically.

Note on branding: the existing templates in `supabase/functions/_shared/email-templates/` already use the CarnivoreX brand. After re-scaffold, diff `signup.tsx` etc. and re-apply the brand styling if the scaffold reset it. No template content changes are required for delivery.

### 2. Force a real test (the 19:39 signup will never email)

Because `carnivorex.app@gmail.com` is already in `auth.users` as unconfirmed, Supabase will keep returning 200 with no email. Two options:

- **Recommended:** sign up with a brand-new address (e.g. `+test1@gmail.com` alias) after the redeploy. Then check:
  - `email_send_log` — should show a `pending` then `sent` row with `template_name='auth_emails'`.
  - `auth-email-hook` edge logs — should show `Auth email enqueued`.
- **Alternative:** delete the existing unconfirmed user from `auth.users` so the address can sign up fresh.

## Verification checklist (run after redeploy)

1. `email_send_log` has a new `pending` row within seconds of the signup.
2. Within ~5–10s, that row's latest status flips to `sent` (deduped by `message_id`).
3. `auth-email-hook` logs show `Auth email enqueued`.
4. `process-email-queue` logs show a successful drain of `auth_emails`.
5. Email arrives in inbox from `CarnivoreX <noreply@notify.carnivorex.app>`.

If after redeploy the hook still shows zero invocations on a fresh signup, the failure is in Supabase Auth's webhook binding itself — at that point the only fix is to re-run `setup_email_infra` (idempotent) to refresh the vault secret + reconcile, which is the documented recovery for `function_not_found` / unbound state.

## Why the 6 secondary checks passed but emails still failed


| Check                | Status  | Why it didn't help                                                       |
| -------------------- | ------- | ------------------------------------------------------------------------ |
| Domain verified      | ✅       | Verification only matters once an email is actually sent — none ever was |
| From address correct | ✅       | Set in `auth-email-hook/index.ts`, never executed                        |
| Templates deployed   | ✅       | Files exist; hook isn't called to render them                            |
| Rate limit           | ✅ Clear | Zero sends ≠ throttled                                                   |
| Right environment    | ✅       | Single Supabase project; no env mismatch                                 |
| Auth event firing    | ✅       | Yes, but routed to default email path, not hook                          |


Approved. Please proceed with the re-scaffold and redeploy to rebind 

the auth-email-hook.

One additional fix required after redeploy:

The test email for [johnathangoldsmith112@gmail.com](mailto:johnathangoldsmith112@gmail.com) arrived but the 

verification link redirected to [carnivore-coach-pro.lovable.app](http://carnivore-coach-pro.lovable.app) 

instead of [https://app.carnivorex.app/auth/callback](https://app.carnivorex.app/auth/callback).

Please confirm:

1. emailRedirectTo in AuthContext.tsx is set to 

   [https://app.carnivorex.app/auth/callback](https://app.carnivorex.app/auth/callback) for native platform.

2. No email template (signup.tsx or others) hardcodes 

   [carnivore-coach-pro.lovable.app](http://carnivore-coach-pro.lovable.app) in any CTA button URL.

3. After redeploy, test with a fresh email address and confirm 

   the verification link in the email points to 

   [https://app.carnivorex.app/auth/callback](https://app.carnivorex.app/auth/callback).

&nbsp;

## What the user should do after I redeploy

1. Sign up with a **new** email address (not the previously-attempted one).
2. Watch inbox + spam folder.
3. If still nothing arrives in 60s, ping me — I'll pull the fresh logs.