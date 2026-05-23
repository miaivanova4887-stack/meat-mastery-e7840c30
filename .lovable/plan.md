# iOS App Store Release Readiness — Audit (iOS app build only)

Scope: the Capacitor iOS shell at `ios/App/` and the shared web bundle it loads. Marketing site, Play Store badges, and external download links are out of scope per your clarification.

---

## 1. App Store deep link inside the iOS app

- ✅ **"Manage in App Store" deep link exists** — `src/pages/Pricing.tsx:329` opens `https://apps.apple.com/account/subscriptions` when the user is on a RevenueCat-sourced subscription. Correct pattern for iOS subscription management.
- No other App Store badge/link needed inside the iOS app itself (an already-installed app doesn't need a "download" badge).

## 2. RevenueCat & Subscriptions

- ✅ **iOS SDK key configured** — `src/lib/revenuecat.ts:42` (`REVENUECAT_IOS_KEY = "appl_…"`).
- ✅ **Init / identify / logout wired correctly** — `src/contexts/SubscriptionContext.tsx:47-60`: anonymous `initRevenueCat(null)` first, then `initRevenueCat(user.id)` + `identifyUser(user.id)` on sign-in, `logoutUser()` on sign-out. This is the right anon→identified handoff and prevents entitlement leakage between accounts on the same device.
- ⚠️ **Product/package identifiers** — `findPackage()` in `src/lib/revenuecat.ts:236` looks up packages by the exact key `pro_monthly` / `pro_yearly` / `elite_monthly` / `elite_yearly` (with underscores). Your checklist wrote them without underscores (`promonthly`, etc.). The App Store Connect **product ID** can be anything (e.g. `com.mi4labs.carnivorex.pro.monthly`), but the **RevenueCat dashboard package identifier** must equal `pro_monthly` / `pro_yearly` / `elite_monthly` / `elite_yearly` or the paywall will show "Unavailable". Verify in the RC dashboard before submission.
- ✅ **Restore Purchases button present and gated to native** — `src/pages/Pricing.tsx:386-403` (`useNative` gate, calls `paywall.restore()`). Apple requires this on any app with non-consumable IAP/subscriptions. ✅.
- ✅ **Auto-renew disclosure copy** — Shown beneath Restore Purchases on the Pricing page.
- ❌ **Blocker — Privacy Policy / Terms of Use links missing on the paywall.** Apple Review consistently rejects subscription apps that don't surface BOTH links **on the paywall screen itself**, adjacent to the auto-renew copy. `src/pages/Pricing.tsx` currently shows the disclosure but no `Privacy Policy` / `Terms of Use` links. This is the single most common rejection reason for subscription apps.

## 3. Authentication on iOS

- ✅ **Email/password + Google OAuth** work in the Capacitor WebView. Need to add  sign in with Apple authorization
- ✅ **RC anonymous → identified transition** — see §2.
- ❌ **Blocker — Sign in with Apple not implemented.** Apple requires "Sign in with Apple" on any iOS app that offers third-party social login (you have Google). Grep for `signInWithApple` / `provider: 'apple'` returns nothing. Add `@capacitor-community/apple-sign-in` (or use Supabase's Apple provider through ASAuthorizationController) and surface the button in `src/pages/Auth.tsx` alongside Google.

## 4. iOS-Specific Build Requirements

- ✅ **Capacitor iOS platform configured** — `ios/App/App.xcodeproj`, `MainViewController.swift`, SPM `Package.resolved` present.
- ✅ **Bundle ID consistent** — `com.mi4labs.carnivorex` in `capacitor.config.json` and `ios/App/App.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`). Matches Android.
- ✅ **ATS** — No `NSAppTransportSecurity` override in `ios/App/App/Info.plist`. Default ATS (HTTPS only) applies. Supabase, RevenueCat, Stripe, Cal.com all use HTTPS — not blocked.
- ✅ **Privacy usage strings** — Camera, Mic, Speech Recognition, Health (Share + Update), Photo Library all set in `Info.plist` with clear, App-Review-friendly descriptions.
- ⚠️ **HealthKit entitlement** — `ios/App/App/App.entitlements` enables HealthKit (`com.apple.developer.healthkit`). Required for Apple Health reads. Make sure the App ID in App Store Connect / Developer Portal has the HealthKit capability enabled, otherwise the IPA upload will be rejected at validation.
- ⚠️ **Android-only plugins / native code** — repo-wide check:
  - **Health Connect (Android Kotlin plugin)** → ✅ iOS counterpart exists at `ios/App/App/HealthConnectPlugin.swift` (HealthKit bridge). Both registered in `MainViewController.swift:capacitorDidLoad()`.
  - `**capacitor-native-settings**` (Android settings deep link) → iOS supports limited prefs URLs only. Audit any caller of `openAppSettings` (`src/lib/openAppSettings.ts`) to make sure iOS doesn't unconditionally invoke an Android-specific intent.
  - **FCM / Firebase push** → `NATIVE_FCM_ENABLED = false` (`src/lib/pushNativeConfig.ts`). iOS uses APNs, not FCM-native. **No APNs configuration exists** in the iOS project today (`AppDelegate.swift` has no `didRegisterForRemoteNotificationsWithDeviceToken`, no `aps-environment` entitlement). Two options: ship v1 without iOS push, or add APNs + upload the APNs auth key to RevenueCat/your provider and wire registration.
  - **Speech recognition** (`capacitor-community-speech-recognition`) → iOS supported. ✅
  - **Text-to-speech** (`capacitor-community-text-to-speech`) → iOS supported. ✅
  - **RevenueCat** → iOS ✅.
- ❌ **Blocker — App Icon set is incomplete.** `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` ships **only the 1024×1024 marketing icon** (`AppIcon-512@2x.png`). Modern Xcode tolerates this (it derives smaller sizes), but you'll get App Store Connect warnings, and on older devices/installs the icon will look poor. Add the full set or at minimum confirm the upload validates without rejection.
- ⚠️ **Launch Screen** — `LaunchScreen.storyboard` uses a single `Splash` image. Splash imageset references `splash-2732x2732-2.png`, `-1.png`, `splash-2732x2732.png` — confirm those files actually exist on disk (not shown in the prompt).
- ⚠️ `**CAPACITOR_DEBUG**` — `ios/debug.xcconfig` sets `CAPACITOR_DEBUG = true`. Make sure the Release configuration uses `false` (the standard Capacitor template handles this via the xcconfig split — verify in Xcode Build Settings before archiving).
- ⚠️ **Deployment target / orientations** — `Info.plist` lists iPhone-only (`UIRequiredDeviceCapabilities = armv7`, `LSRequiresIPhoneOS = true`) but `UISupportedInterfaceOrientations~ipad` is set, implying iPad support. If you intend iPhone-only (matches Android phone-portrait-lock memory), drop the `~ipad` key and set "iPhone" as the only target device family in Xcode. If you want iPad, you'll need iPad screenshots in App Store Connect.

## 5. Legal & Privacy (inside the iOS app)

- ✅ **Privacy / Terms / Disclaimer pages exist** — `src/pages/LegalPage.tsx` mounted at `/privacy`, `/terms`, `/disclaimer` in `src/App.tsx:186-188`.
- ⚠️ **Linkage is sparse** — only `src/components/ConsentBanner.tsx:137` links to `/privacy`. There is **no persistent in-app entry** to Privacy / Terms from Profile or Settings. Apple Review wants both reachable inside the app at any time. Add links to `src/pages/Profile.tsx` (Settings section).
- ❌ **Blocker — Privacy / Terms not on the Pricing/paywall screen.** Same point as §2; calling it out under Legal too because it's both a Legal and an IAP-policy requirement.
- ⚠️ **App Privacy "Nutrition Label"** — must be filled in App Store Connect before submission, declaring: Email/Name (account), Health & Fitness data (HealthKit), Purchases (RevenueCat), Usage Data (analytics), Identifiers (anonymous user IDs). Not a code task, but a release-blocking checklist item.

---

## Summary Scorecard (iOS-only)


| Area                                   | Status                             | Where                                                          |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| App Store subscription deep link       | ✅                                  | `src/pages/Pricing.tsx:329`                                    |
| RC iOS key configured                  | ✅                                  | `src/lib/revenuecat.ts:42`                                     |
| RC anon→identified flow                | ✅                                  | `src/contexts/SubscriptionContext.tsx:47-60`                   |
| RC package identifiers match dashboard | ⚠️ Verify                          | `src/lib/revenuecat.ts:236`                                    |
| Restore Purchases button               | ✅                                  | `src/pages/Pricing.tsx:386`                                    |
| Auto-renew disclosure copy             | ✅                                  | `src/pages/Pricing.tsx`                                        |
| Privacy/Terms links **on paywall**     | ❌ Blocker                          | `src/pages/Pricing.tsx`                                        |
| Sign in with Apple                     | ❌ Blocker                          | missing in `src/pages/Auth.tsx`                                |
| Capacitor iOS configured               | ✅                                  | `ios/App/...`                                                  |
| Bundle ID consistent                   | ✅                                  | `com.mi4labs.carnivorex`                                       |
| ATS                                    | ✅                                  | default (no override in Info.plist)                            |
| iOS Info.plist usage strings           | ✅                                  | `ios/App/App/Info.plist`                                       |
| HealthKit entitlement                  | ✅ (verify App ID capability)       | `App.entitlements`                                             |
| Health Connect → iOS counterpart       | ✅                                  | `ios/App/App/HealthConnectPlugin.swift`                        |
| iOS push (APNs)                        | ⚠️ Missing if you want push on iOS | `AppDelegate.swift`, no APNs entitlement                       |
| App Icon set complete                  | ❌ Blocker (validate before upload) | `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` |
| Splash assets present                  | ⚠️ Verify files on disk            | `Splash.imageset`                                              |
| CAPACITOR_DEBUG off in Release         | ⚠️ Verify in Xcode                 | `ios/debug.xcconfig`                                           |
| iPhone-only vs iPad target             | ⚠️ Decide                          | `Info.plist`                                                   |
| Privacy/Terms/Disclaimer pages exist   | ✅                                  | `src/pages/LegalPage.tsx` + routes                             |
| Persistent in-app links to Legal       | ⚠️ Only on ConsentBanner           | add to `src/pages/Profile.tsx`                                 |
| App Privacy nutrition label in ASC     | ⚠️ Manual                          | App Store Connect                                              |


## Recommended fixes (priority order)

1. **Add Privacy + Terms links to `src/pages/Pricing.tsx**` under the auto-renew copy. (Hard App Review blocker.)
2. **Add "Sign in with Apple"** to `src/pages/Auth.tsx` and enable the Apple provider in Supabase (`supabase--configure_social_auth`). (Hard App Review blocker — required whenever a third-party social login is offered.)
3. **Generate the full iOS App Icon set** (20pt/29pt/40pt/60pt @2x/@3x plus 1024 marketing) and update `Contents.json`. (App Store Connect validation blocker.)
4. **Verify RevenueCat dashboard package identifiers** are exactly `pro_monthly` / `pro_yearly` / `elite_monthly` / `elite_yearly`. (Silent paywall failure otherwise.)
5. **Add persistent Privacy / Terms links inside Profile/Settings.**
6. **Decide on iPhone-only vs iPad** and align `Info.plist` + Xcode target.
7. **APNs**: ship v1 without iOS push to unblock release, then add APNs key + registration as a follow-up.
8. **Confirm `CAPACITOR_DEBUG` is `false` in the Release xcconfig** before archiving.

**In** `src/pages/Pricing.tsx`**, directly below the auto-renew disclosure text (around line 404), add two inline text links side by side: "Privacy Policy" routing to** `/privacy` **and "Terms of Use" routing to** `/terms`**. Style as small (**`text-xs`**), muted, underlined, centered — matching the tone of the existing disclosure copy. These links must be visible without scrolling on the paywall screen.**

Add Sign in with Apple to src/pages/Auth.tsx using @capacitor-community/apple-sign-in. Place the Apple button directly above or below the existing Google sign-in button. Wire it through AuthContext.tsx using Supabase's Apple OAuth provider (supabase.auth.signInWithIdToken with provider: 'apple'). Also enable the Sign in with Apple capability in ios/App/App.xcodeproj and add NSFaceIDUsageDescription to ios/App/App/Info.plist if not already present. On Android, hide the Apple button (platform-gate it with Capacitor.getPlatform() === 'ios').

In src/pages/Profile.tsx, add a Settings section (or append to an existing one) with two tappable rows: "Privacy Policy" and "Terms of Use", each navigating to /privacy and /terms respectively. Style consistently with other settings rows in the Profile page.