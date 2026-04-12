

## Wire MotivationCTA to coaching booking on all pages

### Problem
On the Homepage, "Need extra motivation?" opens the coaching booking modal. On all other pages (Budget, Benefits, Myths, Athletic, Sustain, Stories, Cravings, GettingStarted, Guide), it navigates to a content page instead — inconsistent experience.

### Solution
Move the coaching booking state management into the `MotivationCTA` component itself, so every instance automatically opens the coaching modal without each parent page needing to wire it up manually.

### Changes

**1. `src/components/MotivationCTA.tsx`**
- Import `CoachingBooking` and `useState`
- Add internal state for `coachingOpen`
- Render `<CoachingBooking>` inside the component
- Default click behavior opens the coaching modal (remove goal-based navigation)
- Keep the `onClick` prop as an optional override for any page that needs custom behavior

**2. `src/pages/Index.tsx`**
- Remove the `coachingOpen`/`coachingInitialScreen` state and `CoachingBooking` render that are tied to MotivationCTA
- Simplify to just `<MotivationCTA />` (no onClick prop needed)
- Keep any other `CoachingBooking` usage (e.g. from URL params `?coaching_payment=success`) if it exists separately

**3. Pages that need NO changes**
All other pages (`BudgetEating`, `Benefits`, `Myths`, `AthleticPerformance`, `Sustain`, `Stories`, `Cravings`, `GettingStarted`, `Guide`) already render `<MotivationCTA />` without props — they will automatically get the coaching modal behavior.

### Files changed
- `src/components/MotivationCTA.tsx` — embed CoachingBooking modal (~15 lines added)
- `src/pages/Index.tsx` — remove redundant coaching state/render for MotivationCTA (~5 lines removed)

### What stays the same
- CoachingBooking component unchanged
- Homepage coaching flow via URL params still works
- All styling, layout, dark/light mode unaffected

