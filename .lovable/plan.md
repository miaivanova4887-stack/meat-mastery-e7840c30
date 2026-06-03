## Goal

Make the light theme feel state-of-the-art and unmistakably premium — without adding, removing, or restructuring a single component. Pure work on the color tokens, gradient stops, and the light-mode-scoped utility classes inside `src/index.css`. Dark theme is byte-for-byte untouched.

## Audit of today's light theme

- Background `32 12% 97%` warm ivory — pleasant but lifts to near-flat white on AMOLED-ish phone screens; lacks tonal grounding.
- Primary `22 85% 48%` — saturated burnt-orange. Reads loud on warm cream; can feel "stock" rather than couture.
- Borders/inputs sit at 90/94% L with neutral hue → cards lose edge definition on bright OLEDs.
- Shadows are charcoal-tinted (`hsl(20 10% 10% / .x`) — slightly cool against the warm bg, robbing depth.
- `.ios-card` border `28 10% 90% / 0.7` plus a 2-layer shadow → uniform but flat, no specular edge.
- `.hero-gradient` light variant uses a `0 0% 0%` cap → cool black bleed over warm ivory.
- `.motivation-cta` uses pure white→bone — no tonal lift, premium CTAs look like plain cards.
- Section accent bar gradient `primary → gold` is good; underutilized elsewhere.

## Design direction (taste statement)

"Aged ivory paper under museum lighting." Think Aesop store, Hermès editorial, Apple Pages export. Background warms one notch into **bisque/parchment**. Surfaces stay near-white but get a true paper hierarchy (page < card < popover). Primary shifts from "construction orange" to **burnished copper** — same warmth, lower saturation, deeper L → premium, not promotional. Borders gain a hairline warm tint so they read as embossed instead of cut. Shadows recompose around a **warm umber** key (matches bg hue) for the soft long-shadow you see in Apple marketing screenshots. Gradients gain a faint copper-to-gold wash so every "premium" surface (CTA, hero fade, accent bar) shares a single luminous family.

## Token changes — `src/index.css` `:root` only

```text
--background      32 24% 95%     (bisque parchment, +12 sat, slightly deeper)
--foreground      22 18% 9%      (warmer near-black, richer than cool 5%)
--card            36 30% 99%     (warm pearl — lifts above bg)
--popover         36 30% 99%
--card-foreground / popover-foreground  22 18% 9%

--primary         20 72% 42%     (burnished copper — deeper, less neon)
--primary-foreground  36 30% 99%

--secondary       30 14% 92%     (warm linen)
--secondary-foreground  22 14% 18%
--muted           30 12% 93%
--muted-foreground 22 14% 36%    (slightly darker for AA on warm cards)
--accent          25 22% 90%     (champagne)
--accent-foreground 20 72% 42%

--destructive     2 68% 46%      (oxblood, not fire-red)

--border          28 18% 86%     (warm hairline)
--input           28 14% 88%
--ring            20 72% 42%

--flame           20 72% 42%     (sync with primary)
--ember           14 50% 36%
--gold            38 62% 50%     (richer, slightly darker)
--bone            34 24% 96%

--sidebar         36 30% 99%
--sidebar-background  34 22% 97%
--sidebar-border  28 18% 86%
--sidebar-accent  25 22% 90%
--sidebar-accent-foreground 22 14% 18%
--sidebar-primary 20 72% 42%

--chart-1 20 72% 42%
--chart-2 38 62% 50%
--chart-3 14 50% 36%
--chart-4 22 10% 38%
--chart-5 28 14% 78%
```

Shadow system — re-key around warm umber so depth matches paper temperature:

```text
--shadow-2xs  0 1px 2px 0       hsl(22 30% 12% / 0.05)
--shadow-xs   0 1px 3px 0       hsl(22 30% 12% / 0.07)
--shadow-sm   0 2px 6px -1px    hsl(22 30% 12% / 0.08),  0 1px 2px -1px hsl(22 30% 12% / 0.06)
--shadow      0 4px 14px -3px   hsl(22 30% 12% / 0.10)
--shadow-md   0 8px 22px -6px   hsl(22 30% 12% / 0.12)
--shadow-lg   0 14px 36px -10px hsl(22 30% 12% / 0.14)
--shadow-xl   0 22px 50px -14px hsl(22 30% 12% / 0.16)
--shadow-2xl  0 32px 64px -18px hsl(22 30% 12% / 0.22)
```

