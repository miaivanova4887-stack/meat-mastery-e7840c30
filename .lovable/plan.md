## Goal

Fix the broken "Open Cal.com Scheduler" CTA after a successful iOS coaching IAP. Currently every coaching-scheduler launch uses `window.open(...)`, which is unreliable inside the Capacitor WKWebView and silently no-ops on iOS.

## Root cause

`window.open` calls in the coaching path:

- `src/components/CoachingBooking.tsx:114, 124, 209` (post-purchase success modal CTA + redirect after Stripe/recordCoachingPurchase)
- `src/pages/Coaching.tsx:51, 62`
- `src/pages/Pricing.tsx:149` (post-IAP redirect to Cal.com)

On native iOS these get blocked → no browser opens, no error.

The project already uses `@capacitor/browser` elsewhere (`src/pages/Auth.tsx`, `src/hooks/useDeepLinks.ts`), so the plugin is installed and proven.

## Plan

### 1. New shared helper `src/lib/openExternalUrl.ts`

A single utility every coaching/scheduler launch goes through:

- Accepts `(url, { logTag })`.
- Logs `coaching:open-scheduler-url-ready` with the URL.
- If `Capacitor.isNativePlatform()`: `await Browser.open({ url, windowName: "_blank" })`, log `coaching:open-scheduler-native-open-ok` on success, `coaching:open-scheduler-native-open-failed` with the error on failure.
- On native failure or on web: fall back to `window.open(url, "_blank", "noopener,noreferrer")`.
- Returns `{ ok: boolean, error?: unknown }` so callers can decide whether to show the fallback toast.

### 2. `src/components/CoachingBooking.tsx`

- Replace the three `window.open` calls (lines 114, 124, 209) with `openExternalUrl(...)`.
- On the success-modal CTA tap:
  - Log `coaching:open-scheduler-tap`.
  - Guard against missing URL → disable the button and surface "Booking link unavailable — please contact support" instead of a silent no-op.
  - If `openExternalUrl` returns `ok: false`, show a fallback toast: "Payment received — we couldn't open the scheduler automatically." and reveal a copy-to-clipboard row with the booking URL plus a secondary "Copy booking link" button (uses `navigator.clipboard.writeText` with a `document.execCommand('copy')` textarea fallback).
- Track `schedulerUrl` in component state so the fallback UI can render it.

### 3. `src/pages/Coaching.tsx` (lines 51, 62)

Replace `window.open` with `openExternalUrl` for both the post-IAP Cal.com redirect and the Stripe checkout URL. Same tap/ok/failed log tags. Same fallback toast + copy-link affordance when the post-purchase Cal.com open fails.

### 4. `src/pages/Pricing.tsx` (line 149)

Same swap for the post-IAP Cal.com redirect (the other `window.open` calls at 61/77/455 are Stripe checkout / App Store management and out of scope for this bug; leave them).

### 5. Acceptance verification

- `rg "window.open" src/components/CoachingBooking.tsx src/pages/Coaching.tsx` returns no coaching/scheduler hits.
- Manual test on physical iPhone after a Sandbox coaching purchase: tap "Open Cal.com Scheduler" → Cal.com opens in the in-app Safari view every time.
- If Browser.open is forced to fail (e.g. malformed URL), fallback toast + copy button appear and the URL is copyable.
- Console shows the four diag tags in order: `coaching:open-scheduler-tap` → `coaching:open-scheduler-url-ready` → `coaching:open-scheduler-native-open-ok` (or `-failed`).

User: Approve the plan, but on native iOS please do not fall back from `Browser.open()` to `window.open()` if native open fails. Use `Browser.open()` as the only native launch path, and if it fails, immediately show the fallback toast + visible copyable booking URL + “Copy booking link” CTA. That avoids repeating the same WKWebView failure mode we’re trying to eliminate.

## Out of scope

- Stripe checkout / App Store management URLs (work as expected).
- Backend `record-coaching-purchase` function.
- Cal.com URL configuration / CMS overrides.
- Any RevenueCat / StoreKit changes — the purchase itself already succeeds.

## Files touched

- `src/lib/openExternalUrl.ts` (new)
- `src/components/CoachingBooking.tsx`
- `src/pages/Coaching.tsx`
- `src/pages/Pricing.tsx`