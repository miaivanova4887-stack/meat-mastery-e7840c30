## Two-Track "Add to Plan" System

Two complementary flows for assigning recipes to the meal plan: a **Quick Add bottom sheet** from Recipes (speed shortcut) and a **visual placement mode** on the Meal Plan screen (full canvas experience).

---

### Track 1: Quick Add Bottom Sheet (from Recipes)

**New file: `src/components/AddToPlanSheet.tsx**`

A `Drawer`-based bottom sheet triggered from recipe cards.

- **Recipe header** — name + cal/protein summary (read-only)
- **Day selector** — horizontal row of 7 day chips (Mon–Sun), starting from today, showing a dot on days with meals already planned. Selected = `bg-primary text-primary-foreground rounded-xl`
- **Meal slot selector** — 2×2 grid using `SLOT_LABELS` (Breakfast, Lunch, Dinner, Snack). Occupied slots for the selected day show a small indicator
- **Dynamic CTA** — "Add to Dinner on Tue" style label, disabled until both selected. Full-width `bg-primary rounded-xl`
- **On confirm** — calls `assignMeal()`, closes sheet, fires sonner toast with "View Plan" (navigate) + "Undo" (removeMeal) actions

Props: `{ open, onOpenChange, recipe: { name, cal, protein, fat, time, serving } }`

**Edit: `src/pages/Recipes.tsx**`

- Import `AddToPlanSheet` and `useMealPlan`
- Add state `planTarget` (recipe data or null) to control sheet
- Add a `CalendarPlus` icon button next to the Heart button in each `RecipeCard` (line ~183 area)
- On tap → sets `planTarget`, opens sheet
- Sheet close → clears target

---

### Track 2: Visual Placement Mode (on Meal Plan screen)

**Edit: `src/pages/MealPlan.tsx**`

Support receiving a recipe via navigation state (`navigate("/meal-plan", { state: { assignRecipe: {...} } })`), entering an **assignment mode**:

- Read `location.state?.assignRecipe` on mount
- When present, show a persistent top banner: "Placing: {recipe name} — tap a slot below" with a Cancel button
- Day tabs and meal slots render normally, but empty slots gain a pulsing `+ Add here` affordance
- Tapping any slot (empty or occupied) assigns the recipe via `assignMeal()`, clears the assignment state, and shows a success toast
- This reuses all existing day selector, slot rendering, and `handlePick` logic — no new data model needed

**Also add to Recipes page:**

- A second action alongside the Quick Add button: "Plan →" text link or a long-press alternative that navigates to `/meal-plan` with the recipe in route state
- This gives users the choice: quick sheet or full visual placement

---

### What stays unchanged

- `useMealPlan.ts` — no hook changes, same `assignMeal`/`removeMeal` API
- Meal Plan page layout, day selector, slot cards, AI generator, shopping list
- Recipe card structure, favorites, shopping bag, filters
- Light/dark mode styling — uses existing design tokens throughout

### Files

1. **Create** `src/components/AddToPlanSheet.tsx`
2. **Edit** `src/pages/Recipes.tsx` — add CalendarPlus button + sheet + "Plan →" nav action
3. **Edit** `src/pages/MealPlan.tsx` — read route state, render assignment banner, handle slot tap in assignment mode

I’d tighten your plan slightly like this:

## **Two-Track Add to Plan System**

Implement two complementary assignment flows:

1. **Quick Add** from Recipes via bottom sheet for fast date + meal selection.
2. **Place in Plan** via Meal Plan assignment mode for visual placement on the planning canvas.

## **Product intent**

Quick Add is the speed shortcut. Meal Plan assignment mode is the full planning experience. Both use the existing `useMealPlan` model and should feel consistent, premium, and mobile-first.

## **Guardrails**

- Quick Add should not replace the full placement flow.
- Meal Plan remains the primary visual planning surface.
- No data model changes. No regression to existing recipe browsing or meal plan behavior outside assignment mode.