

## Soften Dark Card Edges + Bottom Nav Border

Two CSS-only changes, dark mode only.

### 1. Further soften `.dark .ios-card` in `src/index.css`

Replace the current block (lines 186-192) with reduced values — drop border opacity from 6% to 3%, hairline highlight from 4% to 2%, and soften the shadows:

```css
.dark .ios-card {
  border-color: hsl(0 0% 100% / 0.03);
  box-shadow:
    0 0 0 0.5px hsl(0 0% 100% / 0.02),
    0 1px 3px -1px hsl(0 0% 0% / 0.4),
    0 4px 16px -6px hsl(0 0% 0% / 0.35);
}
```

Cards will still separate via subtle depth shadows but without any perceptible white stroke.

### 2. Remove bottom nav top border in dark mode

In `src/components/BottomNav.tsx`, replace the hard `border-t border-border/50` with a dark-mode-friendly class, and add a CSS rule for dark mode.

**BottomNav.tsx** (line 22) — change `border-t border-border/50` to `border-t border-border/50 dark:border-transparent`:

```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 dark:border-transparent bg-card/95 ios-blur shadow-lg bottom-nav"
```

This removes the visible top line in dark mode. The `ios-blur` backdrop + `shadow-lg` already provide sufficient visual separation. Light mode keeps its border via the existing `:root nav.bottom-nav` CSS rule.

### What stays unchanged
- Light mode cards and nav
- Layout, spacing, radius, structure
- No JSX restructuring

### Files modified
1. `src/index.css` — update `.dark .ios-card` values
2. `src/components/BottomNav.tsx` — add `dark:border-transparent`

