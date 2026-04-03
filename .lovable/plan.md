

## Switch Post-Login Redirect from Router State to URL Query Param

### Why
`location.state` is lost in the Android APK auth flow. Using a `returnTo` query param persists through any navigation context.

### Changes

**1. `src/pages/Coaching.tsx`**
- Line 21: Change `navigate("/auth", { state: { from: location } })` → `navigate(\`/auth?returnTo=\${encodeURIComponent(location.pathname + location.search + location.hash)}\`)`
- Line 106: Same change for the sign-in card button

**2. `src/components/CoachingBooking.tsx`**
- Line 79: Change `navigate("/auth", { state: { from: location } })` → `navigate(\`/auth?returnTo=\${encodeURIComponent(location.pathname + location.search + location.hash)}\`)`

**3. `src/pages/Auth.tsx`**
- Import `useSearchParams` from `react-router-dom`
- Add `const [searchParams] = useSearchParams()`
- Read `const returnTo = searchParams.get("returnTo") || "/"`
- Line 56-59: Replace the `location.state.from` reconstruction with just `navigate(returnTo, { replace: true })`
- Remove `useLocation` import (no longer needed)

### Files changed

| File | Change |
|------|--------|
| `src/pages/Coaching.tsx` | Use `returnTo` query param in both auth redirects |
| `src/components/CoachingBooking.tsx` | Use `returnTo` query param in `handlePayment` redirect |
| `src/pages/Auth.tsx` | Read `returnTo` from `useSearchParams`; remove `location.state.from` logic |

