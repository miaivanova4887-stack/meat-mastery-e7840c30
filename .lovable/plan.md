I verified the current source and live email logs in read-only mode. The frontend already sends `emailRedirectTo: https://app.carnivorex.app/auth/callback`, and the signup email template uses the rendered `confirmationUrl` prop rather than `siteUrl`/`.SiteURL`. The live `auth-email-hook` is receiving signup events and enqueuing messages, but the recent logs do not show the expected apex-to-subdomain rewrite log, which means we need to prove whether the active deployed function is the latest code and what host it receives from the auth system.

Plan to finish the fix after approval:

1. Verify the live auth configuration
  - Check the project auth URL configuration from Lovable Cloud.
  - Ensure the Site URL is exactly:
  `https://app.carnivorex.app`
  - Ensure the redirect allowlist includes:
  `https://app.carnivorex.app/**`
  - If the old apex domain is still the Site URL, update it to the verified subdomain.
2. Make the active email hook self-verifying and safer to debug
  - Update `supabase/functions/auth-email-hook/index.ts` to log a safe, token-redacted diagnostic for every auth email render:
    - incoming URL host/path
    - normalized URL host/path
    - whether a rewrite happened
    - action type and run id
  - Keep secrets out of logs by redacting the query/hash token values.
  - Make the rewrite more robust by using `u.hostname` instead of only `u.host`, and normalizing any of these to `app.carnivorex.app`:
    - `carnivorex.app`
    - `www.carnivorex.app`
  - Preserve the full path, query string, and hash in the actual email link.
3. Confirm templates use the right source of truth
  - Confirm the active React email templates render `confirmationUrl` for buttons and fallback links.
  - Ensure no auth template uses `siteUrl`, `.SiteURL`, or a static apex URL for the confirmation action.
  - If needed, update any remaining auth templates so signup, magic link, invite, email change, and recovery all use the normalized action URL.
4. Redeploy the active email rendering function
  - Deploy the updated `auth-email-hook` so the backend uses the latest normalization code immediately.
  - Check fresh function logs after deployment to confirm the new diagnostic line appears.
5. Trigger and verify a fresh signup/resend
  - Trigger a new confirmation email using a fresh test address or a resend for the test user.
  - Inspect the outgoing render diagnostics/logs.
  - Confirm the generated confirmation link is now:
  `https://app.carnivorex.app/auth/callback#...`
  and not:
  `https://carnivorex.app/auth/callback#...`
6. Report the verification result safely
  - I will paste the exact host/path and a token-redacted version of the generated link, for example:
   `https://app.carnivorex.app/auth/callback#access_token=[redacted]&refresh_token=[redacted]&type=signup`
  - I will not paste raw access or refresh tokens into chat, because that confirmation link is a live credential.
7. The only refinement I’d suggest is: don’t bundle the “block unconfirmed users” change into the same pass unless they already know exactly how they want that UX to work. It’s a valid improvement, but it’s separate from the broken host issue, so the cleanest path is:
  1. fix auth config + hook diagnostics/rewrite,
  2. verify a fresh email uses `app.carnivorex.app`,
  3. then ship the unconfirmed-login hardening.

Expected outcome:

- Fresh signup emails use the verified App Link host `app.carnivorex.app`.
- Android intercepts `/auth/callback` directly into the installed app.
- Unconfirmed users remain blocked from logging in until the email verification completes.