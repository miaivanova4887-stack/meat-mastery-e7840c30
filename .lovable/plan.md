# Fix the speech-recognition ProGuard patch

## Findings

After inspecting both files in the sandbox:

- `node_modules/@capacitor-community/speech-recognition/android/build.gradle` (v7.0.1) currently contains exactly one line referencing the ProGuard file:
  ```
  proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
  ```
  In sandbox the patch did apply. But the patch file itself is fragile.
- `patches/@capacitor-community+speech-recognition+7.0.1.patch` was hand-written with **placeholder git index hashes** (`index 1111111..2222222`). `patch-package` 8 tolerates this, but some `patch` binaries (notably the BSD `patch` shipped with macOS 11, which is the user's documented dev environment) are stricter and will silently reject or partially apply such patches, leaving the original `proguard-android.txt` line in place — which is exactly what the build script is now reporting.
- I verified by reverting the file and re-running `npx patch-package` in this sandbox: it applied cleanly here. So the bug is environmental on macOS 11, caused by the malformed `index` header + missing real diff metadata.

## Fix

### 1. Regenerate the patch with a clean, portable unified-diff header

Rewrite `patches/@capacitor-community+speech-recognition+7.0.1.patch` so it:

- Drops the bogus `index 1111111..2222222 100644` line entirely (patch-package does not require it; older `patch` binaries do not like fake hashes).
- Keeps the `diff --git`, `---`, `+++`, `@@` and context lines exactly matching the upstream v7.0.1 file.
- Ends with a proper trailing newline.

Final patch contents:

```
diff --git a/node_modules/@capacitor-community/speech-recognition/android/build.gradle b/node_modules/@capacitor-community/speech-recognition/android/build.gradle
--- a/node_modules/@capacitor-community/speech-recognition/android/build.gradle
+++ b/node_modules/@capacitor-community/speech-recognition/android/build.gradle
@@ -26,7 +26,7 @@ android {
     buildTypes {
         release {
             minifyEnabled false
-            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
+            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
         }
     }
     lintOptions {
```

### 2. Add a self-healing fallback in `scripts/build-android-fresh.sh`

Even with a clean patch, macOS 11's old toolchain can still misbehave. Add a fallback: if after `npx patch-package` the gradle file *still* contains `proguard-android.txt`, rewrite that single line in place with `sed -i.bak`, then re-run the existing verification. Only abort if the file is still wrong after the in-place rewrite.

Insert between the existing `npx patch-package` step and the existing `grep` verification:

```bash
if grep -q "getDefaultProguardFile('proguard-android.txt')" "$PLUGIN_GRADLE"; then
  echo "⚠️ patch-package did not apply; rewriting $PLUGIN_GRADLE inline..."
  sed -i.bak "s/getDefaultProguardFile('proguard-android.txt')/getDefaultProguardFile('proguard-android-optimize.txt')/" "$PLUGIN_GRADLE"
  rm -f "$PLUGIN_GRADLE.bak"
fi
```

The existing `grep` verification block immediately after will then either confirm success or abort with the existing clear error.

The rest of the build flow (web build, cap sync, icons, gradle assemble, APK checksum) is unchanged.

## Files changed

- `patches/@capacitor-community+speech-recognition+7.0.1.patch` — cleaned up unified diff
- `scripts/build-android-fresh.sh` — add 5-line sed fallback before the existing grep verification

## Files NOT touched

- iOS code
- Health Connect plugin (`HealthConnectPlugin.kt` / `.swift`)
- `package.json` `postinstall` script
- Any web/UI code

> **Please fix the speech-recognition ProGuard patch in two places.**
>
> 1. **Rewrite** `patches/@capacitor-community+speech-recognition+7.0.1.patch` **as a clean unified diff with no fake** `index 1111111..2222222` **header. Keep only the standard** `diff --git`**,** `---`**,** `+++`**, and** `@@` **lines, and make the one-line change from** `proguard-android.txt` **to** `proguard-android-optimize.txt`**.**
>
> 2. **Update** `scripts/build-android-fresh.sh` **to add a fallback immediately after** `npx patch-package`**: if** `node_modules/@capacitor-community/speech-recognition/android/build.gradle` **still contains** `getDefaultProguardFile('proguard-android.txt')`**, rewrite that exact string in place to** `getDefaultProguardFile('proguard-android-optimize.txt')` **using a portable macOS-safe** `sed -i.bak -e ...` **command, remove the backup file, and then let the existing verification block run. Keep the rest of the build flow unchanged.**
>
> **Do not touch iOS, Health Connect, or unrelated Android files.**