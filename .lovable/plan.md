## Goal
Make the personalized tip card on the Home page (e.g. "Facing pushback? Check out Success Stories…") disappear when the user taps it.

## Change
File: `src/pages/Index.tsx`

1. Compute which tip key is active (`sugar_cravings` | `low_energy` | `digestive` | `social_pressure` | `null`) instead of just the translated string.
2. Add a `dismissedTips` state, initialized from `localStorage` (key: `home.dismissedTips`, JSON array of struggle keys). This keeps a tap-dismissed tip from reappearing on next visit / re-render.
3. Only render the tip card when the active tip key exists AND it's not in `dismissedTips`.
4. Make the card itself tappable (wrap in `<button>` or add `onClick` to the existing card div) — on tap, append the key to `dismissedTips` and persist to `localStorage`. Add `cursor-pointer` and `aria-label="Dismiss tip"`.
5. Optional polish: brief fade-out via existing `animate-fade-in` / opacity transition before removal (keep it minimal — just unmount is fine).

## Out of scope
- No new translations, no backend persistence, no changes to other personalized surfaces (greeting, subtitle, quotes, feature ordering).
- No design rework of the card.
