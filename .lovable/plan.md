## Change

Restore the SVG-composited feature graphic (with the male athletic hero from `src/assets/hero-athletic.jpg`) and double the wordmark size to match the user's request.

## Implementation

In `scripts/generate-feature-graphic.mjs`:
- Keep the existing SVG + sharp composition pipeline (hero on right, gradient fade, headline, subtitle, amber pills, amber bar).
- Keep `heroPath = src/assets/hero-athletic.jpg` (the male visual from the previous version).
- Double the logo size: `LOGO_HEIGHT` 24 → 48, `LOGO_FONT_PX` 18 → 36.
- Keep wordmark position at `{ left: 52, top: 35 }` (still fits comfortably above the headline at y=210).
- Keep `font-weight="900"` (Inter Black) for the bold app-matching look.

Then run `node scripts/generate-feature-graphic.mjs` to regenerate `public/feature-graphic.png` and verify it is exactly 1024×500.

## Files
- `scripts/generate-feature-graphic.mjs` — bump LOGO_HEIGHT and LOGO_FONT_PX
- `public/feature-graphic.png` — regenerated