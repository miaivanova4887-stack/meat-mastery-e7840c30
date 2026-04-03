

## Post-Login Redirect Back to Coaching

### Changes

**1. `src/pages/Coaching.tsx`**
- Import `useLocation`
- Pass current location as state when redirecting to `/auth` — both in `handleBookPaid` (line 20) and the sign-in card button (line 105)

**2. `src/components/CoachingBooking.tsx`**
- Import `useLocation`
- Pass current location as state when redirecting to `/auth` in `handlePayment` (line 78)
- Add `location` to `useCallback` deps (line 93)

**3. `src/pages/Auth.tsx`**
- Import `useLocation`
- On successful login (line 54-55), reconstruct the full return URL from `location.state?.from` preserving pathname + search + hash:
  ```typescript
  const from = location.state?.from
    ? `${location.state.from.pathname || ""}${location.state.from.search || ""}${location.state.from.hash || ""}`
    : "/";
  navigate(from, { replace: true });
  ```

All existing UI and logic remains unchanged.

### Files changed

| File | Change |
|------|--------|
| `src/pages/Coaching.tsx` | Add `useLocation`; pass `{ state: { from: location } }` in both redirect points |
| `src/components/CoachingBooking.tsx` | Add `useLocation`; pass `{ state: { from: location } }` in `handlePayment`; update deps |
| `src/pages/Auth.tsx` | Add `useLocation`; redirect to full preserved location after login |

