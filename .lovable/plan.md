## Problem

The repair script failed at the last step:

```
xcodebuild: error: 'App.xcworkspace' does not exist.
```

Your `ios/App/` directory contains only `App.xcodeproj/` and `CapApp-SPM/` — there is no `App.xcworkspace`. This is correct and expected: modern Capacitor (6+) uses Swift Package Manager directly inside `App.xcodeproj`, with no CocoaPods workspace. The script I wrote in the previous turn assumed a workspace existed, which was wrong.

The good news is everything before that step worked:
- `npm install` + `patch-package` applied the speech-recognition patch
- `npx cap sync ios` completed cleanly and detected all 9 Capacitor plugins
- The project-local SwiftPM/xcuserdata caches were cleared

We just never actually ran the SwiftPM resolver, so we still have no log of what Xcode is doing when it fails with `Missing package product 'CapApp-SPM'`.

## Fix

Update `scripts/repair-ios-spm.sh` so it:

1. Targets `App.xcodeproj` instead of the non-existent `App.xcworkspace`:
   - Resolver call becomes:  
     `xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App`
2. Clears the correct SwiftPM cache path used by an xcodeproj-only setup:
   - `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm`
   - (Drop the now-irrelevant `App.xcworkspace/...` removals.)
3. Also clears the user-level DerivedData entry for this project, which is where Xcode caches the resolved `CapApp-SPM` product reference between runs:
   - `~/Library/Developer/Xcode/DerivedData/App-*`
   - `~/Library/Caches/org.swift.swiftpm` (safe; SwiftPM repopulates)
4. Prints the log path at the end, exactly as before, so we get a clean transcript of the resolver's actual error.

No other files change. The Android build, speech-recognition patch, and `cap sync` behavior all stay exactly as they are.

## What you'll do after I apply the fix

I'll give you line-by-line copy-paste commands. The flow will be:

1. `git pull`
2. `./scripts/repair-ios-spm.sh`
3. Paste back the **full** terminal output (it will include the resolver log path and the actual SwiftPM error).
4. Then — and only then — open Xcode and try to build.

That resolver log is the evidence we've been missing. Once we see the real underlying error (e.g. a checksum mismatch, a missing product in a transitive package, or a stale local package reference), I can apply a targeted fix instead of guessing.

## Technical detail (for reference)

- Capacitor's iOS template since v6 ships an xcodeproj only; `Package.swift` lives in `ios/App/CapApp-SPM/` and is referenced as a local Swift package from `project.pbxproj`.
- `Missing package product 'CapApp-SPM'` almost always means Xcode parsed `project.pbxproj` (which references the product) but the SwiftPM resolver did not produce that product on disk — usually because of a stale resolved file, a transitive package failure, or a derived-data cache pointing at an older `Package.swift`.
- Running `-resolvePackageDependencies -project App.xcodeproj` is the headless equivalent of Xcode's "Resolve Package Versions" and surfaces the real failure as text we can act on.
