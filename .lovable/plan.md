# Fix iOS Google + Apple sign-in

## Root causes

### Google on iOS — "Safari cannot open the page because the address is invalid"

`src/pages/Auth.tsx` (line 197) passes `redirectTo: "carnivorex://callback"` to Supabase for all native platforms, then opens the resulting Google OAuth URL in the in-app browser. When Google finishes auth and 302-redirects to `carnivorex://callback#access_token=…`, iOS looks up which app owns the `carnivorex` scheme and finds **none** — `ios/App/App/Info.plist` has **no `CFBundleURLTypes` entry** registering the scheme. Safari/SFSafariViewController then renders the literal text "Safari cannot open the page because the address is invalid." Android works because the scheme is declared in `AndroidManifest.xml`; the iOS side was never wired.

### Apple on iOS — generic "Apple sign-in failed" toast

Two issues stack:

1. `App.entitlements` has `com.apple.developer.applesignin` in the file, but the **Xcode capability has not been added** to the App target in the project (no `SystemCapabilities` block for Apple Sign In in `project.pbxproj`). Without enabling the capability in Xcode and re-signing, iOS rejects `ASAuthorizationAppleIDProvider` at runtime — the plugin's `authorize()` throws, lands in the `catch` block (line 171), and the catch handler shows the hard-coded string `"Apple sign-in failed"` **without** including `err.message`, so the real reason ("The operation couldn't be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)" or similar) is invisible.
2. Even after #1 is fixed, `supabase.auth.signInWithIdToken({ provider: "apple", token, nonce })` will reject with `"Unacceptable audience in id_token: [com.mi4labs.carnivorex]"` unless the iOS Bundle ID is added to Supabase Auth → Providers → Apple → **Client IDs** (comma-separated list, in addition to the Services ID if any).

## Code changes

### 1. `ios/App/App/Info.plist` — register the custom scheme

Add inside `<dict>`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.mi4labs.carnivorex.oauth</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>carnivorex</string>
    </array>
  </dict>
</array>
```

This single change fixes the Google "invalid address" error. The existing `useDeepLinks` hook already parses `carnivorex://callback#...` correctly via `normalizeAuthCallbackUrl`, so no JS routing change is needed.

### 2. `src/pages/Auth.tsx` — surface real errors + add the requested diagnostic tags

- In the Apple native branch, change the catch fallback from `"Apple sign-in failed"` to `err.message || err.code || "Apple sign-in failed"` (skip when message matches `/cancel/i`).
- In the same branch, also log `oauth:apple-native-start` before `SignInWithApple.authorize`, and `oauth:apple-idtoken-start` before `signInWithIdToken`.
- In the Google/native branch, add `oauth:google-start` (before `signInWithOAuth`), `oauth:google-url` (with redacted URL before `Browser.open`), `oauth:google-callback` (emit from the deep-link handler when path is `/callback` and provider was Google — gate on a small module flag set when Google is launched), and ensure the existing failure path emits `oauth:google-error` with `error.message`.

No business-logic changes — only logging and the toast message fallback.

## Manual dashboard steps (you must do these)

**Xcode (required for Apple):**

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Select the `App` target → Signing & Capabilities → `+ Capability` → **Sign In with Apple**. Save. Commit the `project.pbxproj` change.

**Apple Developer portal (required for Apple):**

- App ID `com.mi4labs.carnivorex` → enable **Sign In with Apple** capability → regenerate the provisioning profile.

**Supabase dashboard (required for Apple):**

- Auth → Providers → Apple → **Client IDs**: add `com.mi4labs.carnivorex` (comma-separate if a Services ID is already listed). No Secret Key / Team ID / Key ID needed for the native iOS-only flow.

**Supabase dashboard (required for Google on iOS):**

- Auth → URL Configuration → Redirect URLs: confirm `carnivorex://callback` is in the allowlist (it should already be, per the inline comment in `Auth.tsx`; verify it's actually saved).

## Rebuild

Yes, a full native rebuild is required after the Info.plist change and the Xcode capability addition:

```
git pull
npm install
npx cap sync ios
cd ios/App && pod install && cd ../..
npx cap open ios
```

In Xcode: Product → Clean Build Folder → Run on device.

## Verification (after rebuild)

Watch device console for:

- Google: `oauth:google-start` → `oauth:google-url` → (after Google redirect) `deeplink:appUrlOpen` with `carnivorex://callback#…` → `oauth:google-callback` → session set.
- Apple: `oauth:apple-native-start` → `oauth:apple-native-result {hasIdToken:true}` → `oauth:apple-idtoken-start` → no error → navigate to `returnTo`.
- If Apple still fails, the toast will now show the **actual** plugin/Supabase error message instead of the generic string, which tells us whether the issue is the Xcode capability or the Supabase Client IDs config.

## Files changed

- `ios/App/App/Info.plist`
- `src/pages/Auth.tsx`
- `src/hooks/useDeepLinks.ts` (only to emit `oauth:google-callback` when a Google flow is in progress)

Approved. Proceed with the code changes exactly as planned for:

ios/App/App/Info.plist

src/pages/Auth.tsx

src/hooks/useDeepLinks.ts

Two notes:

Do not include CocoaPods steps in the rebuild instructions — this project is using SPM.

After code changes, I will manually do:

Xcode → add Sign In with Apple capability to the App target,

Apple Developer → enable Sign In with Apple on App ID and refresh provisioning,

Supabase → add com.mi4labs.carnivorex to Apple Client IDs,

Supabase → verify carnivorex://callback is in Redirect URLs.

Please proceed and then confirm the final files changed and whether any other iOS plist or scheme registration was touched.