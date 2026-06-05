## iOS coaching booking — eliminate double charge, prefill identity, align price

### Goal

After a successful iOS StoreKit coaching purchase, the user is sent to a **no-payment** Cal.com event (`coaching-session-ios`) with name + email prefilled. Web Stripe flow stays untouched.

### Backend

`**record-coaching-purchase` (update)**

- After inserting the `coaching_sessions` row, look up the caller's `auth.users.email` and `profiles.display_name`.
- If `source === "appstore"`, build:
  - `iosBookingUrl = https://cal.com/carnivorex/coaching-session-ios?name={encoded}&email={encoded}` (Cal.com supports `name` + `email` query prefill on its booking form).
  - Log `coaching:booking-link-issued` with `{ userId, hasName, hasEmail }`.
  - Log `coaching:booking-link-prefill-missing` if name or email is empty.
- Response payload becomes `{ ok, calComUrl, iosBookingUrl? }`. Web path keeps returning the existing paid `calComUrl` unchanged.

No DB migration required for the simple gate — the existing `coaching_sessions` row + auth check is the gate.

### Client — `src/lib/coachingPurchase.ts`

- Extend `RecordCoachingPurchaseResult` with `iosBookingUrl?: string` and propagate it through.

### Client — `src/components/CoachingBooking.tsx`

- iOS branch after `recordCoachingPurchase`:
  - Log `coaching:booking-link-requested` before invoking.
  - `schedulerUrl = recorded.iosBookingUrl ?? recorded.calComUrl ?? IOS_NO_PAYMENT_FALLBACK` where the fallback constant is the no-payment URL (not the paid one).
  - Open via `openExternalUrl(schedulerUrl, { logTag: "coaching:booking-link" })`; on `ok` log `coaching:booking-link-opened`, else log `coaching:booking-link-open-failed` and show existing fallback UI.
- Web branch: unchanged (still hits `create-coaching-checkout` → Stripe).
- Replace the paid `CAL_URL` fallback used by iOS with the no-payment URL so a backend failure still avoids double charge.
- Replace hardcoded `"CA$99 per session"` info-screen price with the StoreKit-localized string when `useNative && paywall.packages.coaching?.priceString` is available; fall back to CMS `paid_label` only on web.

### Client — `src/pages/Coaching.tsx` and `src/pages/Pricing.tsx`

- Same iOS branch updates: prefer `recorded.iosBookingUrl`, fall back to the no-payment URL, never the paid one. Web Stripe redirect stays as-is.
- Where any hardcoded "$99" / "CA$99" appears on the iOS path, swap for `paywall.packages.coaching?.priceString` (already loaded by `useNativePaywall`).

### Constants

Add a single module `src/lib/coachingUrls.ts`:

```ts
export const CAL_PAID_URL = "https://cal.com/carnivorex/coaching-session";
export const CAL_IOS_NO_PAYMENT_URL = "https://cal.com/carnivorex/coaching-session-ios";
```

All call sites import from here.

### Diag logs (console)

- `coaching:booking-link-requested` — client, before invoke
- `coaching:booking-link-issued` — server
- `coaching:booking-link-prefill-missing` — server, when name/email blank
- `coaching:booking-link-opened` — client, after successful `openExternalUrl`
- `coaching:booking-link-open-failed` — client, on failure (already triggers fallback UI)

### Out of scope

- Web Stripe / paid Cal.com flow — untouched.
- Single-use signed token (rejected in favor of simple gate).
- Cal.com event configuration itself — you'll handle in Cal.com dashboard (disable payment on `coaching-session-ios`).

### Acceptance verification

After build:

1. iOS sandbox purchase → Cal.com opens directly to `coaching-session-ios` time picker — no card form, no price screen.
2. Name + email pre-filled on the Cal.com "Confirm your details" step.
3. App pricing CTA reads the StoreKit storefront price (e.g. `$99.99`, `CA$129.99`), not `CA$99`.
4. Web Stripe coaching purchase still lands on the existing paid Cal.com event.

User feedback: If `profiles.display_name` is missing, Lovable should fall back to:

- SIWA / auth metadata display name,
- then email local-part only as a last resort.