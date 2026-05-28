## Plan

Fix the iOS SwiftPM resolver by forcing `speech-recognition` to pin the SAME exact `capacitor-swift-pm` version that `CapApp-SPM` requires after `npx cap sync ios`.

## Root cause (evidence)

Latest output:

```text
CapApp-SPM:          capacitor-swift-pm exact: "8.3.4"
speech-recognition: capacitor-swift-pm exact: "8.3.0"
```

`exact: "8.3.0"` is NOT compatible with `exact: "8.3.4"`. The previous repair accepted any 8.x as "compatible" — it must accept only the exact version `CapApp-SPM` pins.

## What changed

1. `scripts/repair-ios-spm.sh`
   - Runs `npm install` + `npx patch-package` + `npx cap sync ios` first.
   - Parses the exact `capacitor-swift-pm` version from the freshly-generated `CapApp-SPM/Package.swift`.
   - Force-rewrites `node_modules/@capacitor-community/speech-recognition/Package.swift` to pin `exact: "<that same version>"`.
   - Asserts both files match before invoking `xcodebuild`. Hard-aborts otherwise.
   - Prints a clear evidence block:
     ```text
     CapApp-SPM requires:          8.3.4
     speech-recognition requires: 8.3.4
     OK: SwiftPM versions match.
     ```

2. `patches/@capacitor-community+speech-recognition+7.0.1.patch` — unchanged; the script is now the source of truth for the SwiftPM version because `cap sync ios` can regenerate `CapApp-SPM` with a different pin at any time.

## After implementation, run

```bash
cd ~/Desktop/carnivore-coach-pro

git pull

chmod +x ./scripts/repair-ios-spm.sh

./scripts/repair-ios-spm.sh
```

Expected evidence before Xcode resolves:

```text
CapApp-SPM requires:          8.3.4
speech-recognition requires: 8.3.4
OK: SwiftPM versions match.
```

Then `xcodebuild -resolvePackageDependencies` should succeed (no more `8.3.4` vs `8.3.0` error). If a different error appears, paste the printed `Resolver output saved` log file contents.
