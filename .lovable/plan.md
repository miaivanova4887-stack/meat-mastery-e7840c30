## 1. Lock iPhone to portrait (allow rotation on iPad)

`ios/App/App/Info.plist` currently lists Landscape Left/Right for iPhone, which is why your phone rotates. Restrict iPhone to portrait only and keep iPad as-is.

- `UISupportedInterfaceOrientations` → only `UIInterfaceOrientationPortrait`.
- `UISupportedInterfaceOrientations~ipad` → leave the four-orientation array unchanged.

After the edit you'll need to: `bun install` (no-op), `npx cap sync ios`, then Archive → upload as **build 2** (or bump `CFBundleVersion`). Apple won't let you reuse build 1.

## 2. Test the iOS build on your physical iPhone before App Store review

You don't need to wait for App Review to install on your device. Two options — I recommend (a):

**(a) Run from Xcode directly to your iPhone** (fastest, no upload needed)

- Plug iPhone into Mac, trust the computer.
- In Xcode: select your iPhone in the device dropdown (top bar, next to the App scheme).
- Press the ▶︎ Run button. Xcode signs with your dev profile and installs.
- First launch: on iPhone go to Settings → General → VPN & Device Management → trust your developer cert.

**(b) TestFlight (internal testing)** — uses the build you already uploaded

- App Store Connect → your app → TestFlight tab.
- Wait for the build to finish "Processing" (5–30 min).
- Fill in the Export Compliance question (almost always "No" for standard HTTPS).
- Add yourself as an Internal Tester, install **TestFlight** from the App Store on your iPhone, accept the invite email.

I'll write line-by-line terminal/Xcode steps for whichever you pick once we're in build mode.

## 3. Validate Sign in with Apple and Sign in with Google on iOS

Both are wired through `@capgo/capacitor-social-login`. To actually validate end-to-end on the device build:

- **Apple**: Tap "Continue with Apple" → native Apple sheet appears → complete → app should return to a signed-in session. If it fails, the two usual culprits are (1) the "Sign in with Apple" capability missing in Xcode → Signing & Capabilities, (2) the Service ID + redirect URL not configured in Lovable Cloud → Auth → Apple provider.
- **Google**: Tap "Continue with Google" → in-app browser/native sheet → complete → return to signed-in session. Needs iOS OAuth client ID in `capacitor.config.json` under the SocialLogin plugin, and Google provider enabled in Lovable Cloud → Auth.

In build mode I'll:

- Verify the iOS entitlement file includes `com.apple.developer.applesignin`.
- Verify `capacitor.config.json` has the Google iOS client ID and reversed client ID URL scheme in Info.plist.
- Confirm Lovable Cloud Apple + Google providers are configured (call `supabase--configure_social_auth` if needed).
- Give you a short on-device test checklist with what success/failure should look like.

## 4. My Feed — remove the "Mar 7th"-style date from articles

The date appears in two places:

- `src/pages/NewsFeed.tsx` line 119–127 (`formatDate`) — shown under each article card.
- `src/pages/Profile.tsx` line 708–715 (`formatDate` inside the My Feed tab) — shown under news/tip items.

Fix: remove the date text node from the article card JSX in both places (keep "Today/Yesterday" only if you want, or drop entirely — I'll drop entirely per your request). Progress Milestones in Profile keep their date because you didn't flag those.

Need confirmation: **drop the date completely**, or **keep "Today / Yesterday / N days ago" and only hide the `Mar 7` fallback**?

## 5. Recipe Coach — restore the input field

The composer at the bottom of `src/pages/RecipeCoach.tsx` (lines 324–348) is rendered but `disabled` whenever the user does not have Pro access. On a Free account this looks like "no input field" because the TeaserGate also covers the message area.

Two likely causes for what you're seeing — I'll need to know which:

- **You are on Free tier** → expected behavior; the upgrade gate hides it. Fix would be cosmetic (e.g., show the input but route to the paywall on submit).
- **You are on Pro/Elite and the input still doesn't show** → likely the iOS keyboard pushing the form below the safe area, or `h-[100dvh]` collapsing under the keyboard. Fix: switch container to flex layout with `min-h-[100dvh]`, add Capacitor Keyboard `resize: 'native'` config, and ensure the form's `safe-area-bottom` is respected when keyboard is open.

Please confirm your tier so I apply the right fix.

## 6. Progress → My Progress — remove the "..." next to category icons

In `src/pages/Progress.tsx` the category dropdown trigger renders `{icon} {label}` inside shadcn's `SelectValue`. The trailing "..." is the default `line-clamp-1` / text-overflow ellipsis from `SelectValue`'s wrapping span clipping the row. Fix is one of:

- Remove the truncation: override `SelectValue` to render with `whitespace-normal` / no `line-clamp`, **or**
- Give the trigger more room: drop the `h-12` constraint and let it size naturally.

I'll take the first approach (no truncation on the trigger label) so it works at all viewport widths. Affects only `src/pages/Progress.tsx`.

## Technical notes (skip if not interested)

- iOS orientation is controlled at the Info.plist level; no Swift changes needed.
- Apple build numbers must be monotonically increasing per version — bump `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` (or change in Xcode → General → Build) before re-uploading.
- Capgo Social Login: Apple uses native `ASAuthorizationController`; Google uses `GIDSignIn`. Both already shipped in the binary you uploaded, but provider config on the backend can be changed without a new build.
- &nbsp;

## Open questions before I implement

1. My Feed dates: drop completely, or keep relative ("Today/Yesterday/N days ago") and only hide the absolute fallback? - drop completely 
2. Recipe Coach: are you logged in as Free, Pro, or Elite when you don't see the input? - Elite
3. For on-device testing: option (a) Xcode direct install, or (b) TestFlight? - a
  &nbsp;