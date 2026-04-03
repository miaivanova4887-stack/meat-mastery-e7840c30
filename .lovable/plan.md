

## Replace Dynamic returnTo with Fixed "/coaching" Route

### Changes

**1. `src/pages/Coaching.tsx`** — 2 locations

**Line 22** (`handleBookPaid`):
```tsx
navigate(`/auth?returnTo=${encodeURIComponent("/coaching")}`);
```

**Line 109** (sign-in button onClick):
```tsx
navigate(`/auth?returnTo=${encodeURIComponent("/coaching")}`);
```

Keep both DEBUG toasts as-is (they still show the raw `location` values for comparison).

**2. `src/components/CoachingBooking.tsx`** — 1 location

**Line 81** (`handlePayment`):
```tsx
navigate(`/auth?returnTo=${encodeURIComponent("/coaching")}`);
```

Keep the DEBUG toast as-is.

### Not changed
- `Auth.tsx`, `App.tsx` — untouched
- All DEBUG toasts — preserved
- All other logic — unchanged

