## Goal
Regenerate the 4 App Store Connect promotional images (1024×1024, RGB, no alpha) so they read clearly even when displayed as small subscription thumbnails.

## Changes to the generation script (`/tmp/genwork/gen-promo.mjs`)

**Remove**
- "CARNIVOREX" / "CARNIVORE" + "X" wordmark (top-left)
- Cycle eyebrow micro-text ("PX", "MO", any mono ticker / meta line at bottom)
- "ANCESTRAL ABUNDANCE" / "DAILY DISCIPLINE" tagline
- Decorative thin rules and corner tickers

**Fonts (match the actual app)**
- Headings/labels → **Playfair Display** (serif, used in app for editorial accents)
- Tier + cycle labels → **Inter ExtraBold** (app's primary sans, same family as `-apple-system`/SF Pro fallback stack)
- Drop Italiana, Instrument Serif, Geist Mono entirely

**Layout (optimized for small-thumbnail readability)**
- Hero image fills full canvas with a strong dark gradient overlay (bottom 55% heavily darkened) so text has high contrast
- Centered stack, large and simple:
  - Tier word: `ELITE` or `PRO` in Inter ExtraBold, ~420px, tracked tight, white with subtle accent tint (gold `#e1b03f` for Elite, silver `#c8ccd3` for Pro)
  - Cycle word: `YEARLY` or `MONTHLY` (spelled out, no abbreviations) in Inter ExtraBold ~96px, white, placed directly under the tier word
- No other text, no rules, no meta
- Slight drop shadow on text for legibility against hero

**Output**
- Same 4 files in `/mnt/documents/`: `elite_yearly.png`, `elite_monthly.png`, `pro_yearly.png`, `pro_monthly.png`
- 1024×1024, flattened on `#000000`, `.removeAlpha().png()`

## QA
After generation, downscale each PNG to 88×88 and 40×40 and inspect to confirm `ELITE`/`PRO` and `YEARLY`/`MONTHLY` remain legible at thumbnail size. Iterate font weight/size if needed before delivering.
