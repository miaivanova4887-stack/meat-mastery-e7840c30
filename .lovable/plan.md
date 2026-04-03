

## Fix Coaching Payment Flow — Auth Session Guard + Stripe Timeout

### Changes

**1. `src/pages/Coaching.tsx`** — Add `getSession()` check in `handleBookPaid`

Before setting loading state, call `supabase.auth.getSession()`. If no session, navigate to `/auth` and return early.

```typescript
const handleBookPaid = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    navigate("/auth");
    return;
  }
  setLoading(true);
  // ... rest unchanged
};
```

The existing `!user` UI guard (lines 93-105) already shows the sign-in card — this adds a runtime safety net.

**2. `src/components/CoachingBooking.tsx`** — Add same guard in `handlePayment`

Add `useNavigate` import and call. Before `setLoading(true)`, check session. If missing, close dialog and redirect.

```typescript
const navigate = useNavigate();

const handlePayment = useCallback(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    onOpenChange(false);
    navigate("/auth");
    return;
  }
  setLoading(true);
  // ... rest unchanged
}, [navigate, onOpenChange]);
```

**3. `supabase/functions/create-coaching-checkout/index.ts`** — Add 8s Stripe timeout

Wrap `stripe.checkout.sessions.create(...)` in `Promise.race` with an 8-second timeout. On timeout, return 504. Auth checks and Stripe params stay unchanged.

```typescript
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("Stripe checkout timed out after 8 seconds")), 8000)
);

const session = await Promise.race([
  stripe.checkout.sessions.create({ /* existing params unchanged */ }),
  timeoutPromise,
]);
```

In the catch block, detect timeout and return 504:

```typescript
} catch (error) {
  const msg = (error as Error).message;
  const status = msg.includes("timed out") ? 504 : 500;
  return new Response(JSON.stringify({ error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
```

### Files changed

| File | What changes |
|------|-------------|
| `src/pages/Coaching.tsx` | Add `getSession()` guard before loading in `handleBookPaid` |
| `src/components/CoachingBooking.tsx` | Add `useNavigate` + `getSession()` guard before loading in `handlePayment` |
| `supabase/functions/create-coaching-checkout/index.ts` | Wrap Stripe create in 8s `Promise.race`; return 504 on timeout |

