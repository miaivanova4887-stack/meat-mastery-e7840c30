## Change

Reduce the composited wordmark in `public/feature-graphic.png` by ~25%.

In `scripts/generate-feature-graphic.mjs`:
- `LOGO_HEIGHT`: `40` → `30`
- `LOGO_FONT_PX`: `28` → `22`
- Composite position unchanged (`{ left: 52, top: 35 }`)

Then regenerate `public/feature-graphic.png` and verify dimensions remain 1024×500.