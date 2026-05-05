## Plan

I’ll fix the Play Store feature graphic by removing the unreliable SVG text wordmark path and compositing a real rasterized wordmark image instead.

## What I found

- There is no existing exported `logo.png`, `logo.svg`, `wordmark.png`, or similar reusable CarnivoreX wordmark asset in `src/assets/` or `public/`.
- The app header logo is the `CarnivoreXLogo` component:
  - `Carnivore` + `X`
  - uppercase via CSS
  - `font-extrabold`
  - `tracking-[0.3em]`
  - `leading-none`
  - white text with amber `X`
- Since `sharp` text rendering can fall back to a different font, the generated PNG can’t reliably match the app when the wordmark is drawn as SVG text inside the feature graphic.

## Implementation

1. Add a generation step in `scripts/generate-feature-graphic.mjs` that creates a transparent high-resolution logo PNG from a small HTML render of the real `CarnivoreXLogo` styling.
   - Use Playwright or an equivalent browser-rendering approach so the same web font/CSS rendering path is used instead of `sharp` font fallback.
   - Render only the wordmark on a transparent background.
   - Match the component styling: uppercase, extra-bold, `0.3em` tracking, inline baseline, white body text, amber `#e8821a` X.

2. Replace the current SVG `<text>` wordmark in the feature graphic overlay.
   - Remove only the wordmark `<text>` from the SVG overlay.
   - Keep headline, subtitle, pills, gradient, hero image, dark background, and amber bar unchanged.

3. Composite the rasterized logo image with `sharp`.
   - Overlay at `{ left: 52, top: 35 }`.
   - Resize to height `40px` before compositing.

4. Regenerate `public/feature-graphic.png` by running:
   - `node scripts/generate-feature-graphic.mjs`

5. Verify output.
   - Confirm `public/feature-graphic.png` exists.
   - Confirm dimensions are exactly `1024×500`.
   - Confirm the logo is now composited as an image, not rendered as fallback SVG text.

## Files to change

- `scripts/generate-feature-graphic.mjs`
- `public/feature-graphic.png` regenerated