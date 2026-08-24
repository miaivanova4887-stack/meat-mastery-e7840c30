# Onboarding Step 4 Font Styling Fix

## Goal
Make the fonts on Onboarding Step 4 ("What's your target?" health targets) match the styling used on all other onboarding steps.

## Current State
- Standard options steps use `text-[14px] font-medium` for card labels and `text-[11px] text-muted-foreground font-light` for descriptions.
- Step 4 category headers use `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`, which is visually inconsistent with the other steps.
- Step 4 target pill/tile labels already use `text-[14px] font-medium`, matching other step labels, but the category header font does not.

## Steps
1. Audit the exact font classes on Step 4 category headers and target labels.
2. Update `src/pages/Onboarding.tsx` so Step 4 category headers use the same font style as option-card labels on other steps (`text-[14px] font-medium`).
3. Keep the existing layout, spacing, selection states, and `onboarding-pill-*` / `onboarding-card-*` classes intact.
4. Verify the change in the preview so Step 4 visually matches Steps 1, 2, 5, 6, 7, etc.

## Files to Change
- `src/pages/Onboarding.tsx` (line ~818 category header span)
