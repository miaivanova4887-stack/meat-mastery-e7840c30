Goal: prove whether the latest onboarding code is actually in the production web bundle and the Android package, and remove the false “stale build” signal.

What I already verified from the repo

- Files inspected:
  - `index.html`
  - `vite.config.ts`
  - `capacitor.config.json`
  - `scripts/build-android-fresh.sh`
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/pages/Onboarding.tsx`
  - `src/components/BuildStamp.tsx`
  - `src/vite-env.d.ts`
  - `src/lib/pushNotifications.ts`
  - `src/i18n/en.json`
  - `src/i18n/fr.json`
  - `.gitignore`
  - `package.json`
- Current root `index.html` still hardcodes:
  - `<title>Carnivore</title>`
  - `meta description="Lovable Generated Project"`
  - `meta author="Lovable"`
  - `og:description="Lovable Generated Project"`
  - `twitter:description="Lovable Generated Project"`
- Vite entry/output path is straightforward:
  - `index.html` loads `/src/main.tsx`
  - `src/main.tsx` renders `App`
  - `src/App.tsx` routes `/onboarding` to `src/pages/Onboarding.tsx`
  - `vite.config.ts` has no custom `build.outDir`, so Vite default output is `dist`
  - `capacitor.config.json` sets `webDir: "dist"`
  - `scripts/build-android-fresh.sh` deletes `dist` and `android/app/src/main/assets/public`, runs `npm run build`, then `npx cap sync android`, then Gradle
- Current onboarding source already contains clear markers of the newer flow:
  - `Before you continue`
  - `CarnivoreX is a wellness tracking tool, not a medical service...`
  - `I Agree`
  - `Saving…`
- Important code fact: `src/pages/Onboarding.tsx` hardcodes most onboarding copy and does not use `useTranslation`; it only fetches backend labels for health targets.

Single evidence-backed root cause

- The APK showing Lovable metadata is not proof that the APK is old. It is coming from the current source `index.html`, which still contains Lovable metadata right now. Any fresh Vite build from this repo will carry that same metadata forward into `dist/index.html`, and then into Capacitor Android assets.
- So the confirmed root cause of the “Lovable metadata in APK” symptom is: the source HTML metadata was never updated.
- I cannot yet prove the exact current APK asset contents from this repo snapshot because there is no `dist/` folder and no `android/` folder present here to inspect. That means the missing proof is a build-artifact verification gap, not an alternate entry-path issue.

Implementation plan

1. Add an explicit temporary fingerprint

- Add `__BUILD_FINGERPRINT__ = "2026-04-10-asset-check-01"` in `vite.config.ts`.
- Declare it in `src/vite-env.d.ts`.
- In `src/main.tsx`, set:
  - `window.__BUILD_FINGERPRINT__ = __BUILD_FINGERPRINT__`
  - `console.info("BUILD_FINGERPRINT", window.__BUILD_FINGERPRINT__)`

2. Surface the fingerprint on onboarding

- Reuse `BuildStamp` or add a temporary onboarding-only badge in `src/pages/Onboarding.tsx`.
- Make the fingerprint visible on screen so the installed APK can be validated without guessing.

3. Run a clean production build and capture exact asset proof

- Run `npm run build`.
- List `dist/` and record the exact hashed filenames referenced by `dist/index.html`.
- Read `dist/index.html` and capture the exact JS/CSS bundles.
- Search built JS for:
  - `2026-04-10-asset-check-01`
  - `Before you continue`
  - `CarnivoreX is a wellness tracking tool`
  - fallback markers if minified: `wellness_disclaimer_consented`, `carnivore-onboarding-complete`, `/onboarding`

4. Prove Android is packaging the same files

- Inspect `android/app/src/main/assets/public/index.html` after `npx cap sync android`.
- Compare its asset filenames to `dist/index.html`.
- Inspect the APK contents and verify:
  - same `assets/public/index.html`
  - same hashed JS/CSS filenames
  - same fingerprint string

5. Fix the misleading metadata at the source

- Update `index.html` title/meta/OG/Twitter values away from Lovable defaults.
- This removes the false stale-build signal permanently.

6. If the rebuilt bundle still lacks the expected onboarding change

- Verify where that change actually lives:
  - `src/pages/Onboarding.tsx` → will be bundled
  - `src/i18n/*.json` or backend content → mostly ignored by current onboarding page
- If needed, move onboarding to a single source of truth so future edits are reliably compiled.

What I will return after implementation

- Exact files inspected
- Exact built asset filenames
- Whether onboarding changes are in `dist`
- Whether Android packages the same files from `dist`
- The confirmed root cause with file-level evidence
- The minimal fix applied

Technical details

```text
Entry chain:
index.html
  -> /src/main.tsx
     -> App
        -> Route "/onboarding"
           -> src/pages/Onboarding.tsx

Packaging chain:
vite build
  -> dist/
capacitor webDir = dist
npx cap sync android
  -> android/app/src/main/assets/public/
gradle assembleDebug
  -> app-debug.apk
```

Update index.html to remove Lovable defaults and add a temporary build fingerprint that is visible in the app UI and emitted in console output. Then rebuild the production bundle, verify the fingerprint appears in dist/index.html, dist/assets/*.js, and the Android APK assets/public files, and report the exact file evidence.