## No Changes Required

Both target files already match your requested specification exactly. No edits are needed.

### `patches/@capacitor-community+speech-recognition+7.0.1.patch`

The patch is already a clean unified diff with no fake `index 1111111..2222222` header. It contains only the standard `diff --git`, `---`, `+++`, and `@@` lines, and makes the single one-line change:

```
-            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
+            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
```

### `scripts/build-android-fresh.sh`

The script already contains, in this order:

1. The existing `npx patch-package` step (line 22).
2. Immediately after it, the macOS-safe fallback (lines 31–35): if the gradle file still contains `getDefaultProguardFile('proguard-android.txt')`, it rewrites that exact string in place with `sed -i.bak ...` and removes the `.bak` backup.
3. The verification block (lines 36–45) is preserved and will still abort the build if the file is wrong after the fallback.

### Recommended Next Step

Since the source files on disk are already correct, the most likely cause of the prior failure is that `node_modules/@capacitor-community/speech-recognition/android/build.gradle` on your local machine is stale (e.g. patch-package never re-ran after the patch was rewritten, or the file was modified after the script's verification check passed in a previous invocation).

I can:
- Re-run the build script as-is (it will now hit the sed fallback and self-heal), or
- Add a brief `cat` of the patched line right after the fallback so the build log shows the actual file content for diagnosis.

Approve this plan if you'd like me to add the diagnostic `cat` line; otherwise just run `./scripts/build-android-fresh.sh` — the existing fallback should resolve it.