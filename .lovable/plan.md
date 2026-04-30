# Fix CarnivoreX Auth Email Branding + Android Verification Deep Link

## Current state (verified)

- Email domain `notify.carnivorex.app` is **already verified** in Lovable Cloud — no DNS work needed.
- No `auth-email-hook` edge function exists yet, so signup emails currently go out as default `no-reply@auth.lovable.cloud` with generic "Confirm your signup" copy.
- Capacitor `appId` is `com.mi4labs.carnivorex`, `appName` is `CarnivoreX` — no legacy "Carnivore Coach" strings left in source.
- `AndroidManifest.xml` has **no deep link / App Link intent filter**, so verification links open the browser/web app, never the installed app.
- `signUp()` uses `emailRedirectTo: window.location.origin` — fine for web, wrong for native.

## A. Brand auth emails as CarnivoreX

1. Scaffold Lovable auth email templates (creates `supabase/functions/auth-email-hook/` + 6 React Email templates in `_shared/email-templates/`). Sender will be `CarnivoreX <no-reply@notify.carnivorex.app>`.
2. Restyle the 6 templates with CarnivoreX branding:
   - White email body background, primary button using brand red (read from `src/index.css` `--primary`), Inter font stack.
   - Header: "CarnivoreX" wordmark (text-only — no logo asset needed for v1, keeps emails light).
   - Subject lines: "Verify your CarnivoreX account", "Reset your CarnivoreX password", etc.
   - Footer: "© CarnivoreX · The carnivore lifestyle, simplified."
   - Replace every "Confirm signup / Verify email" CTA with "Activate my CarnivoreX account".
3. Deploy `auth-email-hook` so the Lovable auth pipeline starts using it.

## B. Sender / domain

- Already covered by step A — `notify.carnivorex.app` is verified and will be auto-detected by the scaffold tool. From-name = `CarnivoreX`, reply-to = same. No additional DNS.

## C. Android deep link (App Link) for verification

1. Add a verification redirect route in the SPA: `/auth/callback` that:
   - Reads the recovery / verification tokens from the URL hash.
   - Calls `supabase.auth.getSession()` to materialize the session, then navigates to `/` (or the original `returnTo`).
2. Update `src/contexts/AuthContext.tsx` `signUp()` to use a deep-link-aware redirect:
   ```ts
   emailRedirectTo: Capacitor.isNativePlatform()
     ? "https://carnivorex.app/auth/callback"
     : `${window.location.origin}/auth/callback`
   ```
3. Add Android App Link intent filter in `AndroidManifest.xml` on `MainActivity`:
   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https"
           android:host="carnivorex.app"
           android:pathPrefix="/auth/callback" />
   </intent-filter>
   ```
4. Note for the user: full App Links auto-verify additionally requires a `.well-known/assetlinks.json` hosted on `https://carnivorex.app/` containing the app's SHA-256 cert fingerprint. Until that file is published, Android will show the "Open with…" chooser the first time but will still route into the app once the user picks CarnivoreX. We will document the assetlinks step in the plan output and provide a template file in `public/.well-known/assetlinks.json` with a placeholder for the SHA-256 the user must paste in.
5. Wire Capacitor `App.addListener('appUrlOpen', ...)` in `src/main.tsx` (or a small `useDeepLinks` hook mounted in `App.tsx`) to:
   - Parse the incoming URL.
   - If path starts with `/auth/callback`, push it into the React Router history so `/auth/callback` runs.

## D. App-side session refresh

1. In the new `/auth/callback` page:
   - On mount, `await supabase.auth.refreshSession()` then `getUser()`.
   - If `user.email_confirmed_at` is set, toast "Email verified — welcome to CarnivoreX" and `navigate('/', { replace: true })`.
   - If not yet verified, show a "Refresh verification status" button that re-runs the same flow.
2. In `AuthContext`, also call `supabase.auth.refreshSession()` on Capacitor `App` `resume` event so returning from the browser handoff re-hydrates the session even without hitting `/auth/callback`.

## E. Diagnostics (`[AuthVerify]` prefix)

Add `console.info` logs at:
- `signUp()` — "signup requested email=…, redirect=…"
- `/auth/callback` mount — "deep link hit url=…"
- `appUrlOpen` listener — "native deep link received url=…"
- Before/after `refreshSession()` — "session refresh before verified=… after verified=…"
- App `resume` handler — "app resumed, refreshing session"

## Technical notes

- Files to create: `supabase/functions/auth-email-hook/{index.ts,deno.json}`, `supabase/functions/_shared/email-templates/*.tsx` (6 files via scaffold), `src/pages/AuthCallback.tsx`, `src/hooks/useDeepLinks.ts`, `public/.well-known/assetlinks.json` (placeholder).
- Files to edit: `src/contexts/AuthContext.tsx` (redirect URL, resume listener), `src/App.tsx` (mount `useDeepLinks`, add `/auth/callback` route), `android/app/src/main/AndroidManifest.xml` (intent-filter).
- After edits the user must run `npx cap sync android` and rebuild the APK; the manifest change requires a native rebuild.
- No DB migrations. No new secrets. `LOVABLE_API_KEY` is already provisioned.

## Out of scope

- iOS Universal Links (no iOS deep link work requested).
- Changing onboarding, Health Connect, push, or campaign logic.
- Email logo image (deferred — text wordmark keeps payload light and avoids a storage upload round-trip; can add later).
