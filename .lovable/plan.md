# Fix: Recipes & Plan top panel dark in dark theme

## Root cause

In `src/index.css` the light-mode polish rule:

```css
:root .ios-blur {
  background-color: hsl(36 30% 99% / 0.72);
  backdrop-filter: saturate(220%) blur(28px);
  ...
}
```

uses `:root`, which matches `<html>` in both light AND dark mode. The sticky page headers in `src/pages/Recipes.tsx` and `src/pages/MealPlan.tsx` use `ios-blur`, so they get a warm pearl light background even when `.dark` is active, producing the grey panel in the screenshots.

The same pattern is already handled correctly elsewhere in the file via `:root:not(.dark)` (e.g. `.motivation-cta`).

## Change (single file, light theme untouched)

`src/index.css` — change the selector only, keep the declarations identical:

- `:root .ios-blur { ... }` → `:root:not(.dark) .ios-blur { ... }`

Result:
- Light mode: identical (warm pearl frosted header).
- Dark mode: falls back to the base `.ios-blur` utility (just blur + saturate, no light background), so headers render over `bg-card/85` which is near-black in dark theme — matching the pre–light-theme look.

## Scope guardrails

- No component changes.
- No other selectors touched (other `:root` rules like `.mini-hero-overlay`, `.filter-pill-inactive`, `.ios-card`, `.light-divider`, `.section-accent-bar` are left alone since the user only flagged the top panel).
- No light-mode tokens or styles modified.

## Verification

- Toggle dark mode, open `/recipes` and `/meal-plan`; sticky header should be dark, not grey.
- Toggle light mode on same pages; header should look unchanged from current build.
