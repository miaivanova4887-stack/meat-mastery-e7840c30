## Goal

On iOS, every coaching price shown must come from the StoreKit product metadata (`paywall.packages.coaching.priceString`) for the current Apple ID's storefront — not from a hardcoded `$99.99` literal. Web/Stripe continues to use the Stripe-side amount.

## Audit — coaching price surfaces today


| File                                 | Line     | Current                                                                                                                                    | Issue                                                                     |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/components/CoachingBooking.tsx` | 313      | `content.paid_label                                                                                                                        | &nbsp;                                                                    |
| `src/pages/Coaching.tsx`             | 127–128  | `paywall.packages.coaching?.priceString ?? "$99.99"`                                                                                       | Correct precedence but on a slow RC load it briefly shows the US literal. |
| `src/pages/Pricing.tsx`              | 571      | `coachingPkg.priceLabel                                                                                                                    | &nbsp;                                                                    |
| `src/pages/Pricing.tsx`              | 585      | `Book a Call — ${TIERS.coaching.amount}` (`$99.99`) — web Stripe branch only                                                               | OK (web).                                                                 |
| `src/pages/Pricing.tsx`              | 211, 227 | Plan feature bullets `"Coaching calls ($99.99/session)"` (the bullet under Elite "YOUR PLAN" card visible in IMG_0498 comes via this list) | Hardcoded US price shown on iOS. Should reflect StoreKit price on native. |


## Changes

### 1. `src/components/CoachingBooking.tsx` (line 309–315)

Make StoreKit the source of truth on iOS, and ignore the CMS `paid_label` when running native:

```tsx
const nativePrice = useNative ? paywall.packages.coaching?.priceString : null;
const priceCopy = nativePrice
  ? `${nativePrice} per session`
  : (content.paid_label || "$99.99 per session");
```

Render `priceCopy`. (Web/Stripe path keeps CMS/$99.99 fallback.)

### 2. `src/pages/Coaching.tsx` (line 122–129)

Same precedence already exists, but suppress the `$99.99` fallback while RC is still loading on native. Show `—` (or a small skeleton) when `useNative && !paywall.packages.coaching?.priceString`, and only fall back to `$99.99` on web.

### 3. `src/pages/Pricing.tsx` plan feature bullets (lines 192–245)

Compute the coaching bullet text dynamically instead of a hardcoded string. Add near the `plans` definition:

```ts
const nativeCoachingPrice = paywall.packages.coaching?.priceString;
const coachingBullet = paywall.enabled
  ? (nativeCoachingPrice ? `Coaching calls (${nativeCoachingPrice}/session)` : "Coaching calls")
  : `Coaching calls (${TIERS.coaching.amount}/session)`;
```

Use `coachingBullet` in the Free and Pro feature arrays in place of the two `"Coaching calls ($99.99/session)"` literals. Wrap `plans` in `useMemo` keyed on `coachingBullet` so it re-renders when RC resolves.

### 4. `src/pages/Pricing.tsx` line 571 (book button)

Drop the `"$99.99"` fallback in the native branch — only render the button label once `coachingPkg.priceLabel` is set; the existing "Loading coaching…" state at line 553 already covers the pre-resolve state, so this is a one-line safety cleanup: `Book a Call — ${coachingPkg.priceLabel}`.

### 5. Leave alone

- `src/pages/Pricing.tsx` line 25/27 `TIERS.coaching.amount` and line 585 — these power the **web Stripe** branch only and `$99.99` is the correct US Stripe price.
- Stripe checkout / Cal.com URLs.
- `revenuecat.ts`, `useNativePaywall.ts` (already pass `product.priceString` through correctly).

## Verification (evidence to capture)

Build a fresh TestFlight APK. With two Apple IDs / storefronts:

1. **US storefront** sign-in on device:
  - Pricing page Free/Pro bullets read `Coaching calls ($99.99/session)`.
  - `Book a Call` button reads `$99.99`.
  - CoachingBooking modal reads `$99.99 per session`.
  - StoreKit sheet reads `$99.99`.
  - Console: `[RC DEBUG] paywall packages` includes `coaching:$99.99`.
2. **Canada storefront** sign-in (same binary, switch Apple ID in Settings → Media & Purchases):
  - All four surfaces above read `$129.99` (or whatever CA price StoreKit returns).
  - StoreKit sheet reads `$129.99`.
  - Console: `[RC DEBUG] paywall packages` includes `coaching:$129.99`.

Screenshot all four in-app surfaces + the StoreKit sheet per storefront for the build report.

Approved.

This is the right fix direction.

On iOS, every coaching price surface should use the localized RevenueCat / StoreKit product price string for the current App Store storefront, not a hardcoded US literal and not CMS price copy.

I agree with:

making StoreKit/RevenueCat the source of truth in CoachingBooking.tsx

suppressing native $99.99 fallback in Coaching.tsx

replacing hardcoded coaching bullet text in Pricing.tsx

removing native button fallback where the loading state already exists

leaving web/Stripe pricing unchanged

Two small notes:

In Coaching.tsx, prefer a loading skeleton or “Loading price…” instead of a bare dash while RevenueCat is unresolved.

After these file changes, run a full codebase grep for remaining coaching $99.99 literals and CMS fallback labels.

Verification should show:

US storefront: all in-app coaching surfaces and StoreKit sheet show $99.99

Canada storefront: all in-app coaching surfaces and StoreKit sheet show $129.99

## Out of scope

SIWA name parsing, BottomNav spacing, notification permission flow, Stripe price changes.