## Gradient & utility refinements (light-mode scoped only)

All edits live behind `:root` or `html:not(.dark)` so dark theme is provably untouched.

- `:root .ios-card`: replace cool-tinted shadow with a two-layer warm specular — `0 1px 0 hsl(36 40% 100% / 0.7) inset, 0 2px 8px -2px hsl(22 30% 12% / 0.08), 0 12px 28px -10px hsl(22 30% 12% / 0.10)`. Border becomes `hsl(28 22% 84% / 0.7)` for a barely-visible engraved edge.
- `:root .ios-blur`: bump to `saturate(220%) blur(28px)` with a `background-color: hsl(36 30% 99% / 0.72)` so frosted surfaces (sticky headers, nav) get true frosted-glass tonality on warm bg.
- `:root .hero-gradient`: re-cap the dark fade with the warm foreground hue instead of pure black — `hsl(22 30% 8% / 0.22)` at 100%, keep compressed bottom ramp.
- `:root .mini-hero-overlay`: same warm-cap principle, plus a 1% champagne tint mid-stop for editorial feel.
- `:root:not(.dark) .motivation-cta`: gradient becomes `linear-gradient(135deg, hsl(36 30% 99%), hsl(34 30% 95%) 60%, hsl(28 26% 92%))` with border `hsl(28 22% 84% / 0.6)` and shadow `0 1px 0 hsl(36 40% 100%) inset, 0 6px 20px -8px hsl(22 30% 12% / 0.14)` — gives CTAs a quiet copper-pearl luminance.
- `html:not(.dark) .page-header`: background `hsl(36 30% 99% / 0.86)` with `backdrop-filter: saturate(220%) blur(20px)`, border `hsl(28 18% 86%)` — premium sticky headers.
- `html:not(.dark) nav.bottom-nav`: tint border `hsl(28 18% 84%)`, shadow `0 -1px 0 hsl(36 40% 100%) inset, 0 -2px 10px hsl(22 30% 12% / 0.06)` — adds the same engraved edge.
- `:root .filter-pill-inactive`: background `hsl(30 18% 94%)`, border `hsl(28 18% 84% / 0.6)` for a champagne chip feel.
- `:root .section-accent-bar`: extend to a 3-stop gradient `primary → gold → primary` and widen to 40px for a metallic foil look.
- `:root .light-divider`: re-tint to a warm metallic hairline `linear-gradient(90deg, hsl(28 22% 80%), hsl(28 18% 86% / 0.4), transparent)`.
- New utility `:root .premium-surface` (unused by components — reserved future hook; **skip if you want zero net new utilities**, see Option below).

## Scope guarantee

- Only `src/index.css` is edited.
- Zero changes inside any `.dark` selector block.
- No component, layout, spacing, typography, or asset change.
- No new component, no new file.
- `tailwind.config.ts` untouched — all tokens already map via CSS variables.

## Verification plan

1. Visually diff `/` (Home), `/auth`, `/pricing`, `/profile`, `/recipes` in light mode.
2. Confirm dark mode pixels are identical (toggle theme; check Home + Pricing).
3. AA contrast spot check: `--foreground` on `--background`, `--muted-foreground` on `--card`, `--primary-foreground` on `--primary`.
4. iOS Safari frosted-blur check on sticky header.

## Option toggle for you

- **A. Ship full palette + gradient refresh as above** (recommended — biggest premium lift).
- **B. Tokens only** — change just the `:root` color tokens and shadow vars; skip the utility-class gradient rewrites. Smaller blast radius, ~70% of the visual upgrade.
- **C. Gradients only** — keep current tokens, only refine `.ios-card`/`.motivation-cta`/`.hero-gradient`/`.page-header`. Lowest risk, ~40% lift.

Default to **A** unless you say otherwise.