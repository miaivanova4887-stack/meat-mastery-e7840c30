

## Add stable planned-meal IDs for meal-to-Progress sync

### What changes

**1. `src/hooks/useMealPlan.ts` — Add `id` to `PlannedMeal`**
- Add `id: string` to the `PlannedMeal` interface.
- Generate a unique ID (`crypto.randomUUID()`) whenever a meal is assigned via `assignMeal`. The ID is stored alongside the meal data in localStorage.
- The `load()` function backfills missing IDs on existing saved meals so old data migrates seamlessly.

**2. `src/hooks/useMealSync.ts` — Use `meal.id` as the sync tag**
- Change the tag format from `[meal-sync] ${day}-${slot}` to `[meal-sync] ${meal.id}`.
- On uncheck: delete `progress_entries` matching `[meal-sync] ${meal.id}%`.
- On check: insert entries with `[meal-sync] ${meal.id} ${meal.recipeName}`.
- Remove `day`/`slot` parameters from `syncMealToProgress` signature; only `meal` and `wasCompleted` are needed since the ID is on the meal object.

**3. `src/pages/MealPlan.tsx` — Simplify call site**
- Update `syncMealToProgress` calls to pass `meal` and `wasCompleted` only (no `day`/`slot`).

**4. `src/components/AddToPlanSheet.tsx` — Generate ID on assign**
- When building the `PlannedMeal` object before calling `assignMeal`, include `id: crypto.randomUUID()`.

### How IDs flow

```text
User picks recipe → PlannedMeal { id: "abc-123", recipeName: "Ribeye", ... }
                     ↓
assignMeal(day, slot, meal)  →  saved to localStorage with id
                     ↓
toggleCompleted → syncMealToProgress(meal, wasCompleted)
                     ↓
  check:   INSERT progress_entries with notes = "[meal-sync] abc-123 Ribeye"
  uncheck: DELETE progress_entries WHERE notes LIKE "[meal-sync] abc-123%"
```

### Migration of existing data
- `load()` in `useMealPlan` iterates all saved meals; any meal missing an `id` gets one assigned via `crypto.randomUUID()` and is persisted on next save.
- Existing progress entries tagged with old `[meal-sync] Mon-breakfast` format are not retroactively updated — they remain deletable manually. Only new syncs use the stable ID.

### Files changed
- `src/hooks/useMealPlan.ts`
- `src/hooks/useMealSync.ts`
- `src/pages/MealPlan.tsx`
- `src/components/AddToPlanSheet.tsx`

### No database migration needed
The `id` lives in the `PlannedMeal` object in localStorage. The `notes` field in `progress_entries` is already a free-text column.

