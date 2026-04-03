

## Remove All DEBUG Toasts

### 1. `src/pages/Auth.tsx` — lines 56, 59

Remove two DEBUG toast lines:
- Line 56: `toast.success(\`DEBUG signup returnTo=...\`)`
- Line 59: `toast.success(\`DEBUG login returnTo=...\`)`

Result:
```tsx
    } else if (mode === "signup") {
      toast.success(t("auth.checkEmail"));
    } else {
      toast.success(t("auth.welcomeBackToast"));
      navigate(returnTo, { replace: true });
    }
```

### 2. `src/pages/Coaching.tsx` — lines 21, 108

Remove two DEBUG toast lines:
- Line 21 in `handleBookPaid`
- Line 108 in sign-in button onClick

### 3. `src/components/CoachingBooking.tsx` — line 80

Remove one DEBUG toast line in `handlePayment`.

### Not changed
- Fixed `"/coaching"` returnTo redirects — preserved
- Auth.tsx sanitization logic — preserved
- App.tsx — untouched

