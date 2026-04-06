

## Switch onboarding headers from serif to sans-serif

### What
Replace `font-editorial` (Playfair Display serif) with the same sans-serif stack used by the homepage "Health is Wealth" heading on the onboarding step headers.

### Change
**`src/pages/Onboarding.tsx` — line 430**

Replace:
```tsx
<h1 className="text-[26px] font-editorial font-semibold text-foreground leading-[1.15] tracking-[-0.01em]">
```
With:
```tsx
<h1 className="text-[26px] font-black text-foreground leading-[1.15] tracking-[-0.02em]">
```

This matches the homepage hero style: default sans-serif (Inter) with `font-black` weight and tight `-0.02em` tracking. No other files or styles are modified.

