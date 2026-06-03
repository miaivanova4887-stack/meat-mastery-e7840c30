# Fix iOS focus zoom on Budget custom item form

## Root cause

`src/components/budget/BudgetPlanner.tsx` lines 74–85 render a shared inline-edit `<input>` (used for both product name and weekly price) with `text-sm` (14px). iOS Safari auto-zooms any input under 16px and never restores scale when the keyboard dismisses.

`src/components/community/CreatePostSheet.tsx` has the same defect on the title `<input>` (line 159–166, `text-sm`) and body `<textarea>` (line 173–180, `text-sm`). These are raw `<input>` / `<textarea>` elements, not the shadcn primitives, so the recent `Input`/`Textarea` font-audit fixes don't reach them.

## Changes

### 1. `src/lib/utils.ts` — add util

Append the `resetViewportScale()` helper exactly as specified in the bug report. Reads the live `<meta name="viewport">` content, briefly appends `, maximum-scale=1` to force iOS to rescale, then restores the original on the next animation frame.

### 2. `src/components/budget/BudgetPlanner.tsx` — fix the inline-edit input

Inside the `editing === true` branch (lines 74–85), the `<input>`:
- add `text-base md:text-sm` to its `className`
- wrap the existing `onBlur={commit}` so it also calls `resetViewportScale()` after committing

### 3. `src/components/community/CreatePostSheet.tsx` — fix raw title + body fields

- Title `<input>` (line 159): swap `text-sm` → `text-base md:text-sm`, add `onBlur={resetViewportScale}`.
- Body `<textarea>` (line 178): same swap and same `onBlur`.

### 4. Confirmations (no edits needed)

- `src/components/ui/input.tsx` line 11 — already `text-base ... md:text-sm`. PASS.
- `src/components/ui/textarea.tsx` line 11 — already `text-base md:text-sm` (fixed in font audit). PASS.
- `index.html` viewport meta — no `user-scalable=no`, no `maximum-scale=1`. PASS.

## Files touched

- `src/lib/utils.ts` (add export)
- `src/components/budget/BudgetPlanner.tsx` (1 className + 1 onBlur)
- `src/components/community/CreatePostSheet.tsx` (2 classNames + 2 onBlur)

## Verification

1. Budget → tap a price / item name → no zoom on iOS Safari simulator.
2. Dismiss keyboard → viewport snaps back to scale 1.
3. Community → "Write a Post" → tap title and body → no zoom; dismiss → no leftover zoom.
4. At 320 px width (iPhone SE) the inline input still renders correctly (text-base = 16 px is intentionally larger than the prior 14 px; this is the whole point and matches Apple's HIG min for editable text).

## Out of scope

Wider sweep of every raw `<input>` / `<textarea>` in the codebase (Onboarding, AdminNotifications, ShoppingBag, etc.) — tracked as a follow-up. This plan only fixes the two surfaces called out in the bug.
