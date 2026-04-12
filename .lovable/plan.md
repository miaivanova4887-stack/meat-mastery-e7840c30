

## Remove white border lines in dark mode

### Problem
In dark mode, two types of visible white lines appear:
1. **Bottom nav top border**: `border-t border-border/40` on `BottomNav.tsx` — visible on every page
2. **Page header bottom border**: `border-b border-border/30` or `border-b border-border/40` on sticky headers across Recipes, MealPlan, Progress, Profile pages

The `--border` token in dark mode is `0 0% 18%`, which at 30-40% opacity still creates a visible white line against the pure black background.

### Solution
Add dark-mode CSS overrides to make these borders invisible, keeping light-mode borders intact.

### Changes

**`src/index.css` — Add dark-mode overrides (~6 lines)**

```css
.dark nav.bottom-nav {
  border-color: transparent;
}

.dark .page-header {
  border-color: transparent;
}
```

This removes the visible border in dark mode for:
- Bottom navigation (all pages)
- Page headers that use the `.page-header` class (MealPlan, Progress, Profile)

For page headers that don't have the `.page-header` class but still show the line, we also need to add the class or use a broader selector. Checking the pages:
- **Recipes** (`src/pages/Recipes.tsx`) — need to find its header and add `page-header` class if missing
- **MealPlan** — already has `page-header`
- **Progress** — already has `page-header`
- **Profile** — already has `page-header`

**`src/pages/Recipes.tsx` — Add `page-header` class to the sticky header** (if not present)

**`src/pages/Index.tsx` — Check if homepage has any border line near bottom nav area** (the homepage hero doesn't have a sticky header, so likely just the bottom nav fix covers it)

### Files changed
- `src/index.css` — Dark-mode border overrides for `.bottom-nav` and `.page-header`
- `src/pages/Recipes.tsx` — Add `page-header` class to sticky header (if missing)

### What stays the same
- Light mode borders unchanged
- Layout, shadows, blur effects all preserved
- No structural changes

