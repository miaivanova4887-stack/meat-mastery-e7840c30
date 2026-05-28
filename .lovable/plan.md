## Goal

Remove the "1 coaching call/month included" Elite benefit from all Elite-tier copy, UI and logic. Keep the standalone $99.99 coaching purchase (Stripe `create-coaching-checkout` + Cal.com flow) fully intact for everyone. Fix the preview crash some Elite users see at login with the smallest safe change.

Also update the **Pro** plan copy and features:

- Remove **“Ad-free experience”** from the Pro plan feature list.
- Remove **“Data Export CSV”** from the Pro plan feature list.
- Do not remove these from any other plan unless they are inherited exclusively from the Pro plan config and should disappear there as well.
- Keep all Pro pricing, entitlements, gating, and checkout logic unchanged unless one of these two items is tied directly to access control and would otherwise cause broken UI copy.

## Diagnosis of the Elite-login crash

After tracing every Elite-specific branch the most likely root cause is in `src/components/CoachingBooking.tsx`, which renders on `/` (Home) via `<MotivationCTA />` and on several CMS pages:

- `useEffect` (line 43) runs as soon as the modal opens AND whenever `user`/`i18n.language` change.
- It issues `supabase.from("coaching_sessions").select(...).eq("user_id", user.id)...` to decide if an Elite user has used their free monthly call.
- For Elite-tier users, `isFreeEligible` is computed from `usedFreeSession` and gates the "Book Free Session" button.
- There is no try/catch around the Supabase calls, no defensive default for `content`, and `tier` from `useSubscription()` is read while `loading` can still be `true` (race during first paint after login).
- Any of the following crash the modal (and, because it's mounted unconditionally inside `MotivationCTA` on Home, bubble up to the route):
  - `supabase.functions.invoke` / `from(...)` throwing if the session is mid-refresh post-login.
  - `content_blocks` row missing for the `coaching` page → `b.value` access path is fine but downstream consumers assume strings.
  - Elite users reaching `handleDone` while `user` is briefly null during the refresh.

There is also a latent hooks-order bug in `src/pages/Index.tsx`: `useState(dismissedTips)` (line 130) is declared **after** an early `return <Navigate />` on line 100. We will NOT touch this in this task (out of scope and not Elite-specific) — only mention it as a follow-up.

## Changes

### 1. Remove the "1 coaching call/month included" Elite benefit

`**src/pages/Pricing.tsx**`

- In the `elite` plan `features` array, remove the string `"1 coaching call/month included"`.
- In the standalone coaching card text, drop the sentence `Elite members: 1 call/month included — additional sessions at $99.99.` Keep the rest of the description and the "Book a Call — $99.99" button untouched.
- Leave `TIERS.coaching`, `handleStripeCheckout`, and the whole standalone coaching card intact.

`**src/pages/Coaching.tsx**`

- Replace the `isElite ? ... : ...` branch with a single unified card that always shows the $99.99 paid flow (the current `else` branch). Elite users now book the same way as Pro/Free.
- Remove the "Elite members get 1 call/month included" footnote under the paid card.
- Keep `useSubscription` import only if still used elsewhere in the file; otherwise drop it. Keep `Crown` icon at the top of the page (it's a generic decoration).

`**src/components/CoachingBooking.tsx**`

- Remove `isElite` / `isFreeEligible` logic. The modal becomes a single paid flow: Info → Payment → Cal.com → Success.
- Remove the `coaching_sessions` "used this month" query.
- Update `handleDone` to insert `session_type: "paid"` unconditionally (preserves coaching_session analytics).
- The "Included in your Elite plan this month" copy and the "Book Free Session" button are deleted.

`**src/contexts/SubscriptionContext.test.ts**`

- Remove the test row `{ location: "Coaching.tsx", name: "1 coaching call/month included", required: "elite" }`. Leave the AI Meal Planner Elite test in place.

`**src/i18n/en.json` & `src/i18n/fr.json**`

- No change to `motivationDesc` (it says "book a coaching call", which is still true — coaching exists, just paid). No other locale strings reference the removed benefit.

### 2. Defensive guards to prevent preview crash

`**src/components/CoachingBooking.tsx**`

- Wrap the Supabase fetch in `try/catch` and log to console instead of letting it throw. Set safe defaults for `content` (`{}`) on failure.
- Skip the effect entirely until `user?.id` is a truthy string (we already gate on `!user`, but add explicit `user.id` check).
- Guard `handleDone` with `if (!user?.id) { onOpenChange(false); return; }`.
- Wrap the dialog body in a small error boundary fallback: if `tier` is undefined (Subscription still loading) render a small spinner instead of the info screen.

`**src/contexts/SubscriptionContext.tsx**` — no behavioral change needed. `tier` already defaults to `"free"` and `loading` starts `true`; consumers can read it safely.

### 3. Out of scope (explicitly not touched)

- The standalone Stripe coaching purchase (`create-coaching-checkout` edge function, `TIERS.coaching`, Cal.com link).
- Pro/Free tier copy and behavior.
- Auth flow, route guards, paywall navigation.
- The pre-existing hooks-order issue in `Index.tsx` (noted above for a future task).

## Test checklist

1. Elite user signs in → Home renders without crash; opening the Motivation CTA shows the paid coaching modal with no "Included" banner.
2. Elite user on `/coaching` and `/pricing` no longer sees "1 coaching call/month included" anywhere.
3. Any user (Free / Pro / Elite) can click "Book a Call — $99.99" on `/pricing` or "Book & Pay" on `/coaching` and a Stripe Checkout tab opens (or auth redirect if not signed in).
4. Pro tier paywall card, feature list and access checks unchanged.
5. Auth, paywall, and account screens render with no console errors when subscription context is briefly loading.