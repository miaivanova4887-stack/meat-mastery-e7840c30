

## Improve Meal Quantity Selector UX

### Current state
The row shows `{activeDay}` on the left and `[1][2][3][4] meals` on the right. The "meals" label is vague — it doesn't tell the user what the numbers mean or confirm their selection.

### Proposed change (lines 466-487 of `MealPlan.tsx`)

Replace the current layout with a more descriptive design:

1. **Add a contextual label row** above the selector: `"Meals planned for {activeDay}"` as a small heading
2. **Replace the bare number buttons + "meals" suffix** with labeled buttons that read `"1 meal"`, `"2 meals"`, `"3 meals"`, `"4 meals"` — each button gets `flex-1` so they fill the row evenly
3. **Drop the separate "meals" text** since it's now embedded in each button

```tsx
<div className="mb-2">
  <span className="text-[11px] text-muted-foreground mb-1.5 block">
    Meals planned for {activeDay}
  </span>
  <div className="flex bg-secondary rounded-lg overflow-hidden gap-px">
    {[1, 2, 3, 4].map((n) => (
      <button
        key={n}
        onClick={() => { /* same logic */ }}
        className={`flex-1 py-1.5 text-[11px] font-semibold transition-all ${
          profile.mealsPerDay === n
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {n} {n === 1 ? "meal" : "meals"}
      </button>
    ))}
  </div>
</div>
```

This makes the selector self-explanatory: the label tells users what they're choosing, and each button clearly states the option. The full-width layout eliminates the cramped-left / empty-right imbalance.

### File changed
`src/pages/MealPlan.tsx` — lines 466-487 only

