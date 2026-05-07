## Plan: Wire real Android RevenueCat key

### Change
In `src/lib/revenuecat.ts` (line 40), replace:
```ts
const REVENUECAT_ANDROID_KEY = "goog_REPLACE_ME_WITH_REAL_ANDROID_KEY";
```
with:
```ts
const REVENUECAT_ANDROID_KEY = "goog_LJgdLQzxkXUPLaORSMbZNpIPLMW";
```

### Why this fixes "Unavailable"
`initRevenueCat()` currently short-circuits on Android because the key string contains `"REPLACE_ME"`. With a real `goog_…` key in place:
- `Purchases.configure({ apiKey })` runs on Android
- `getCurrentOffering()` returns the Play offering
- `useNativePaywall` resolves `pro_monthly` / `pro_yearly` / `elite_monthly` / `elite_yearly` with localized `priceString`s
- `Pricing.tsx` renders real prices instead of the literal "Unavailable" fallback

### Safety
- Only the constant value changes — no behavior, no UI, no Stripe/web path touched.
- Public SDK key only (`goog_…`), never a secret. iOS key untouched.
- `Purchases.configure(...)` already exists at lines 99–102; no new call needed — it just stops being skipped on Android.

### After deploy
User reinstalls the Play internal-track build. Subscriptions screen should show localized Pro/Elite monthly + yearly prices. If it still says "Unavailable", the next step is RC dashboard side (offering not marked Current, packages not attached, or Play products not in "Active" state) — not code.

### Files touched
- `src/lib/revenuecat.ts` (1 line)
