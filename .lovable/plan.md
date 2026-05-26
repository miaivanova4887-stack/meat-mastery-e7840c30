# Migrate Apple Sign In to @capgo/capacitor-social-login

## Why

- `@capacitor-community/apple-sign-in@7.1.0` pins `capacitor-swift-pm` to 7.x.
- `capacitor-native-settings@8.1.0` requires `capacitor-swift-pm` 8.0.2+.
- App is on Capacitor 8.3.x. Result: Xcode SPM resolution fails, blocking iOS archive/upload.
- Apple requires Sign in with Apple whenever Google sign-in is offered, so we must keep it working — just on a Capacitor‑8‑compatible plugin.

## Outcome

- Xcode resolves Swift packages without conflict.
- iOS device build succeeds, archive can be uploaded to App Store Connect.
- Sign in with Apple still authenticates against Supabase end‑to‑end with the same nonce + `signInWithIdToken` flow we use today.
- Zero references to the old package remain.

## Files / areas affected

1. `package.json` + lockfile — remove old plugin, add `@capgo/capacitor-social-login`.
2. `ios/App/CapApp-SPM/Package.swift` — replace `CapacitorCommunityAppleSignIn` entry with `CapgoCapacitorSocialLogin` (path into its iOS SPM package under `node_modules/@capgo/capacitor-social-login`).
3. `src/pages/Auth.tsx` — replace the import and the `SignInWithApple.authorize(...)` call site with the new `SocialLogin` API; preserve raw/hashed nonce, scopes `email name`, error/cancel handling, diagnostics logs, and the existing `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })` exchange.
4. `ios/App/App/Info.plist` — no functional change required for native Apple Sign In (entitlement carries it), but verify nothing references the old plugin.
5. `ios/App/App/App.entitlements` — already has `com.apple.developer.applesignin` → keep as is.
6. `capacitor.config.json` — add the small `SocialLogin` plugin config block (Apple `clientId = com.mi4labs.carnivorex`, no Google block on iOS; we keep Google on web/Android via the existing path).
7. Search the repo for any remaining `apple-sign-in` / `SignInWithApple` strings and remove them (none expected outside the spots already found).

## New auth call shape (Auth.tsx)

```ts
import { SocialLogin } from '@capgo/capacitor-social-login';

// once, before first login (idempotent):
await SocialLogin.initialize({
  apple: { clientId: 'com.mi4labs.carnivorex' },
});

const rawNonce = crypto.randomUUID();
const hashedNonce = await sha256Hex(rawNonce);

const res = await SocialLogin.login({
  provider: 'apple',
  options: { scopes: ['email', 'name'], nonce: hashedNonce, state: rawNonce },
});

const idToken = res.result?.idToken;
await supabase.auth.signInWithIdToken({ provider: 'apple', token: idToken!, nonce: rawNonce });
```

All existing diagnostics (`oauth:apple-native-start`, `oauth:apple-native-result`, `oauth:apple-idtoken-*`, `oauth:apple-native-threw`) and the cancel‑swallowing branch stay.

## Verification steps (run after switching to build mode)

1. `bun remove @capacitor-community/apple-sign-in`
2. `bun add @capgo/capacitor-social-login`
3. `bun run build`
4. `npx cap sync ios`
5. In Xcode: File → Packages → Reset Package Caches, then Resolve Package Versions. Confirm no `capacitor-swift-pm` version conflict.
6. Build to a physical iOS device, tap “Continue with Apple”, complete flow, confirm Supabase session lands and app navigates to `returnTo`.
7. `rg -n "apple-sign-in|SignInWithApple"` returns no matches outside lockfile history.

## Manual steps you (the user) must do

- **Apple Developer portal**: confirm the App ID `com.mi4labs.carnivorex` still has the **Sign In with Apple** capability enabled (already in `App.entitlements`, but the portal capability must match).
- **Supabase → Auth → Providers → Apple**: ensure the iOS bundle ID `com.mi4labs.carnivorex` is listed under Client IDs (no change from today’s setup).
- **App Store Connect**: no plugin‑specific config — just archive & upload once the Xcode build passes.
- Open the Xcode workspace once after `cap sync ios` so SPM re‑resolves; if it still shows the cached failure, do Product → Clean Build Folder.

## User feedback:

Amend the plan: Google Auth cannot be treated as out of scope because it has already been looping repeatedly in prior iOS attempts. After migrating Apple Sign In to @capgo/capacitor-social-login, you must also audit and verify the entire iOS auth flow for both Apple and Google, including initialization order, provider selection logic, callback/deep-link handling, nonce/state handling where applicable, Supabase signInWithIdToken() usage, post-login navigation, and any shared auth guards or retry logic. Do not assume Google is unaffected just because only Apple package code is being replaced. 

Revise the implementation plan so it does not declare Google Auth out of scope. Google login has already looped across multiple prior iOS attempts, so after replacing @capacitor-community/apple-sign-in with @capgo/capacitor-social-login, you must run a full iOS auth regression for both Apple and Google. Identify any shared code paths, plugin initialization, deep-link/callback handling, Supabase token exchange logic, and redirect/navigation logic that could cause looping. Add instrumentation, fix any loop discovered, and only mark the task complete when both Apple and Google login succeed on iPhone and land in the authenticated app state without repeated redirects.

## Out of scope

- No changes to deep‑link/callback code, or the unrelated `AUTH_FLOW_BUILD v11` proof instrumentation already in place.