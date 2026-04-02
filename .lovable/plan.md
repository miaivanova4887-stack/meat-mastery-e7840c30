

## Redesign App Icon and Generate Android Assets

### Concept

Use AI image generation to create a higher-quality "dual meaning" icon -- a shape that reads as both a flame and a steak/cut of meat simultaneously. The uploaded draft is a simple amber flame outline on black; the new version will be richer, with more detail and the dual visual illusion.

### Steps

**1. Generate the master icon (1024x1024)**

Use the AI image generation endpoint (`google/gemini-3-pro-image-preview`) with the uploaded draft as input, prompting for:
- A refined, premium app icon on pure black background
- Dual-meaning silhouette: flame shape whose negative space / interior suggests a ribeye or T-bone cut
- Amber-to-gold gradient strokes with subtle glow, matching the existing CarnivoreX brand palette
- Clean vector-style rendering, no text, no watermarks
- Centered with enough padding for Android adaptive icon safe zone (~18% margin)

Save the result as `public/icon-1024.png` (replacing the current one).

**2. Generate all Android density assets**

Using ImageMagick, resize from the 1024px master:

| Asset | Sizes (mdpi -> xxxhdpi) |
|-------|------------------------|
| `ic_launcher.png` | 48, 72, 96, 144, 192 |
| `ic_launcher_round.png` | 48, 72, 96, 144, 192 (circle-cropped) |
| `ic_launcher_foreground.png` | 108, 162, 216, 324, 432 (logo in inner 66% safe zone) |

**3. Add adaptive icon XML definitions** (currently missing -- this is why the APK shows a blank icon on Android 8+)

Create `public/android-icons/mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml`:
```xml
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
```

Create `public/android-icons/values/colors.xml`:
```xml
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
```

**4. Update build script**

Add to `scripts/build-android-fresh.sh`:
- Copy `mipmap-anydpi-v26/` XML files to Android `res/`
- Copy `values/colors.xml` to Android `res/values/`
- Build-time validation: abort if `ic_launcher.xml` or `colors.xml` is missing after copy

**5. Update web favicon**

Copy the new 1024px master to also serve as the web favicon/PWA icon.

### Files changed

| File | Action |
|------|--------|
| `public/icon-1024.png` | Replaced with AI-generated dual-meaning icon |
| `public/android-icons/mipmap-*/ic_launcher.png` | Regenerated (5 densities) |
| `public/android-icons/mipmap-*/ic_launcher_round.png` | Regenerated (5 densities) |
| `public/android-icons/mipmap-*/ic_launcher_foreground.png` | Regenerated with safe-zone padding (5 densities) |
| `public/android-icons/mipmap-anydpi-v26/ic_launcher.xml` | New |
| `public/android-icons/mipmap-anydpi-v26/ic_launcher_round.xml` | New |
| `public/android-icons/values/colors.xml` | New |
| `scripts/build-android-fresh.sh` | Updated with XML copy + validation |

### After implementation
- Rebuild APK with `bash scripts/build-android-fresh.sh`
- No manifest changes needed (Capacitor default already uses `@mipmap/ic_launcher`)

