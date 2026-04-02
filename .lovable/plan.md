

## Fix: Re-upscale Icon with Black Background Preserved

### Problem
The AI upscaling changed the icon background from black to white, ignoring the explicit black background in the original image.

### Fix
1. **Re-run the upscale** using `google/gemini-3-pro-image-preview` with stronger prompting: "Upscale this image to 1024x1024. Do NOT change anything. Keep the pure black (#000000) background exactly as-is. Keep the amber/gold flame exactly as-is. No modifications whatsoever."
2. **Post-process with ImageMagick** as a safety net — force any near-white pixels back to black if the model still misbehaves: `convert icon-1024.png -fill black -fuzz 10% -opaque white icon-1024.png`
3. **Regenerate all Android density assets** from the corrected 1024px master (15 PNGs)
4. **Regenerate `app-icon-512.png`**
5. **Re-upload to cloud storage**

### Files changed

| File | Action |
|------|--------|
| `public/icon-1024.png` | Re-upscaled with black background |
| `public/app-icon-512.png` | Regenerated |
| `public/android-icons/mipmap-*/ic_launcher*.png` | Regenerated (15 files) |

