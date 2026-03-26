

## Fix Day Tabs & Meal Quantity Layout

Two targeted UI tweaks in `src/pages/MealPlan.tsx`. No logic changes.

### 1. Day tabs fit in one screen width (line 434-462)

Remove `overflow-x-auto` scrolling and make tabs fill the width equally:
- Change container from `flex gap-1.5 overflow-x-auto -mx-4 px-4 scrollbar-hide` to `grid grid-cols-7 gap-1`
- Remove `flex-shrink-0` and `min-w-[52px]` from each button
- Keep all existing styling, active states, today dot, and completion counts

### 2. Harmonize meal quantity selector in day summary card (lines 466-486)

Currently the row has the day name, a tiny 1-2-3-4 toggle, and "meals" label all crammed on the left with empty space on the right. Redesign:
- Move the day name to be a standalone label
- Make the meal count selector span the full width of the remaining space, with equal-width buttons inside a rounded container
- Layout: `<day label>` left, `<1|2|3|4 meals>` right, with the selector buttons evenly spaced using `flex-1` on each button

```tsx
<div className="flex items-center justify-between mb-2">
  <span className="text-sm font-bold text-foreground">{activeDay}</span>
  <div className="flex items-center gap-2">
    <div className="flex bg-secondary rounded-lg overflow-hidden">
      {[1, 2, 3, 4].map((n) => (
        <button key={n} ...same logic...
          className={`px-3 py-1 text-[11px] font-semibold transition-all ${
            profile.mealsPerDay === n ? "bg-foreground text-background" : "text-muted-foreground"
          }`}
        >{n}</button>
      ))}
    </div>
    <span className="text-[10px] text-muted-foreground">meals</span>
  </div>
</div>
```

Increases button padding from `px-2 py-0.5 text-[10px]` to `px-3 py-1 text-[11px]` for better tap targets, and moves the selector to the right side for balanced layout.

### File changed
`src/pages/MealPlan.tsx` — lines 434-486 only

