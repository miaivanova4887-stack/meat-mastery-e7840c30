

## Polish Flame Icon as App Icon

### What we have
- Uploaded flame icon: minimal single-stroke amber flame on black background (small, ~56x56px)
- Current `app-icon.png`: multi-color orange-yellow flame on dark gray (used for Android build)
- Current `app-icon-512.png`: metallic steak shape (used as favicon and apple-touch-icon)
- Brand colors: `--flame: 25 85% 52%` (amber), `--gold: 38 75% 52%`, background pure black in dark mode

### Plan

**Generate a polished 1024x1024 app icon** via Python script using the uploaded flame as reference:
- Pure black (`#000000`) background with subtle radial gradient toward dark charcoal edges
- Recreate the flame stroke in SVG at high resolution, using the brand amber color (`hsl(25, 85%, 52%)` / `#E07020`) with a subtle gradient toward gold (`hsl(38, 75%, 52%)`)
- Thin, clean single-line flame matching the uploaded icon's proportions
- No rounded-rect masking (iOS/Android apply their own masks)
- Subtle outer glow in amber at low opacity for depth

**Generate all required sizes from the 1024 source:**
- `public/icon-1024.png` — source
- `public/app-icon-512.png` — favicon + apple-touch-icon
- `public/app-icon.png` — Capacitor/Android source icon
- Android mipmap PNGs (48, 72, 96, 144, 192px) in `public/android-icons/`

**No changes to CarnivoreXLogo or SplashScreen** — flame is app icon only per your preference.

### Technical detail

A Python script will draw the flame path as an SVG, render to 1024px PNG with Pillow/CairoSVG, then resize for all targets. The flame shape will be traced from the uploaded reference to maintain the exact contour style.

