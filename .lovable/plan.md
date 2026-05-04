## Problem

On tall Android phones (S23+), the onboarding "Continue"/"Skip" button is clipped or pushed below the visible area. Earlier passes only added `paddingBottom` styles, but the CTA container was never actually fixed/sticky — it lives **inside** the scrollable content column (`mt-auto` inside a `flex-1 flex-col` div). Because the outer page is `min-h-screen` with no `overflow-y-auto`, on steps where content is tall (e.g. Step 3 inputs + keyboard, or steps with many options), the CTA sits below the fold and the user cannot scroll to reach it.

## Root cause (file: `src/pages/Onboarding.tsx`)

- Lines 568–574: content column is `flex-1 flex flex-col px-6 pt-4` with only `paddingBottom: env(safe-area-inset-bottom) + 100px`. No scroll.
- Lines 841–866: the CTA `<div>` is a normal child of that column using `pt-5 mt-auto` — it is **not** `position: fixed` or `sticky`. It scrolls with content and can leave the viewport.
- Outer wrapper line 497: `min-h-screen flex flex-col` with no overflow handling.

## Fix

1. **Convert CTA to a true fixed bottom bar** (lines 841–866):
   - Wrapper classes: `fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/30`.
   - Inner constrained container: `mx-auto w-full max-w-md md:max-w-2xl px-6 pt-4`.
   - Inline style: `paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'`.
   - Keep the same `<Button>` and the same conditional render guard (`current.type === "options" && multiSelect` || `current.type === "input"`).

2. **Give the scrollable content room to clear the fixed bar** (lines 568–574):
   - Replace `paddingBottom` value with `'calc(env(safe-area-inset-bottom, 0px) + 140px)'` so content never hides behind the bar.
   - Remove `mt-auto` from the CTA wrapper (no longer needed once fixed).

3. **Ensure outer page can scroll on short viewports** (line 497):
   - Change `min-h-screen` wrapper to also allow vertical scroll: keep `min-h-screen flex flex-col` but add `overflow-y-auto` on the content column (line 568) so tall steps (e.g. options lists with many items) scroll under the bar instead of being clipped. This guarantees the CTA is always reachable, even when the on-screen keyboard is open on input steps.

4. **Apply same fix to the consent step's CTA at lines ~599–615** if its button is rendered outside the conditional CTA block (verify during edit). The standard CTA path already covers `options/input`; the `consent` type has its own inline button — ensure it also respects safe-area by adding `paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 24px)'` to its container.

## Verification

- After build, on Samsung S23+ with gesture nav, navigate through every onboarding step and confirm the Continue/Skip button is always visible and tappable above the system gesture bar.
- On Step 3 with the soft keyboard open, the input remains scrollable and the CTA stays anchored at the bottom (above the keyboard if WebView resizes; otherwise reachable via scroll).
- No regression on web preview at 390×734.

## Files to modify

- `src/pages/Onboarding.tsx` (only)

No native/Android changes; this is a pure CSS/layout fix.
