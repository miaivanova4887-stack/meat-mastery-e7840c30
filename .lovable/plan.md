

## Add Debug Toasts Before Auth Redirects

### Changes

**1. `src/pages/Coaching.tsx`** — 2 locations

**Line 21** (inside `handleBookPaid`), add debug toast before the navigate:
```tsx
// line 20-22 becomes:
    if (!session) {
      toast.success(`DEBUG pre-auth path=${location.pathname} search=${location.search} hash=${location.hash}`, { duration: Infinity, closeButton: true });
      navigate(`/auth?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
      return;
    }
```

**Line 106** (sign-in button), wrap the onClick to add debug toast before navigate:
```tsx
<Button className="w-full gap-2 mt-2" onClick={() => {
  toast.success(`DEBUG pre-auth path=${location.pathname} search=${location.search} hash=${location.hash}`, { duration: Infinity, closeButton: true });
  navigate(`/auth?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
}}>
```

**2. `src/components/CoachingBooking.tsx`** — 1 location

**Line 79** (inside `handlePayment`), add debug toast before navigate:
```tsx
    if (!session) {
      onOpenChange(false);
      toast.success(`DEBUG pre-auth path=${location.pathname} search=${location.search} hash=${location.hash}`, { duration: Infinity, closeButton: true });
      navigate(`/auth?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
      return;
    }
```

### Not changed
- `Auth.tsx` — untouched
- `App.tsx` — untouched
- All existing navigate calls — unchanged, debug toasts added immediately before each

