

## Gate "Snap & Log" Photo Recognition for Pro+ Users

### Current state
- **Progress page**: Already gated with `<TeaserGate requiredTier="pro">` (line 76)
- **Meal Plan page**: Two camera buttons (lines 647-664 for re-snap, lines 674-691 for empty slot snap) are **ungated** — any user can use them

### Changes

**File: `src/pages/MealPlan.tsx`**

1. **Import `useSubscription`** from `@/contexts/SubscriptionContext`
2. **Add access check**: `const { hasAccess } = useSubscription()` and derive `const canSnap = hasAccess("pro")`
3. **Gate both camera buttons**: When `canSnap` is false, disable the camera labels (add `pointer-events-none opacity-40`) and intercept clicks to show an upgrade toast or redirect to `/pricing` instead of opening the file picker
4. Alternatively, wrap both camera `<label>` elements so that clicking them when ungated shows a toast like `"Snap & Log is a Pro feature"` with a link to upgrade, matching the existing teaser pattern

This ensures the photo recognition feature on Meal Plan matches the same Pro-tier gating already applied on the Progress page.

### Technical detail

- Add `useSubscription` hook call alongside existing hooks (~line 50)
- For the re-snap button (line 647-664): conditionally render or gate the `<label>`
- For the empty-slot snap button (line 674-691): same treatment
- Use `toast` + `navigate("/pricing")` on click when not subscribed, consistent with other gated features

