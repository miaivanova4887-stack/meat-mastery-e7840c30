

## Fix Yoga Flow Pose Names Not Loading

### Root Cause

The content_blocks data is correctly seeded in the database (all 40 rows present). The component code correctly calls `t("exercise.yoga_flow.pose_1_name")` etc. 

The bug is in `useContentOverrides.ts`: after the initial fetch, `addResourceBundle` merges the overrides into i18n, but **does not emit a `languageChanged` event**. Components using `useTranslation` never re-render because they don't know the resources changed. The `reloadContentOverrides` function correctly emits this event, but the initial load path does not.

### Fix

**File: `src/hooks/useContentOverrides.ts`** — Add `i18n.emit("languageChanged", i18n.language)` at the end of `fetchAndApplyOverrides()`, after the `addResourceBundle` loop (line 89). This is the same pattern already used in `reloadContentOverrides` (line 102).

This single line fix will cause all components using `useTranslation` (including YogaFlowProgram) to re-render with the loaded content_blocks data.

### What Changes
| File | Change |
|------|--------|
| `src/hooks/useContentOverrides.ts` | Add one line after line 89: `i18n.emit("languageChanged", i18n.language);` |

### What Does NOT Change
- `YogaFlowProgram.tsx` — no changes needed, code is correct
- `Exercise.tsx` — untouched
- Database content — already correct
- Timer logic, auto-advance, progress bar — untouched

