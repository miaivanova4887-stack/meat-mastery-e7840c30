## Current state

`src/pages/Auth.tsx` lines 470–482 render the Apple button as a generic `rounded-2xl` pill with a tiny 18px glyph, 12px text, mismatched padding, and inverted colors in dark mode. None of this matches Apple's Sign in with Apple HIG.

## Apple HIG requirements being violated

- **Color modes**: must be one of (a) white logo on black, (b) black logo on white, or (c) black logo on white with 1pt black outline — **not** auto-inverted per theme. We will pick **black background / white logo + text** to match the premium dark hero used elsewhere in the app.
- **Logo**: official Apple glyph, optically centered, height ≈ 43% of the cap-height block (we'll use 16px glyph for ~20px text).
- **Title**: "Sign in with Apple" (login mode) or "Sign up with Apple" (signup mode) — `Continue with Apple` is allowed but we'll switch to the mode-specific labels since the form already knows the mode. SF system font, semibold (`-apple-system, BlinkMacSystemFont, "SF Pro Text"`).
- **Minimum touch target**: 44pt tall.
- **Corner radius**: HIG allows 0–50% of height; to stay consistent with the rest of the auth form (which uses `rounded-2xl` = 16px) we'll keep 16px — explicitly allowed.
- **Padding**: leading/trailing space ≥ logo height; gap between logo and title = logo height × ~0.5. We'll use `px-4` and `gap-2`.
- **Do not modify the logo**: keep the official path, fill = white, no extra strokes.
- **Parity**: Google button must share the same height (44px), radius, font stack, and weight so the two CTAs sit as a matched pair per HIG "match other buttons" guidance.

## Changes

**File: `src/pages/Auth.tsx`** (only the OAuth button block, lines 456–482)

1. Add a constant for the Apple font stack:
   ```ts
   const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
   ```
2. Rewrite the **Apple button**:
   - `className="w-full h-11 rounded-2xl bg-black text-white font-semibold text-[17px] tracking-[-0.01em] flex items-center justify-center gap-2 px-4 transition-transform active:scale-[0.98] disabled:opacity-50"`
   - Inline `style={{ fontFamily: APPLE_FONT }}`
   - Remove the `dark:bg-white dark:text-black` inversion (HIG forbids picking a non-approved combo and the black variant is HIG-compliant in both themes).
   - Glyph: 16×16, `fill="currentColor"`, vertically nudged `-mt-0.5` so the Apple mark optically centers with the text cap height.
   - Label: `mode === "signup" ? "Sign up with Apple" : "Sign in with Apple"`.
   - `aria-label` matches the label.
3. Update the **Google button** to match the new height (`h-11`), radius, font stack, and label sizing so the pair is visually balanced (text size unchanged to keep Google brand guideline — only height/font-family aligned). Replace `py-3` with `h-11`, drop `text-sm` in favor of `text-[15px] font-medium` per Google brand, keep multi-color glyph at 18px.
4. No copy in i18n files because Apple HIG-compliant labels are not localized through translation keys today; "Sign in with Apple" is the exact HIG-approved English string. (If/when we ship more locales, we'll switch to Apple's official localized strings — out of scope here.)

No other files touched. No backend, routing, or auth-logic changes — the existing `handleAppleSignIn` handler is unchanged.

## Verification

- Visually confirm at `/auth` on iPhone 17 Pro preview that the Apple button is black with white SF text and the official glyph, 44px tall, matching the Google button width/height.
- Confirm switching from Login → Sign up swaps the label to "Sign up with Apple".
- Confirm dark mode no longer inverts the button (still black bg / white fg).

## Out of scope

- No change to the native sign-in handler or Supabase config.
- No change to Google branding beyond height/font-family parity.
- No new i18n strings.
