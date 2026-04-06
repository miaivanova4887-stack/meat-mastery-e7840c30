

## Soften Dark-Mode Card Borders

**File:** `src/index.css` — add one new rule block

Add a `.dark .ios-card` override after the existing `:root .ios-card` block (around line 139):

```css
.dark .ios-card {
  border-color: hsl(0 0% 100% / 0.06);
  box-shadow:
    0 0 0 0.5px hsl(0 0% 100% / 0.04),
    0 1px 3px -1px hsl(0 0% 0% / 0.5),
    0 4px 16px -6px hsl(0 0% 0% / 0.4);
}
```

Nothing else changes — light mode, layout, radius, spacing, JSX all untouched.

