## Goal
Fix `scripts/build-android-fresh.sh` so the synced-bundle verification only checks markers guaranteed to ship in a Vite **production** build, and resolves the auth-flow version dynamically from `src/lib/authFlowBuild.ts`.

## Why the script aborts today
The current `REQUIRED_MARKERS` list contains:
- `BuildInfo` — only emitted inside `if (import.meta.env.DEV)` in `src/main.tsx`, so Vite tree-shakes it from prod bundles.
- `authFlow=v8-normalized-callback-parser` — hardcoded to an old version; current value in `src/lib/authFlowBuild.ts` is `v11-20260526-proof-path`.

Both cause false-negative aborts even when the bundle is fresh.

## Patch to `scripts/build-android-fresh.sh`

1. **Resolve `AUTH_FLOW_BUILD` dynamically** right after `cap sync`, before the marker loop:
   ```bash
   AUTH_FLOW_BUILD=$(grep -E 'AUTH_FLOW_BUILD\s*=' "$ROOT_DIR/src/lib/authFlowBuild.ts" \
     | sed -E 's/.*"([^"]+)".*/\1/' | head -1)
   if [[ -z "$AUTH_FLOW_BUILD" ]]; then
     echo "❌ Could not resolve AUTH_FLOW_BUILD from src/lib/authFlowBuild.ts"
     exit 1
   fi
   echo "🔖 AUTH_FLOW_BUILD = $AUTH_FLOW_BUILD"
   ```

2. **Replace `REQUIRED_MARKERS`** with prod-safe literals only. All of these are string arguments to `logAuthDiag(...)` (or `version:` field) and survive Vite/esbuild minification because string literals are preserved:

   ```bash
   REQUIRED_MARKERS=(
     "build:auth-flow"
     "$AUTH_FLOW_BUILD"
     "callback:start"
     "callback:setSession-start"
     "deeplink:launch-url"
     "oauth:exchange-call"
   )
   ```

   Rationale:
   - `build:auth-flow` — emitted unconditionally at top of `src/main.tsx` via `logAuthDiag("build:auth-flow", …)`.
   - `$AUTH_FLOW_BUILD` (e.g. `v11-20260526-proof-path`) — shipped as the `version` value in that same call and as the exported constant string.
   - `callback:start`, `callback:setSession-start` — unconditional `logAuthDiag` tags inside `AuthCallback.tsx` prod code path.
   - `deeplink:launch-url` — unconditional `logAuthDiag` tag inside `useDeepLinks.ts`.
   - `oauth:exchange-call` — unconditional `logAuthDiag` tag inside `AuthCallback.tsx`.

3. **Remove the `FORBIDDEN_STALE` block.** Its three strings (`"native deep link received"`, `"app resumed, refreshing session"`, `"session before refresh"`) reference a removed pre-v8 implementation; they no longer appear anywhere in `src/` and grepping for them in the synced bundle adds no signal. Deleting this block keeps the script lean without weakening guard rails (the positive `REQUIRED_MARKERS` already prove freshness).

4. **Keep everything else intact**: patch-package check, speech-recognition gradle patch verification, `minSdkVersion=26` pin, kotlin-android plugin guard, HealthConnect plugin copy + marker checks, icon copy + validation, Kotlin pre-compile check, `assembleDebug --no-build-cache`, APK SHA256, optional `adb install`, post-install logcat tip.

## Deliverables after patching
- **Exact diff** of `scripts/build-android-fresh.sh` (old vs new lines).
- **Final marker list** as resolved at script runtime (will print `🔖 AUTH_FLOW_BUILD = v11-20260526-proof-path` and the 6 markers).
- **Rerun commands**:
  ```bash
  cd /Users/mia/Desktop/carnivore-coach-pro
  git pull
  bun install
  bash scripts/build-android-fresh.sh
  ```

## Out of scope
No changes to `src/main.tsx`, `src/lib/authFlowBuild.ts`, `AuthCallback.tsx`, or any Android/Gradle config. Script-only patch.
