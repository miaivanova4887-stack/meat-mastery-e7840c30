## Fix: Add missing iOS privacy usage string for Snap & Log

The `@capacitor/camera` plugin requires `NSPhotoLibraryAddUsageDescription` in `Info.plist` because it can save captured photos to the library. The current `ios/App/App/Info.plist` already has `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription`, but is missing `NSPhotoLibraryAddUsageDescription` — which is what the runtime error reports.

This repo commits the native iOS project directly (`ios/App/App/Info.plist` is the source of truth — Capacitor does not regenerate it on `cap sync`), so the fix is a direct edit there.

### Change

Edit `ios/App/App/Info.plist` — add one new key/value pair alongside the existing camera/photo entries:

```xml
<key>NSPhotoLibraryAddUsageDescription</key>
<string>CarnivoreX saves meal photos you capture so you can revisit them in your nutrition log.</string>
```

Keep the existing strings as-is (they already match the brand voice):
- `NSCameraUsageDescription` — already present (barcode + meal photos)
- `NSPhotoLibraryUsageDescription` — already present (pick existing meal photo)
- `NSPhotoLibraryAddUsageDescription` — NEW (save captured photo to library)

### Why not capacitor.config.json

Capacitor does not inject plist usage strings from `capacitor.config.json`. The committed `Info.plist` is the persistent source of truth and is not overwritten by `npx cap sync ios`, so this edit will survive future syncs and rebuilds.

### Verification (line-by-line for user)

After Lovable applies the edit, on your Mac:

```bash
cd ~/path/to/repo
git pull
grep -A1 NSPhotoLibraryAddUsageDescription ios/App/App/Info.plist
npx cap sync ios
npx cap open ios
```

Then in Xcode: Product → Clean Build Folder, rebuild, install on device, tap Snap & Log → camera opens; no "missing NSPhotoLibraryAddUsageDescription" error.

### Files touched
- `ios/App/App/Info.plist` (add one key/string pair)

No JS, no Capacitor config, no Android changes.
