## Change

Make the wordmark in `public/feature-graphic.png` smaller and bolder to match the in-app header.

In `scripts/generate-feature-graphic.mjs`:
- `LOGO_HEIGHT`: `30` → `24`
- `LOGO_FONT_PX`: `22` → `18`
- SVG `font-weight`: `800` → `900` (Inter Black via the variable font)
- Composite position unchanged (`{ left: 52, top: 35 }`)

Regenerate `public/feature-graphic.png` and confirm dimensions remain 1024×500.