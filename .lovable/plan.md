## Plan

Fix the iOS SwiftPM resolver failure caused by `patch-package` silently not re-applying after `git pull`, and prevent future drift between the auto-generated `CapApp-SPM/Package.swift` and the patched speech-recognition package.

## Root cause (evidence)

Latest repair output proved that `node_modules/@capacitor-community/speech-recognition/Package.swift` still contained the upstream `from: "7.0.0"` line — the patch never applied locally. Meanwhile `npx cap sync ios` regenerates `ios/App/CapApp-SPM/Package.swift` pinned to `exact: "8.3.4"` (matching the installed `@capacitor/ios`). Two incompatible SwiftPM constraints on the same package = unresolvable graph.

## What changed

1. `patches/@capacitor-community+speech-recognition+7.0.1.patch`
   - Generated `Package.swift` now uses `from: "8.3.0"` instead of `exact: "8.3.4"`. `from: "8.3.0"` allows any 8.x ≥ 8.3.0, so it stays compatible no matter which exact 8.x version `CapApp-SPM` pins on future `cap sync` runs.

2. `scripts/repair-ios-spm.sh`
   - Explicitly runs `npx patch-package` after `npm install` (does not rely on the postinstall hook firing).
   - Verifies the speech-recognition Package.swift; if patch-package still didn’t apply, an inline `sed` fallback rewrites the `capacitor-swift-pm` line to `from: "8.3.0"`.
   - Hard-aborts before `xcodebuild` if the file is not on a compatible 8.x reference — so we never reach the resolver with a known-broken graph.
   - Prints both `CapApp-SPM/Package.swift` and speech-recognition `Package.swift` `capacitor-swift-pm` lines as evidence right before resolve.

## After implementation, run

```bash
cd ~/Desktop/carnivore-coach-pro

git pull

chmod +x ./scripts/repair-ios-spm.sh

./scripts/repair-ios-spm.sh
```

Expected evidence in the output:
- `OK: speech-recognition is on capacitor-swift-pm 8.x (compatible with CapApp-SPM).`
- `== Evidence before resolve ==` shows the speech-recognition line as `from: "8.3.0"` (or `exact: "8.x"`), and CapApp-SPM as `exact: "8.3.x"`.
- xcodebuild resolves without the "could not resolve" error.

If a different package error appears, paste the printed `Resolver output saved` log path contents.
