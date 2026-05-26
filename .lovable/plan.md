## Root cause

Google is no longer failing because the redirect URI is invalid. The callback is now arriving and `setSession()` succeeds, but the app processes the same `carnivorex://callback#access_token=...` launch URL repeatedly. `useDeepLinks()` calls `CapApp.getLaunchUrl()` every time the React tree remounts/re-renders through the callback flow, and the iOS launch URL remains available, so the app navigates to `/callback` again and again. `AuthCallback` then repeatedly calls `window.history.replaceState()`, eventually triggering iOS WebKit’s limit: `Attempt to use history.replaceState() more than 100 times per 10 seconds`.

Apple is separately failing because the JS imports `@capacitor-community/apple-sign-in`, but the native iOS SPM package does not include `CapacitorCommunityAppleSignIn`. That matches the device toast: `"SignInWithApple" plugin is not implemented on ios`. The dependency exists in `package.json`, but it has not been synced into `ios/App/CapApp-SPM/Package.swift`.

## Plan

1. Harden native deep-link handling against duplicate callbacks
  - Add a small module-level dedupe cache in `src/hooks/useDeepLinks.ts`.
  - Process `CapApp.getLaunchUrl()` only once per app runtime, not on every callback remount.
  - Ignore duplicate auth callback URLs with the same token/hash for a short TTL.
  - Avoid calling `Browser.close()` repeatedly when no browser window is active.
2. Make `AuthCallback` idempotent
  - Add a callback fingerprint guard so the same OAuth token callback cannot run `setSession()` multiple times.
  - Replace direct repeated `history.replaceState()` calls with a safe helper that only cleans the URL if it still contains auth params.
  - End the callback guard before returning on every successful branch.
3. Fix the missing iOS Apple native plugin registration
  - Update `ios/App/CapApp-SPM/Package.swift` to include `@capacitor-community/apple-sign-in` as an SPM dependency and target product.
  - This is the concrete cause of `SignInWithApple plugin is not implemented on ios`.
4. Update the build fingerprint text
  - Update the dev-only auth flow tag in `src/main.tsx` so future device logs prove the new callback dedupe build is installed.

## Files to change

- `src/hooks/useDeepLinks.ts`
- `src/pages/AuthCallback.tsx`
- `src/main.tsx`
- `ios/App/CapApp-SPM/Package.swift`

## Manual steps after implementation

- Run `npm install` if needed, then sync native files: `npx cap sync ios`.
- Open Xcode and verify the App target still has Sign In with Apple capability enabled.
- Rebuild/reinstall the iOS app; this fix requires a new native build because the iOS SPM plugin list changes.

## Expected result

- Google: one callback is processed, one session is installed, then the app navigates away without the `replaceState` crash.
- Apple: the native plugin is present on iOS, so the flow reaches Apple’s authorization sheet instead of throwing `plugin is not implemented on ios`.

Status update from device test:

Google OAuth is working through to callback:setSession-success.

The remaining Google issue is a callback loop causing repeated deeplink/callback handling and a history.replaceState() rate-limit crash.

Apple still fails with: "SignInWithApple" plugin is not implemented on ios.

Please fix:

Prevent Google callback from being handled more than once.

Ensure the Apple native plugin is actually linked into the iOS build.

Return:

exact root cause of the callback loop,

exact root cause of the Apple plugin issue,

exact files changed,

and whether I need to fully delete/reinstall the iOS app before retesting.