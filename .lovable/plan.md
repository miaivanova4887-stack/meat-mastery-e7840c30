## Problem

On the Sign In screen, social login buttons have poor visibility:
- **Google button**: dark gray (`bg-secondary`) on near-black background → very low contrast, the button barely reads as tappable.
- **Apple button**: rendered with `bg-foreground text-background`, which is correct Apple HIG (white on black in dark mode), but it sits behind the bottom nav and gets clipped/hidden, so the user only sees a sliver of white.
- The "OR" divider and form section are too tall relative to the viewport, pushing Apple under the bottom tab bar.

## Fix (src/pages/Auth.tsx only)

1. **Apple button** — use explicit Apple HIG styling for both light and dark mode so it always renders as a strong, fully-visible pill:
   - `bg-white text-black` in dark mode, `bg-black text-white` in light mode (via a single class set using `dark:` variants).
   - Add a subtle ring (`ring-1 ring-border/40`) so it has a defined edge on both themes.

2. **Google button** — increase contrast against the page background:
   - Switch from `bg-secondary` to `bg-card` with a stronger `border-border` (full opacity, not `/40`).
   - Slight elevation via `shadow-sm` so it lifts off the background.

3. **Layout / clipping** — make sure both buttons are fully visible above the bottom nav:
   - Increase the form container's bottom padding from `8rem` to `calc(env(safe-area-inset-bottom) + 10rem)` so the Apple button clears the 5-tab BottomNav on small iPhones.
   - Tighten the "Why create an account?" paragraph margin (`mb-6` → `mb-4`) to recover vertical space.

4. **Order** — keep Google first, Apple second (current order), since this matches what the screenshot shows and what users already learned.

No business-logic / OAuth handler changes. No copy changes. No changes to other screens.

## Out of scope

- Hiding the BottomNav on the Auth route (separate UX question).
- Email/password field styling.
- Biometric button.
- Any backend / Supabase / RevenueCat work.

## Acceptance

- On iOS dark mode, both Google and Apple buttons are fully visible above the bottom tab bar with clear contrast.
- Apple button is unmistakably a white pill with black wordmark + glyph.
- Google button has a visible border/elevation against the page.
- Light mode still looks correct (Apple = black pill, Google = light pill with border).
