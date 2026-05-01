## Problem

Logs confirm `oauth:redirect-uri = carnivorex://auth/callback` and `oauth:signIn-result.redirected = true` — the browser opens Google consent — but `deeplink:appUrlOpen` never fires. Cause: Android has no intent-filter registered for the `carnivorex://` custom scheme, so the OS doesn't know to route that URL back to MainActivity. The current manifest only handles HTTPS App Links for `app.carnivorex.app`.

A second contributing issue: `strings.xml` sets `custom_url_scheme` to `com.mi4labs.carnivorex` (the package name). Capacitor's auto-generated scheme handling reads this string; it must match the scheme we actually use (`carnivorex`).

## Changes

### 1. `android/app/src/main/AndroidManifest.xml`

Add a new, separate `<intent-filter>` block inside the MainActivity `<activity>` (do NOT merge it with the existing https App Link filter — combining schemes in one filter breaks autoVerify).

Insert this block right after the existing `autoVerify="true"` https intent-filter:

```xml
<!-- Custom scheme deep link for OAuth callback (Google sign-in) -->
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="carnivorex" android:host="auth" />
</intent-filter>
```

Final intent-filter section of MainActivity will contain (in order):
1. MAIN / LAUNCHER
2. Health Connect rationale (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`)
3. https App Link with `autoVerify="true"` for `app.carnivorex.app` (`/auth/callback`, `/reset-password`) — unchanged
4. **NEW** custom scheme `carnivorex://auth/...`

### 2. `android/app/src/main/res/values/strings.xml`

Change:
```xml
<string name="custom_url_scheme">com.mi4labs.carnivorex</string>
```
To:
```xml
<string name="custom_url_scheme">carnivorex</string>
```

Leave `package_name` (`com.mi4labs.carnivorex`) and `app_name` unchanged.

### 3. `src/main.tsx`

Bump the build marker:
- `authFlow=v4-custom-scheme` → `authFlow=v5-manifest-fix`

### 4. `scripts/build-android-fresh.sh`

Update `REQUIRED_MARKERS` (line 70):
- `"authFlow=v4-custom-scheme"` → `"authFlow=v5-manifest-fix"`

Also update the post-install hint strings (lines 240) so they reference `v5-manifest-fix`.

## Why this works

- The new intent-filter tells Android: "When any app (including Chrome Custom Tabs returning from Google's OAuth redirect) launches a `carnivorex://auth/...` URL, deliver it to MainActivity." Capacitor's `App` plugin then fires the `appUrlOpen` event, which `useDeepLinks` already routes to `/auth/callback`, where `AuthCallback.tsx` calls `exchangeCodeForSession`.
- `singleTask` launchMode (already set) ensures the existing app instance receives the intent rather than spawning a new one.
- The string-resource fix prevents Capacitor's bridge from advertising the wrong scheme to itself.

## Post-deploy verification

After running `npm run apk:fresh:debug` and reinstalling, expect logs to show:
```
[BuildInfo] ... authFlow=v5-manifest-fix
[AuthVerify] oauth:click ...
[AuthVerify] oauth:redirect-uri {"redirectTo":"carnivorex://auth/callback"}
[AuthVerify] oauth:signIn-result {... redirected:true}
[AuthVerify] deeplink:appUrlOpen {"redacted":"carnivorex://auth/callback?code=[redacted:...]"}
[AuthVerify] deeplink:received {"source":"live","pathname":"/auth/callback", ...}
[AuthVerify] oauth:exchange-call ...
[AuthVerify] oauth:exchange-result {"hasSession":true, ...}
```

The critical new line is `deeplink:appUrlOpen` arriving within ~1s of returning from the browser. If it still does not fire after this fix, Supabase's allowlist for `carnivorex://auth/callback` must be confirmed (Authentication → URL Configuration → Redirect URLs).

## Files touched
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/values/strings.xml`
- `src/main.tsx`
- `scripts/build-android-fresh.sh`
