## Goal

Serve this app (and its `assetlinks.json`) at **`app.carnivorex.app`**, while leaving the marketing site untouched at `carnivorex.app`. Update the Android App Link host to match, so deep-link verification succeeds.

## Why

A Lovable domain can only point to one project. `carnivorex.app` is already serving the marketing project, which is why `/.well-known/assetlinks.json` returns 404 here. Using a dedicated subdomain cleanly separates concerns and is the standard pattern (Google, Notion, Linear all do this).

## Steps

### 1. Code changes in this project

**`android/app/src/main/AndroidManifest.xml`** — change the App Link host:
```xml
<data android:scheme="https"
      android:host="app.carnivorex.app"
      android:pathPrefix="/auth/callback" />
```

**`src/hooks/useDeepLinks.ts`** — update any hardcoded `carnivorex.app` host check to `app.carnivorex.app` (verify and adjust).

**`src/contexts/AuthContext.tsx`** — if `emailRedirectTo` / `redirectTo` URLs reference `https://carnivorex.app/...`, update them to `https://app.carnivorex.app/...`.

**Supabase auth redirect allow-list** — add `https://app.carnivorex.app/**` (and the `/auth/callback` path) under Auth → URL Configuration. Site URL stays as the app URL.

**Email templates / `_brand.ts`** — update any `appUrl` constant from `carnivorex.app` to `app.carnivorex.app` so verification links open the app, not the marketing site.

`public/.well-known/assetlinks.json` — no content change needed (the SHA-256 fingerprint stays the same; only the *serving host* changes).

### 2. Domain connection (user action, in Lovable UI)

1. Open **Project Settings → Domains** in **this** project.
2. Click **Connect Domain**, enter `app.carnivorex.app`.
3. At your DNS provider (or Lovable DNS manager if `carnivorex.app` was bought through Lovable), add the records Lovable shows — typically an `A` record `app → 185.158.133.1` plus the `_lovable` TXT verification record.
4. Wait for status to flip to **Active**, then click **Publish** in this project.

### 3. Verification

After republish:
- `curl -i https://app.carnivorex.app/.well-known/assetlinks.json` → must return `HTTP 200` with `content-type: application/json`.
- `curl -i https://carnivorex.app/` → still serves marketing site unchanged.
- Rebuild and reinstall the Android APK (the manifest changed). Android verifies App Links against the new host on install.
- Test the email-verification deep link: tapping the link in a verification email on a device with the app installed should open the app at `/auth/callback`, not the browser.

### 4. Memory update

Update `mem://features/auth/verification-deep-link` to record the new host (`app.carnivorex.app`).

## Out of scope

- No changes to the marketing project.
- No changes to the Android package name, keystore, or SHA-256 fingerprint.
- Push-notification (FCM) config is unaffected.
