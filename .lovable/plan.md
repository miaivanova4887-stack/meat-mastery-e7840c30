

## Match Meal Quantity Selector Style to Day Tabs

The day tabs use `rounded-xl` with `gap-1` between individual rounded buttons. The meal selector uses `rounded-lg overflow-hidden gap-px` on a wrapper, making individual buttons rectangular with no rounding.

### Change in `src/pages/MealPlan.tsx` (lines 470-487)

Remove the shared background wrapper approach and instead style each button individually, matching the day tabs pattern:

- Change container from `flex bg-secondary rounded-lg overflow-hidden gap-px` to `flex gap-1`
- Add `rounded-xl` to each button
- Add `bg-secondary/60` for inactive state (matching day tab inactive style)
- Keep `flex-1` for even distribution

```tsx
<div className="flex gap-1">
  {[1, 2, 3, 4].map((n) => (
    <button
      key={n}
      onClick={...}
      className={`flex-1 py-1.5 text-[11px] font-semibold transition-all rounded-xl ${
        profile.mealsPerDay === n
          ? "bg-foreground text-background"
          : "bg-secondary/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      {n} {n === 1 ? "meal" : "meals"}
    </button>
  ))}
</div>
```

One file changed: `src/pages/MealPlan.tsx`

