

## Fix: Meal unmark removes Progress entries

### Problem
`useMealSync.syncMealToProgress` only handles the "mark completed" case. When `wasCompleted` is true (unchecking), it returns early. Progress entries are never deleted on uncheck.

### Solution
Add delete logic to `useMealSync` that removes the matching progress entries when a meal is unmarked. Use `day-slot` as a stable identifier in the notes field so entries can be reliably matched for deletion, even if the same recipe appears in multiple slots.

### Changes

**1. `src/hooks/useMealSync.ts`**
- Change the notes tag format from `[meal-sync] {recipeName}` to `[meal-sync] {day}-{slot} {recipeName}`. This makes each entry uniquely identifiable by its plan position.
- When `wasCompleted` is `true` (unchecking): delete all `progress_entries` where `user_id` matches, `category = 'diet_trends'`, and `notes` starts with `[meal-sync] {day}-{slot}`.
- When `wasCompleted` is `false` (checking): insert entries as before, but with the new notes format.
- Update the function signature to accept `day` and `slot` parameters alongside `meal` and `wasCompleted`.

**2. `src/pages/MealPlan.tsx`**
- Update the call site at line ~676 to pass `activeDay` and `slot` to `syncMealToProgress`.

### Technical detail
- Delete uses `.like("notes", "[meal-sync] Mon-breakfast%")` pattern to match all metrics (calories, protein, fat) for that specific meal slot.
- No migration needed — `progress_entries` already supports delete via RLS for the owning user.
- The `day-slot` key is stable per plan position, so re-marking after unmarking creates fresh entries without duplicates.
- Same recipe in two slots gets different tags (e.g., `Mon-breakfast` vs `Mon-dinner`), so unmarking one doesn't affect the other.

