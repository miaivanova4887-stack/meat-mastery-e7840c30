
## Fix dark-mode top line above the bottom menu

### Root cause
The issue is not the component class anymore — it is the custom CSS in `src/index.css`.

The current rule:
```css
:root nav.bottom-nav {
  border-color: hsl(25 10% 88%);
  box-shadow: 0 -1px 3px hsl(20 10% 10% / 0.06);
}
```

looks like a light-mode rule, but `:root` matches the app in both themes. So in dark mode it still applies a light border color and light-mode top shadow, overriding the intended `dark:border-transparent` behavior on the nav.

The same pattern exists for:
```css
:root .page-header { ... }
```
which is why similar white lines can keep coming back on dark headers too.

### Changes
1. **`src/index.css`**
   - Replace the fake light-only selectors with real light-only selectors:
   ```css
   html:not(.dark) nav.bottom-nav { ... }
   html:not(.dark) .page-header { ... }
   ```
   - Keep the warm border + subtle top shadow only in light mode.
   - Let dark mode fall back to the component’s existing borderless styling and `shadow-lg`.

2. **`src/components/BottomNav.tsx`**
   - Keep `dark:border-transparent` as a safeguard.
   - No layout or behavior changes needed.

### Expected result
- In **dark mode**, the line above the bottom nav disappears.
- In **light mode**, the premium warm separator stays exactly as intended.
- The same selector bug is removed for sticky page headers too, so dark mode stays visually clean across Home, Recipes, Plan, Progress, and Profile.

### Files to update
- `src/index.css`
- no functional change required in `src/components/BottomNav.tsx`
