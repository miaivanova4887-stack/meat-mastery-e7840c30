

## Connect Home Page Coaching Block to Cal.com + Stripe Payment Flow

### Overview
Wire the "Need extra motivation?" MotivationCTA on the Home page to open a multi-step coaching booking modal with Stripe payment gate and Cal.com scheduling. The existing Coaching page and MotivationCTA on other pages remain unchanged.

### Database: `coaching_sessions` table (migration)
```sql
CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_type text NOT NULL,
  stripe_payment_intent text,
  booked_at timestamptz DEFAULT now(),
  session_month text NOT NULL
);
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own sessions" ON public.coaching_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sessions" ON public.coaching_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
```
No foreign key to `auth.users` per project guidelines.

### Database: Seed 16 content_blocks rows (insert tool)
Page `coaching`, section `booking`, keys: `title`, `description`, `included_label`, `paid_label`, `book_free_button`, `pay_button`, `payment_confirmed`, `success_title` — each in `en` and `fr` with the exact text from the request.

### Edge Function: `supabase/functions/create-coaching-checkout/index.ts`
- Authenticates user from Authorization header
- Creates Stripe Checkout session with:
  - `price: 'price_1TFm5RBCKK2x5xtVzSHn0acA'`
  - `mode: 'payment'`
  - `success_url` / `cancel_url` using origin + `?coaching_payment=success|cancelled`
  - `metadata: { userId, type: 'coaching_session' }`
- Reuses existing Stripe customer if found
- Returns `{ url }` — same pattern as existing `create-checkout`

### New Component: `src/components/CoachingBooking.tsx`
A dialog/modal with 4 internal screens managed by local state:

**Screen A (Info):** Fetches content from `content_blocks` for current locale. Checks `coaching_sessions` for a row matching current user + current `YYYY-MM` with `session_type = 'included'`. Checks subscription tier via `useSubscription`.
- Elite + no used session → shows "Included" label + "Book Free Session" button
- All others → shows "CA$99" label + "Proceed to Payment" button

**Screen B (Payment):** Calls `create-coaching-checkout` edge function, opens Stripe URL via `window.open`, shows "Opening secure payment..." state.

**Screen C (Cal.com):** Shows "Payment confirmed!" text, opens `https://cal.com/carnivorex/coaching-session` via `window.open`, has "Done" button that inserts a row into `coaching_sessions` (type `paid` or `included`) and advances to Screen D.

**Screen D (Success):** Shows confirmation message + "Back to Home" button that closes the modal.

Props: `open`, `onOpenChange`, `initialScreen` (defaults to 'info').

### Change: `src/pages/Index.tsx`
- Import `CoachingBooking` and add state: `coachingOpen`, `coachingInitialScreen`
- Replace `<MotivationCTA />` on Index only: wrap it so `onClick` opens the `CoachingBooking` modal instead of navigating. Done by passing an `onClick` prop to MotivationCTA or wrapping it in a div that intercepts the click.
- On mount, check URL params `?coaching_payment=success` → open modal at Screen C; `?coaching_payment=cancelled` → toast "Payment cancelled" and clear param.

### Change: `src/components/MotivationCTA.tsx`
Add an optional `onClick` prop. When provided, use it instead of the default `navigate(route.path)`. This keeps all other pages using MotivationCTA unaffected.

### Config: `supabase/config.toml`
Add `[functions.create-coaching-checkout]` with `verify_jwt = false` (matches existing pattern — JWT validated in code).

### Files modified
- `src/components/CoachingBooking.tsx` — new
- `supabase/functions/create-coaching-checkout/index.ts` — new
- `src/components/MotivationCTA.tsx` — add optional `onClick` prop
- `src/pages/Index.tsx` — wire modal + URL param handling
- `supabase/config.toml` — add function config
- Migration: `coaching_sessions` table
- Insert: 16 content_blocks rows

### Technical details

The `coaching_sessions` query to check Elite monthly usage:
```typescript
const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
const { data } = await supabase
  .from("coaching_sessions")
  .select("id")
  .eq("user_id", user.id)
  .eq("session_type", "included")
  .eq("session_month", currentMonth)
  .limit(1);
const usedFreeSession = (data?.length ?? 0) > 0;
```

Edge function uses `price_1TFm5RBCKK2x5xtVzSHn0acA` (the price ID from the request, not the old `COACHING_PRICE_ID` from Coaching.tsx). STRIPE_SECRET_KEY is already in secrets.

