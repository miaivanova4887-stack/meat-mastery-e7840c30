## Header Top Spacing Polish

### Problem

Page headers currently use `calc(env(safe-area-inset-top, 0px) + 0.75rem)` or bare `env(safe-area-inset-top, 0px)`, which is too tight on Android and makes titles feel cramped against the status bar.

### Fix

Increase the extra top spacing to `1rem` across all sticky page headers. This is a single-value spacing adjustment only — no layout, structure, or visual redesign.

### Value change

```
paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)"
→ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)"

paddingTop: "env(safe-area-inset-top, 0px)"
→ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)"
```

Files to update:

- Pattern A — replace `+ 0.75rem` with `+ 1rem`
- Pattern B — replace bare safe-area with `calc(env(safe-area-inset-top, 0px) + 1rem)`
- Also update `Index.tsx` if it uses the same top-nav padding pattern.

What stays unchanged:

- layout and component structure,
- dark mode,
- routing,
- bottom padding values,
- header visual styling such as blur, borders, and shadows.