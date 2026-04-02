## Fix Coaching-Call Payment Flow: Require Login

### Current State

- **Coaching.tsx** already has a basic `if (!user)` guard that shows a generic toast and redirects to `/auth` — but it's minimal and the page still calls `create-checkout` (wrong function) instead of `create-coaching-checkout`.
- **create-coaching-checkout edge function** does check auth via the Authorization header, but returns a generic 500 on failure instead of a proper 401.

### Changes

**1. Frontend — `src/pages/Coaching.tsx**`

- Update `handleBookPaid` to call `create-coaching-checkout` (not `create-checkout`)
- Replace the generic toast with a styled inline card when user is not logged in, showing:
  - "Please sign in or create your account before booking a coaching call."
  - "Booking and payment for coaching calls require an account so we can link your session and payment."
  - A "Sign In / Create Account" button routing to `/auth`
- Show this card in place of the "Book & Pay" button when `!user`

**2. Edge Function — `supabase/functions/create-coaching-checkout/index.ts**`

- Add an explicit 401 response when the Authorization header is missing or the token resolves to no user, instead of falling through to a 500:
  ```
  if (!authHeader) → return 401 "Authorization header required"
  if (!user) → return 401 "Authentication required"
  ```

### Files changed


| File                                                   | What changes                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/Coaching.tsx`                               | Fix function name to `create-coaching-checkout`; show sign-in card with required UX copy for logged-out users instead of bare toast |
| `supabase/functions/create-coaching-checkout/index.ts` | Return 401 JSON for missing/invalid auth instead of 500                                                                             |
