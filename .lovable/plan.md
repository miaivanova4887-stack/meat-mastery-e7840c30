## Problem

`public/.well-known/assetlinks.json` exists in source, but `vite build` does not emit it to `dist/.well-known/assetlinks.json`. Vite's built-in `publicDir` copier skips dotfile directories (entries starting with `.`), so the existing `copyPublicDir: true` setting is not enough. The downstream `assert-wellknown-assetlinks` plugin then fails (or, if bypassed, `cap sync` ships an APK without App Link verification).

## Fix

Add a small Vite plugin that explicitly copies `public/.well-known/` → `dist/.well-known/` after the bundle is written, and place it BEFORE the existing assertion plugin so the assert runs against a populated `dist/`.

### Changes to `vite.config.ts`

Insert a new plugin `copy-wellknown` directly above `assert-wellknown-assetlinks` in the `plugins` array:

```ts
{
  // Vite's built-in publicDir copier skips dotfile directories (e.g. .well-known/),
  // so we copy it explicitly. Required for Android App Links (assetlinks.json).
  name: "copy-wellknown",
  apply: "build" as const,
  closeBundle() {
    const srcDir = path.resolve(__dirname, "public/.well-known");
    const destDir = path.resolve(__dirname, "dist/.well-known");
    if (!fs.existsSync(srcDir)) {
      throw new Error(
        "[build] public/.well-known/ missing in source — cannot emit assetlinks.json"
      );
    }
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir)) {
      const from = path.join(srcDir, entry);
      const to = path.join(destDir, entry);
      if (fs.statSync(from).isFile()) {
        fs.copyFileSync(from, to);
      }
    }
  },
},
```

The existing `assert-wellknown-assetlinks` plugin remains immediately after it as a safety net — if the copy ever silently fails, the assert still aborts the build.

### Why plugin order matters

Vite runs `closeBundle` hooks in plugin-array order. The copier must run before the asserter; otherwise the assert sees an empty `dist/.well-known/` and aborts.

### Defense in depth — `scripts/build-android-fresh.sh`

After `npm run build`, add an explicit existence check before `cap sync`, so a regression surfaces with a clear message rather than as a missing asset on device:

```bash
ASSETLINKS="$ROOT_DIR/dist/.well-known/assetlinks.json"
if [[ ! -f "$ASSETLINKS" ]]; then
  echo "❌ Missing $ASSETLINKS after npm run build."
  echo "   The copy-wellknown Vite plugin did not run. Check vite.config.ts."
  exit 1
fi
echo "✅ assetlinks.json present in dist/"
```

Insert this immediately after the `npm run build` line and before `npx cap sync android`.

## Verification (after approval & build)

1. `rm -rf dist && npm run build`
2. `ls -la dist/.well-known/` → must show `assetlinks.json`
3. `npm run apk:fresh:debug` — must complete without hitting the assert or the new bash guard
4. After install, `adb shell pm get-app-links com.mi4labs.carnivorex` should report `verified` for `app.carnivorex.app`

- Add the `copy-wellknown` plugin to `vite.config.ts`.
- Put it **immediately above** `assert-wellknown-assetlinks`.
- Add the post-build bash guard in `scripts/build-android-fresh.sh`.

## Files to edit

- `vite.config.ts` — add `copy-wellknown` plugin before `assert-wellknown-assetlinks`
- `scripts/build-android-fresh.sh` — add post-build assetlinks existence guard

No other files affected. No runtime app code changes.