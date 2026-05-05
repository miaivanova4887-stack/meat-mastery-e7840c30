## Goal
Make the wordmark in `public/feature-graphic.png` exactly match the in-app `CarnivoreXLogo` component.

## Reference (from code)
`src/components/CarnivoreXLogo.tsx` renders:
- Text: `Carnivore` + `X` (mixed case in source, but with Tailwind `uppercase` → renders as `CARNIVOREX`)
- `tracking-[0.3em]` → letter-spacing `0.3em`
- `font-extrabold` → font-weight 800
- `leading-none`, baseline-aligned
- The `X` uses `text-primary` (amber, currently `#e8821a` in graphic — keep)
- Font family (from `src/index.css` body): `-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

So the visual rendering is uppercase letters with 0.3em tracking — the current graphic is already close. The fixes needed are purely to match the component's exact spec.

## Changes to `scripts/generate-feature-graphic.mjs`

In the `<style>` block, update the `.wm` rule:
- Font-family: add `'SF Pro Display'` and `'Segoe UI'`, `Roboto` to match the app's body stack
- Letter-spacing: change `6.6px` → `0.3em` (matches `tracking-[0.3em]` exactly at any size)
- Keep `font-weight: 800` and uppercase text content
- Keep font-size 22px (visual size already approved)

The wordmark `<text>` content stays as `CARNIVORE<tspan fill="${AMBER}">X</tspan>` — equivalent to the rendered DOM after Tailwind `uppercase`.

Everything else (gradient, hero, headline, subtitle, pills, amber bar) is untouched.

## Regenerate
Run `node scripts/generate-feature-graphic.mjs` to overwrite `public/feature-graphic.png` (still 1024×500). Verify dimensions via `sharp(...).metadata()` (already logged by script).

## Files
- Modified: `scripts/generate-feature-graphic.mjs`
- Regenerated: `public/feature-graphic.png`
