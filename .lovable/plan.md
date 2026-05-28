## Problem

Xcode is still showing **Missing package product 'CapApp-SPM'** even after the speech-recognition patch now applies successfully.

The repository currently has:

- `ios/App/CapApp-SPM/Package.swift` present and pinned to Capacitor SwiftPM `8.3.0`
- `ios/App/App.xcodeproj/project.pbxproj` referencing local package `CapApp-SPM`
- `Package.resolved` pinned to `capacitor-swift-pm` `8.3.0`
- The speech-recognition patch now applying correctly

So this is no longer the original `patch-package` parse issue. The likely remaining issue is that Xcode/SwiftPM is still resolving from stale local package metadata or a generated iOS project reference that needs to be refreshed after the patched package changed.

## Plan

1. **Make the iOS package state deterministic**
  - Verify the checked-in iOS package files are internally consistent.
  - If needed, update the iOS project package metadata so `CapApp-SPM` is linked in the exact Capacitor 8 SwiftPM structure Xcode expects.
2. **Add a local repair script for Mia’s Mac**
  - Add a small script that clears only safe local iOS/Xcode package caches for this project.
  - It will not delete source code.
  - It will run the required sequence in the correct order: install dependencies, apply patches, sync iOS, reset Swift package state.
3. **Preserve the existing Android fixes**
  - Keep the speech-recognition Android ProGuard patch untouched.
  - Keep the existing native Android constraints untouched.
4. **Give copy-paste verification commands**
  - Provide exact terminal commands for:
    - pulling the fix
    - cleaning local SwiftPM/Xcode derived package state
    - reinstalling dependencies
    - syncing iOS
    - reopening Xcode correctly
  - Include expected output checks so we know whether the package product is actually visible before building.

User: Your cleanup/reset plan is good, but before changing iOS project metadata I want the exact SwiftPM resolver failure. Please first make the local repair script run `xcodebuild -resolvePackageDependencies -workspace App.xcworkspace -scheme App` after install/sync and return the full resolver output. Only change `project.pbxproj` or package linkage if that output proves the local package reference is wrong. Keep all fixes scoped to iOS SwiftPM/package resolution only.

## Technical details

- I will avoid changing generated Supabase files and unrelated app code.
- I will focus only on iOS/Capacitor SwiftPM package resolution and local cache repair.
- I will not switch the app back to CocoaPods unless the SwiftPM route proves impossible.