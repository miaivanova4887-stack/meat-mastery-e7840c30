# Refine the "Pick Breakfast" picker (and all slot pickers)

## Problem

Currently `MealPlan.tsx`'s "Pick {Slot}" modal shows the first 20 recipes from the full library regardless of slot — that's why opening "Pick Breakfast" surfaces Reverse-Seared Ribeye, Smash Burgers, Slow-Cooked Short Ribs, etc. There are already 26 breakfast-tagged recipes (`meal: "breakfast"`) that aren't being prioritized.

## Goal

When the user opens the picker for a slot, only relevant recipes appear, with breakfast tuned for quick morning meals.

## Changes (single file: `src/pages/MealPlan.tsx`)

### 1. Add a `parseMinutes` helper

Convert `time` strings to minutes so we can filter/sort:

- `"15 min"` → 15
- `"24 hrs"` / `"6 hrs"` → 1440 / 360
- Unknown / `"N/A"` → `Infinity` (sorted last, excluded from "quick" filter)

### 2. Slot-aware filtering in `filteredRecipes`

Rewrite the memo so it considers `pickingSlot`:

- Match `recipe.meal === pickingSlot` for the active slot.
- Always include `meal: "staple"` recipes (bone broth, beef stock — fit any time of day) as secondary suggestions.
- Custom recipes whose `meal` matches the slot are included and visually flagged "Custom" (existing CustomRecipe support; no schema change).
- Search query, when present, searches the full pool (so users can still find Smash Burgers from the Breakfast picker by typing the name).

### 3. Breakfast-specific rules

When `pickingSlot === "breakfast"`:

- Default to recipes with `parseMinutes(time) <= 30`.
- Sort: quick (≤15 min) first, then ≤30 min, then by ascending time.
- Boost recipes tagged `Quick`, `Easy`, or `Eggs` to the top within each band.
- Add a small toggle chip near the search: **"Quick only (≤30 min)"** — on by default. Tapping it expands the list to all breakfast recipes (e.g. Frittata 25 min stays in; Quiche 40 min appears only when toggled off).

### 4. Other slots (lunch / dinner / snack)

- Apply the same slot filter, no time cap by default (dinner can be long-cook).
- Sort by ascending time so quicker options surface first.
- Snack picker also caps at ≤30 min by default with the same toggle.

### 5. Empty-state messaging

If filters return zero results, show:
> "No breakfast recipes match. Tap 'Show all' or use search."
…with a button that clears the time filter.

### 6. Modal header polish

Show the result count under the title, e.g. `Pick Breakfast` / `12 recipes • Quick only`.

## Out of scope

- No data migrations.
- No new dependencies.
- No business-logic changes outside the picker memo + the picker modal JSX.
- Diet-tier filtering (lion / strict / animal_based) is not applied here because there's no resolved "current user tier" wired into MealPlan yet; can be a follow-up.

## Files touched

- `src/pages/MealPlan.tsx` — add `parseMinutes`, rewrite `filteredRecipes` memo, add `quickOnly` state + toggle chip + count subtitle + empty state.
