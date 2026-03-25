

# Updated Monetization Plan: Visible-But-Locked Feature Gating

## What Changed

Instead of hiding gated features entirely, **all features are visible to every user**. Features the user's tier cannot access appear greyed out with a lock icon and an upgrade nudge — creating constant motivation to upgrade.

## UX Pattern: "Teaser Gate"

```text
┌──────────────────────────────┐
│  AI Meal Planner     🔒     │  ← greyed out card
│  ░░░░░░░░░░░░░░░░░░░░░░░░  │  ← muted overlay
│  "Unlock with Elite"        │  ← upgrade badge
│  [See Plans →]              │  ← links to /pricing
└──────────────────────────────┘
```

- Locked features show a semi-transparent overlay (opacity-40) with a lock badge
- Tapping a locked feature opens an upgrade drawer (not a full redirect) showing what tier unlocks it and a "View Plans" button
- On the Index page feature grid, locked cards get a subtle grey treatment + "PRO" or "ELITE" badge
- Inside feature pages (e.g. `/recipe-coach`), the page loads with a blurred/greyed content area and a centered upgrade CTA

## Implementation Steps

### Step 1 — Stripe Setup + Subscriptions Table
- Connect Stripe via connector
- Create Stripe products: Pro monthly/yearly, Elite monthly/yearly, Coaching one-time ($99.99)
- Create `subscriptions` table with user_id, tier, stripe IDs, status, period_end
- RLS: users read own row, service role writes

### Step 2 — Edge Functions
- `stripe-checkout` — creates subscription checkout session
- `stripe-webhook` — handles events, upserts subscriptions table
- `stripe-portal` — customer portal for plan management
- `stripe-coaching-checkout` — one-time $99.99 coaching payment

### Step 3 — SubscriptionContext + TeaserGate Component
- `SubscriptionContext` fetches user's tier, exposes `tier`, `hasAccess(requiredTier)`
- `TeaserGate` component (replaces PaywallGate concept):
  - Props: `requiredTier`, `featureName`, `children`
  - If user has access → renders children normally
  - If user lacks access → renders children with `opacity-40 pointer-events-none` overlay + lock badge + "Unlock with [Tier]" label + "See Plans" button
  - Used both as a wrapper (for page sections) and inline (for buttons/cards)

### Step 4 — Feature Grid (Index Page)
- Each feature card in the grid gets a `requiredTier` property
- Cards for gated features render normally but with:
  - Grey overlay (`bg-muted/60`)
  - Small tier badge (e.g. "PRO" in primary color, "ELITE" in gold)
  - Lock icon replacing the chevron
- Tapping opens an upgrade drawer instead of navigating

### Step 5 — In-Page Gating
Apply `TeaserGate` inside these pages:
- `/recipe-coach` — AI chat area (Pro)
- `/meal-plan` — AI auto-generate button (Elite)
- `/progress` — advanced charts section + export button (Pro)
- `/community` — post/comment actions (Pro), feed remains readable
- `/coaching` — booking widget: Free/Pro see $99.99 checkout button, Elite see direct Calendly embed

### Step 6 — Pricing Page
- `/pricing` with three tier cards
- Current plan highlighted, upgrade/downgrade buttons
- Coaching add-on shown below tiers: "$99.99/session — available to all plans"
- Elite card notes "1 coaching call/month included"

### Step 7 — Profile Integration
- Show current plan badge on Profile page
- "Manage Subscription" link → Stripe portal
- "Upgrade" button if on Free/Pro

### Step 8 — Coaching Page
- Accessible to all authenticated users
- Elite: direct Calendly embed
- Free/Pro: "Book a Call — $99.99" → Stripe coaching checkout → Calendly on success

## Feature Tier Map

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| Progress tracking, Timer, Recipes, Feed, Basic logging | ✅ | ✅ | ✅ |
| Meal planning (unlimited) | 👁️ grey | ✅ | ✅ |
| Advanced charts + history | 👁️ grey | ✅ | ✅ |
| Community post/comment | 👁️ grey | ✅ | ✅ |
| AI Coach chat | 👁️ grey | ✅ | ✅ |
| Ad-free, Data export | 👁️ grey | ✅ | ✅ |
| AI Meal Planner | 👁️ grey | 👁️ grey | ✅ |
| 1 coaching call/month | — | — | ✅ |
| Coaching call (paid) | $99.99 | $99.99 | $99.99 (extra) |

## Files

**New:**
- `src/contexts/SubscriptionContext.tsx`
- `src/components/TeaserGate.tsx`
- `src/pages/Pricing.tsx`
- `src/pages/Coaching.tsx`
- `supabase/functions/stripe-checkout/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/stripe-portal/index.ts`
- `supabase/functions/stripe-coaching-checkout/index.ts`
- Migration for `subscriptions` table

**Modified:**
- `src/App.tsx` — SubscriptionProvider wrapper, new routes
- `src/pages/Index.tsx` — tier badges + grey overlay on feature cards
- `src/pages/RecipeCoach.tsx` — TeaserGate(pro) on chat
- `src/pages/MealPlan.tsx` — TeaserGate(elite) on AI generate
- `src/pages/Progress.tsx` — TeaserGate(pro) on charts + export
- `src/pages/Community.tsx` — TeaserGate(pro) on post/comment
- `src/pages/Profile.tsx` — subscription status + manage link
- `src/components/BottomNav.tsx` — add Community tab

