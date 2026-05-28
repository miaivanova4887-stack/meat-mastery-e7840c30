## Plan

Fix the iOS build failure by making the patched speech-recognition Swift package depend on the same Capacitor SwiftPM version as the generated app package.

## What I’ll change

1. Update `patches/@capacitor-community+speech-recognition+7.0.1.patch`
   - Change the generated `Package.swift` dependency from Capacitor SwiftPM `8.3.0` to `8.3.4`, matching the `CapApp-SPM` resolver requirement from Xcode.
   - Preserve the existing Android ProGuard fix and the iOS `CAPBridgedPlugin` compatibility fix already in that patch.

2. Update `scripts/repair-ios-spm.sh`
   - Keep the existing repair flow: `npm install`, `npx cap sync ios`, clear SwiftPM/Xcode caches, resolve packages with `xcodebuild`.
   - Add an evidence check after install/sync that prints the actual `capacitor-swift-pm` version inside `node_modules/@capacitor-community/speech-recognition/Package.swift` before Xcode resolves packages.
   - This makes it obvious whether `patch-package` applied the corrected SwiftPM dependency.

3. Add a short note to `.lovable/plan.md`
   - Record that the underlying iOS issue was a SwiftPM exact-version conflict: `CapApp-SPM` required `capacitor-swift-pm` `8.3.4`, while the speech-recognition patch required `8.3.0`.

## After implementation, you’ll run

```bash
cd ~/Desktop/carnivore-coach-pro

git pull

chmod +x ./scripts/repair-ios-spm.sh

./scripts/repair-ios-spm.sh
```

Expected result: Xcode should no longer fail with the `8.3.4` vs `8.3.0` package conflict. If another package error appears afterward, the script will print the exact resolver log path so we can fix the next concrete issue.