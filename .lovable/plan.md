

## Fix: Remove dark-mode white border lines (for real this time)

### Root cause
The previous CSS overrides (`.dark nav.bottom-nav { border-color: transparent }`) are inside `@layer utilities`, which puts them at the same cascade layer as Tailwind's own `border-border/40` class. Tailwind's JIT-generated utilities appear later in the stylesheet and win the specificity tie.

### Solution
Apply `dark:border-transparent` directly in the component classNames. This is the most reliable approach since Tailwind will generate the correct dark-mode override at the utility layer level.

### Changes

**1. `src/components/BottomNav.tsx`** — Add `dark:border-transparent` to the nav element's className (line 22)

**2. `src/pages/Recipes.tsx`** — Add `dark:border-transparent` to the sticky header (line 375)

**3. `src/pages/MealPlan.tsx`** — Add `dark:border-transparent` to the sticky header (line 415)

**4. `src/pages/Progress.tsx`** — Add `dark:border-transparent` to the sticky header (line 50)

**5. `src/pages/Profile.tsx`** — Add `dark:border-transparent` to the sticky header (line 355)

**6. `src/index.css`** — Remove the now-redundant `.dark nav.bottom-nav` and `.dark .page-header` rules (lines 186-192)

### What stays the same
- Light mode borders unchanged
- All other styling preserved

