## Problem

`scripts/build-android-fresh.sh` aborts with:

```
❌ Synced bundle is MISSING required marker: normalizeAuthCallbackUrl
```

even though your local checkout is fully on v8 (you confirmed `authFlow=v8-normalized-callback-parser` and `src/lib/authCallbackGuard.ts` are present).

## Root cause

The guard's `REQUIRED_MARKERS` array (lines 64–76) mixes two kinds of strings:

1. **String literals** that appear in `console.log(...)` calls — e.g. `"deeplink:launch-url"`, `"BuildInfo"`, `"authFlow=v8-normalized-callback-parser"`. These survive Vite's production minification because they're inside string quotes.
2. **A function identifier**: `normalizeAuthCallbackUrl`. This is the *name* of an exported helper in `src/lib/authCallbackGuard.ts`. Vite/esbuild minifies identifiers (renames them to `n`, `Bn`, etc.) so this name **never appears in the production bundle**. The guard will always fail on it — this marker was a mistake.

The other 10 markers correctly verify v8 is shipped. Only this one needs to go.

## Fix

Edit `scripts/build-android-fresh.sh` and remove **only** line 75 (`"normalizeAuthCallbackUrl"`) from the `REQUIRED_MARKERS` array. Leave every other marker — especially `"authFlow=v8-normalized-callback-parser"` — in place; that one is what actually proves v8 shipped.

Result after edit (lines 64–76):
```bash
REQUIRED_MARKERS=(
  "callback:verifyOtp-call"
  "callback:verifyOtp-result"
  "deeplink:launch-url"
  "BuildInfo"
  "build-version"
  "authFlow=v8-normalized-callback-parser"
  "oauth:exchange-call"
  "oauth:redirect-uri"
  "oauth:browser-open"
  "callback:setSession-start"
)
```

## Steps after approval

1. I'll remove line 75 from `scripts/build-android-fresh.sh`.
2. You then run locally:

```bash
cd /Users/mia/Desktop/carnivore-coach-pro
git pull
rm -rf dist node_modules/.vite android/app/src/main/assets/public android/app/build
adb uninstall com.mi4labs.carnivorex || true
npm run apk:fresh:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

3. The build should now succeed (the 10 remaining markers are all string literals that survive minification).
4. On launch, watch for:
   - `[BuildInfo] ... authFlow=v8-normalized-callback-parser`
   - On Google sign-in return: `deeplink:received ... isAuthRoute:true` followed by `callback:setSession-start` / `callback:verifyOtp-call`.

If those log lines appear and the session sticks, the v8 fix is verified end-to-end. If anything else fails, paste the new logcat slice and I'll diagnose.

## Why not "just add a fake string literal to the source"

Tempting, but the marker's job is to catch stale bundles. Keeping the 10 string-literal markers (especially `authFlow=v8-normalized-callback-parser`, which I bumped specifically for this purpose) gives the same protection without the false positive.