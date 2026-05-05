## Goal
Create `public/feature-graphic.png` at exactly 1024×500px for the Google Play Store, using the existing `src/assets/hero-athletic.jpg` (muscular male hero) and the app's CarnivoreX wordmark style.

## Approach
Use Node with the `sharp` library (already lightweight and works without canvas native deps) plus an SVG composite. SVG handles all text + gradient overlay; sharp composites it on top of the resized hero image.

If `sharp` isn't already a dep, install it as a devDependency only for asset generation (or run via `npx sharp-cli` alternative). Simplest: add a one-off script `scripts/generate-feature-graphic.mjs`, run it once, commit the PNG. Script can stay for re-runs.

## Layout (1024×500)
```
+------------------------+------------------------+
| 5px amber bar          |                        |
|                        |   hero-athletic.jpg    |
|  CARNIVOREX wordmark   |   (cover-fit, right)   |
|                        |                        |
|  Health is Wealth.     |   left-edge dark→clear |
|                        |   gradient overlay     |
|  Let food be your...   |                        |
|                        |                        |
|  [Lion] [Strict] [AB]  |                        |
+------------------------+------------------------+
```

- Canvas: solid `#0e0c09` base
- Hero image: resized to cover the right ~60% (x: 410→1024), with a horizontal gradient overlay from `#0e0c09` (100% at x=410) to transparent (at x=720) so left text stays readable, plus a subtle right-side vignette
- 5px amber `#e8821a` bar pinned to the left edge, full height
- Wordmark "CARNIVORE" white extrabold + "X" amber, tracked uppercase, ~22px — matches `CarnivoreXLogo`
- Headline "Health is Wealth." — white `#f5f0e8`, bold, ~64px
- Subtitle "Let food be your medicine — meat heals." — `#a09890`, ~22px
- Three pill badges: amber bg `#e8821a` at ~15% opacity with amber border + amber text, rounded-full, padded — labels: "Lion Diet", "Strict Carnivore", "Animal-Based"
- Fonts: system sans-serif stack via SVG (Inter / SF Pro / Helvetica) — matches app's `font-display` stack in `tailwind.config.ts`

## Steps
1. Add `scripts/generate-feature-graphic.mjs` that:
   - Reads `src/assets/hero-athletic.jpg`
   - Builds an SVG overlay (1024×500) with gradient + text + bar + pills
   - Composites: base color → hero image (positioned right, resized to cover) → SVG overlay
   - Writes `public/feature-graphic.png`
2. Run `node scripts/generate-feature-graphic.mjs` (installing `sharp` first if missing)
3. Verify with `file public/feature-graphic.png` and `sharp` metadata that dimensions are exactly 1024×500

## Files
- **new**: `scripts/generate-feature-graphic.mjs`
- **new**: `public/feature-graphic.png` (1024×500)
- **possibly modified**: `package.json` (devDependency on `sharp` if not already present)

No app/runtime code is touched; this is a build-time asset only.
