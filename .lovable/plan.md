# Fix Google `redirect_uri_mismatch`

## Confirmed diagnosis

The attached Google screen reports:

```text
Error 400: redirect_uri_mismatch
```

The prior authorization test successfully returned `302` to Google, so the app and Lovable Cloud auth provider are now reaching Google. Google is rejecting the callback URL configured for the OAuth client.

## Fix

1. Open the Google Cloud project that owns the OAuth client currently used by CarnivoreX.
2. Open **APIs & Services → Credentials** and select that OAuth 2.0 **Web application** client.
3. Under **Authorized redirect URIs**, add this exact URL:

```text
https://ygdhelkdwjkggyosepny.supabase.co/auth/v1/callback
```

4. Preserve every character exactly: HTTPS, project hostname, `/auth/v1/callback`, and no extra trailing slash.
5. Save the OAuth client and allow a few minutes for Google’s configuration to propagate.
6. Close the failed Google browser tab, fully close CarnivoreX, reopen it, and retry **Continue with Google**.
7. If it still fails, open **error details** on Google’s error page and compare its displayed `redirect_uri` character-for-character with the URI above; add the displayed URI if Google reports a different callback.

## Rebuild/publish decision

- **Android rebuild:** Not required.
- **Lovable publish/update:** Not required.
- **Code changes:** None.
- The correction is entirely in the Google OAuth client configuration and takes effect for the already-installed APK and published web app.

## Verification

A successful retry should proceed past Google’s account/consent screen and return to CarnivoreX. If the app then fails to reopen or establish a session, capture that new screen or Android log; that would be a separate callback/deep-link issue after the current Google configuration error is resolved.
