

## Light Theme Aesthetic Lift — Inner Pages + Hero Copy Fix

### Problem

1. **Hero motivation subtitle** ("High-protein, zero-carb fuel...") uses `hsl(0 0% 100% / 0.7)` via the `.hero-text-overlay .text-muted-foreground` rule — barely visible against the semi-dark hero image.
2. **Recipes and MealPlan mini-hero banners** use an inline gradient (`from-background via-background/40 to-transparent`) that creates muddy contrast in light mode. The text sitting on top uses standard `text-foreground` and `text-muted-foreground` which are dark colors — but the image behind is also partially visible, making it look cheap.
3. **Page headers** across Recipes, Plan, Progress, Profile all use `bg-card/85 ios-blur border-border/30` — in light mode this looks weak and glassy rather than solid and clean.
4. **Filter pills** use `bg-secondary/60` which in light mode appears as faint gray blobs without definition.
5. **MotivationCTA** uses `bg-white/40 border-white/15` which is designed for dark mode — in light mode it creates a ghost-like card.

### Changes

**1. `src/index.css` — Light-mode inner page refinements**

- Increase hero subtitle visibility: change `.hero-text-overlay .text-muted-foreground` from `0.7` to `0.85` opacity.
- Add a `.mini-hero-overlay` class for the Recipes/MealPlan sub-hero banners with a proper light-mode gradient that keeps the bottom text area opaque enough to read:
  ```css
  :root .mini-hero-overlay {
    background: linear-gradient(to top, 
      hsl(var(--background)) 0%,
      hsl(var(--background) / 0.85) 30%,
      hsl(var(--background) / 0.3) 70%,
      transparent 100%
    );
  }
  .dark .mini-hero-overlay {
    background: linear-gradient(to top,
      hsl(var(--background)) 0%,
      hsl(var(--background) / 0.6) 40%,
      transparent 100%
    );
  }
  ```
- Add light-mode header refinement — make sticky headers more solid:
  ```css
  :root .page-header {
    background: hsl(var(--card) / 0.95);
    border-color: hsl(25 8% 88%);
  }
  ```
- Add light-mode filter pill polish:
  ```css
  :root .filter-pill-inactive {
    background: hsl(var(--secondary));
    border: 1px solid hsl(var(--border) / 0.5);
  }
  ```
- Add light-mode MotivationCTA override so it uses card background with a visible border instead of glassy white:
  ```css
  :root .motivation-cta {
    background: hsl(var(--card));
    border-color: hsl(var(--border) / 0.6);
    box-shadow: 0 2px 12px -4px hsl(var(--primary) / 0.12);
  }
  ```

**2. `src/pages/Index.tsx` — Hero subtitle fix**

No JSX change needed — the CSS opacity bump handles it.

**3. `src/pages/Recipes.tsx` — Mini-hero + header polish**

- Replace the inline hero gradient div (`bg-gradient-to-t from-background via-background/40 to-transparent`) with `mini-hero-overlay` class.
- Add `page-header` class to the sticky header div.

**4. `src/pages/MealPlan.tsx` — Same mini-hero + header treatment**

- Replace the inline hero gradient with `mini-hero-overlay`.
- Add `page-header` class to the sticky header.

**5. `src/pages/Progress.tsx` — Header polish**

- Add `page-header` class to the sticky header.

**6. `src/pages/Profile.tsx` — Header polish**

- Add `page-header` class to the sticky header.

**7. `src/components/MotivationCTA.tsx` — Light-mode aware styling**

- Add `motivation-cta` class to the outer button so the CSS override can target it.
- Change the hardcoded `border-white/15 bg-white/40` to use theme-aware classes: `bg-card/40 dark:bg-white/5 border-border/30 dark:border-white/10`.

### What stays unchanged
- Dark mode appearance (all changes scoped to `:root` or use `dark:` prefixes)
- Layout, routing, component hierarchy
- All app logic

### Files modified
1. `src/index.css` — 5 new light-mode utility rules
2. `src/pages/Recipes.tsx` — 2 class swaps (header + hero gradient)
3. `src/pages/MealPlan.tsx` — 2 class swaps
4. `src/pages/Progress.tsx` — 1 class addition
5. `src/pages/Profile.tsx` — 1 class addition
6. `src/components/MotivationCTA.tsx` — theme-aware border/bg classes

