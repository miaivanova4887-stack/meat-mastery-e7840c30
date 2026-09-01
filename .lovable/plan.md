# Permanent fix: Google sign-in must return into the app, not Chrome

## What the screenshot proves

After approving Google, the phone stays in a Chrome tab on `…carnivorex.app`
and renders the web app's onboarding (step 1/12). So the callback URL was
handled by the browser, and the native app never received the session.

## Why this keeps happening (root cause)

The current native flow asks the auth server to redirect to
`https://aos.carnivorex.app/auth/callback` and opens the Google URL in an
in-app browser tab (`@capacitor/browser` → Chrome Custom Tab).

Android does **not** hand an HTTPS App Link back to the app that opened the
Custom Tab. A verified App Link is only routed to the app when the navigation
comes from *another* app/context. Inside your own Custom Tab session, Chrome
keeps the URL and loads the web page — exactly what the screenshot shows.
Confirmed in the code: `src/pages/Auth.tsx:234-278` (https redirect +
`Browser.open`), and the App Link filter in
`android/app/src/main/AndroidManifest.xml:50-66`.

The custom scheme (`carnivorex://callback`) cannot be used as the auth-server
redirect, because that allow-list rejects non-public-TLD schemes and wildcards
(documented in the earlier attempt notes). So neither end works alone.

## The permanent fix: an HTTPS bridge page that hands off to the app

Keep the auth server's redirect on the allowed HTTPS URL, but make that page
immediately bounce to the app's custom scheme. A **page-initiated navigation to
a custom scheme is delivered to the app by Chrome**, which is the hop the
current flow is missing.

Flow after the fix:

```text
app → Custom Tab → Google → https://aos.carnivorex.app/auth/callback?code=…
                                   ↓ (bridge, native flow only)
                            carnivorex://callback?code=…
                                   ↓ appUrlOpen
                     app WebView /auth/callback → PKCE exchange → signed in
```

### Changes

1. **New bridge route** `/auth/native-callback` (static HTML in `public/`, so it
   loads instantly with no React boot):
   - reads the full query/hash it was given
   - navigates to `carnivorex://callback` + the same query/hash
   - shows a plain "Returning to CarnivoreX…" line plus a manual
     "Open CarnivoreX" link as fallback if the automatic hop is blocked.
2. **`src/pages/Auth.tsx`** — native Google `redirectTo` becomes
   `https://aos.carnivorex.app/auth/native-callback`; web stays
   `${origin}/auth/callback`. Auth-server allow-list already covers the host.
3. **`src/pages/AuthCallback.tsx`** — no logic change needed; it already accepts
   `carnivorex://callback?code=…` handoffs and runs the PKCE exchange in the
   app WebView where the verifier lives.
4. **`src/hooks/useDeepLinks.ts`** — verify `carnivorex://callback` with a
   `?code=` query (not just a `#` fragment) fingerprints and routes correctly;
   adjust `callbackFingerprint`/`normalizeAuthCallbackUrl` only if the code path
   shows a gap.
5. **Manifest** — the `carnivorex` scheme filter already exists
   (`AndroidManifest.xml:71-77`); keep the https App Link filter for email
   verification and password reset, which are cross-app navigations and do
   work.
6. **Safety net** — if the bridge is opened on desktop/web (no app installed),
   fall through to `/auth/callback` on the same origin after ~1.5s so nobody is
   stranded.

### Why this is permanent

- No dependency on Android App Link verification for the OAuth hop, so it
  cannot regress when fingerprints, Play signing, or `assetlinks.json` change.
- No dependency on the auth server accepting custom schemes.
- Works on debug builds, Play-signed builds, and every Android version.

## Verification (evidence-first, on your Mac)

Rebuild is required (web assets change; manifest unchanged).

```bash
cd ~/Desktop/carnivorex-android
```
```bash
git pull origin main
```
```bash
npm run apk:fresh:debug
```
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
```bash
adb logcat -c && adb logcat -v time | grep -E 'oauth:|deeplink:|callback:'
```

Then tap **Continue with Google**. Expected log sequence:

```text
oauth:redirect-uri {"redirectTo":"https://aos.carnivorex.app/auth/native-callback"}
deeplink:appUrlOpen  carnivorex://callback?code=…
deeplink:received    "normalizedPath":"/auth/callback","isAuthRoute":true
oauth:exchange-call / oauth:exchange-result {"hasSession":true}
```

Pass criteria: the Chrome tab closes itself and the app shows you signed in —
no web page with onboarding.
