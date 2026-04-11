

## Fix: Hero bottom text readability

### Problem
The subtitle text (`text-muted-foreground`) at the bottom of the hero sits over the image where the gradient transitions from opaque to semi-transparent. The gradient doesn't extend high enough with sufficient opacity, so the bottom text washes out — especially in dark mode where the gradient jumps from 60% opacity at 30% to 30% opacity at 100%.

### Changes

**1. `src/index.css` — Strengthen hero gradient in the text zone**

- **Light mode** (`hero-gradient`): Extend the opaque-to-semi-opaque range higher so the text area has more contrast. Change the gradient to hold solid background longer and fade more gradually:
  - `0%–15%`: solid background
  - `25%`: 0.97 opacity
  - `40%`: 0.75 (was 0.6)
  - `60%`: 0.25 (was transparent)
  - `100%`: dark tint stays

- **Dark mode** (`hero-gradient`): Add intermediate stops for a smoother, darker fade behind the text:
  - `0%`: solid background
  - `18%`: 0.92 opacity
  - `35%`: 0.65 (was 0.6 at 30%)
  - `100%`: 0.35 (was 0.3)

**2. `src/pages/Index.tsx` — Add text-shadow to bottom hero text**

Add a subtle text shadow to the h1 and subtitle paragraph for extra separation from the image, without changing colors or layout:
- h1: `style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}`
- subtitle `<p>`: `style={{ textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}`

### What stays the same
- Background image, hero height, layout, color scheme, logo position
- All other sections untouched
- Works in both light and dark mode (gradient rules are separate per mode)

### Files changed
- `src/index.css`
- `src/pages/Index.tsx`

