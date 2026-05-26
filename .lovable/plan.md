Plan: I will not call this resolved until the native iPhone build shows the UI changes and Apple Sign In works on device.

1. Establish proof from the current repository

- Run and capture the exact requested outputs:
  - `bun pm ls | grep -E "apple-sign-in|capacitor-social-login"`
  - `npx cap sync ios`
  - if sync output or native package state is suspicious, run `npx cap update ios`
  - `grep -R "WKAppBoundDomains\|limitsNavigationsToAppBoundDomains" ios/App/App/Info.plist ios/App/App.xcodeproj ios/App/App 2>/dev/null`
  - grep native project proof for:
    - `CapgoCapacitorSocialLogin` in `ios/App/CapApp-SPM/Package.swift`
    - `CapApp-SPM in Frameworks` in `ios/App/App.xcodeproj/project.pbxproj`
    - `com.apple.developer.applesignin` in `ios/App/App/App.entitlements`
    - `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` in `project.pbxproj`
    - `MainViewController` in storyboard and source
- Current read-only findings already show:
  - only `@capgo/capacitor-social-login@8.3.22` appears in `bun pm ls`
  - no separate `apple-sign-in` package appears
  - `WKAppBoundDomains` is not present in the currently inspected files
  - the Apple entitlement exists
  - the SPM package includes `CapgoCapacitorSocialLogin`
  - the app target links the local `CapApp-SPM` framework

2. Fix native Apple Sign In registration risk

- Inspect the Capgo plugin iOS package after dependency install/sync to confirm its exact native class/product name is present.
- Harden `ios/App/App/MainViewController.swift` so custom local plugins do not accidentally interfere with Capacitor’s normal plugin loading.
- Keep the storyboard pointing at `MainViewController`.
- Keep `ios/App/App/App.entitlements` with `com.apple.developer.applesignin` and verify the Xcode target uses that entitlements file.
- If `WKAppBoundDomains` is still absent, explicitly document that it is not blocking plugin injection. If it exists after sync/update, either remove it or add the required Capacitor domains and `limitsNavigationsToAppBoundDomains` configuration correctly.

3. Make the UI fixes impossible to miss in source diffs

- `Profile → My Feed`:
  - remove article `date` fields from the feed article objects in `src/pages/Profile.tsx`
  - remove any article-date rendering path from Profile feed
  - keep dates only for Progress Milestones if still desired, because those are not article dates
  - show the exact diff after editing
- `NewsFeed`:
  - remove the now-unused `formatDate` helper so article date logic is gone from the daily feed page too
  - show the exact diff after editing
- `Recipe Coach`:
  - change the composer to be fixed/sticky above the iOS safe area so it is visible in the installed app even if the WebView/keyboard viewport behaves differently
  - keep the Pro/Elite gate behavior, but make the input bar visibly present with the locked placeholder for non-Pro users
  - show the exact diff after editing

4. Fix onboarding first-run behavior with versioning

- Onboarding is currently stored in localStorage using:
  - `carnivore-onboarding-complete-v2`
  - `carnivore-onboarding-answers`
  - `carnivore-onboarding-body`
  - related profile keys like `carnivore-health-targets`, `carnivore-cuisines`, `carnivore-meals-per-day`
- The `/` route gates via `isOnboardingComplete()` from `src/pages/Onboarding.tsx`, currently requiring both `carnivore-onboarding-complete-v2 === "true"` and `carnivore-onboarding-answers`.
- A fresh iOS install not showing onboarding likely means the installed binary did not contain the gate change, or iOS/WebKit restored local storage from a previous install/device backup.
- Add a versioned onboarding schema key, for example `carnivore-onboarding-schema-version`, and require it to match the current app onboarding version.
- On first launch, if the schema version is missing/stale, clear only the onboarding completion keys and force `/onboarding`.
- Update the onboarding tests to prove fresh install and stale-version cases return incomplete.

5. Explain why the prior installed iOS build did not show the changes

- The likely reason is build pipeline mismatch: web source changed, but the native iOS app still packaged an older `dist`/Capacitor state because the local checkout was not rebuilt and synced before archiving/installing.
- I will provide the exact local sequence for you to run after pulling:
  - `git pull`
  - `bun install`
  - `bun run build`
  - `npx cap sync ios`
  - open Xcode, clean build folder, install to iPhone
- I will also add a small visible/internal build proof marker if needed so we can confirm the installed iOS app is running the new web bundle, not an older archive.

6. Verification before completion

- Run the requested proof commands and paste their relevant output.
- Show exact changed files and diffs for My Feed, Recipe Coach, onboarding, and native Apple Sign In wiring.
- Provide device-test checklist:
  - delete existing iPhone app
  - install new build from Xcode
  - confirm onboarding appears on first launch
  - confirm Google login still succeeds
  - confirm Apple Sign In opens native Apple sheet and returns a session
  - confirm Profile → My Feed article cards have no dates
  - confirm Recipe Coach input bar is visible
- I will not mark the Apple item complete unless the iPhone test confirms Apple login works.

&nbsp;

User feedback: Proceed with the proof-first plan, but do not change MainViewController.swift unless you can show a concrete registration defect there. For an installed Capacitor plugin, I want you to first prove package inclusion, cap sync ios, absence of WKAppBoundDomains, correct entitlements, and exact source diffs for the UI fixes. Only touch MainViewController.swift if you can show why the installed plugin is failing to register natively