# Shorten "Recommended for you" label on Home cards

## Problem

The Home page recommendation cards (Recipes, Ingredients, Exercise, Athletic Fuel, …) display "RECOMMENDED FOR YOU" under each title. At the current 2-column card width on a 390px viewport, the label wraps to two lines and competes with the card title.

## Change

Shorten the label to a single concise word.

### Files

- `src/i18n/en.json` — `home.recommendedForYou`: `"Recommended for you"` → `"Recommended"`
- `src/i18n/fr.json` — `home.recommendedForYou`: `"Recommandé pour vous"` → `"Recommandé"`

No component changes — `src/pages/Index.tsx` already reads `t("home.recommendedForYou")`, so both English and French render the shorter label on one line.

## Out of scope

Visual styling, card layout, and the arrow chevron stay untouched.
