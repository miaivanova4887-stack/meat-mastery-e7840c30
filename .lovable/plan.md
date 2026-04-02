

## Create High-Resolution Version of Uploaded Icon

### What
Take the user's uploaded flame icon (`CarnivoreX_icon-3.png`) and upscale it to a crisp 1024x1024 master icon using AI image editing, then regenerate all Android density assets from it.

### Steps

**1. Upscale the uploaded icon**

Use AI image editing (`google/gemini-3-pro-image-preview`) with the uploaded image as input. Prompt: "Upscale this icon to 1024x1024 pixels. Keep the exact same design — amber/gold flame outline on pure black background. Make lines crisp and smooth, no changes to the shape or style. No text, no watermarks."

Save as `public/icon-1024.png`.

**2. Regenerate Android density assets**

Use ImageMagick to resize from the 1024px master into all required sizes:
- `ic_launcher.png` — 48, 72, 96, 144, 192px
- `ic_launcher_round.png` — circle-cropped versions
- `ic_launcher_foreground.png` — 108, 162, 216, 324, 432px (66% safe zone)

**3. Update 512px web icon**

Resize to `public/app-icon-512.png`.

**4. Re-upload to cloud storage**

Upload the new icons to the `app-assets` bucket, replacing the previous versions.

### Files changed

| File | Action |
|------|--------|
| `public/icon-1024.png` | Replaced with upscaled version |
| `public/app-icon-512.png` | Regenerated |
| `public/android-icons/mipmap-*/ic_launcher*.png` | Regenerated (15 files) |

