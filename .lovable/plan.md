## Findings

- **Webhook is writing rows** ✅. `coaching_sessions` has 2 `status='scheduled'` rows for the current user (`7c33371c…`) with `scheduled_at = 2026-06-17 15:00 / 16:00 UTC`, plus several `pending` rows from earlier checkout starts.
- **RLS is correct** ✅. Policy `Users can read own sessions` allows `auth.uid() = user_id`.
- **Profile currently renders only `<CoachingReminderSettings />**` at `src/pages/Profile.tsx:1040`. There is **no query against `coaching_sessions` and no Upcoming/Past UI** — that's why nothing appears.

So the gap is purely frontend: the section was never added.

## Plan

Add a `CoachingSessionsList` component and mount it in Profile directly above `<CoachingReminderSettings />` inside the same coaching area.

### 1. New component `src/components/CoachingSessionsList.tsx`

- Fetch on mount for `auth.uid()`:
  ```ts
  supabase
    .from("coaching_sessions")
    .select("id, status, scheduled_at, booking_url, attendee_email, attendee_name, timezone, session_month, created_at, external_booking_id")
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
  ```
- Partition client-side:
  - **Upcoming**: `status === 'scheduled' && scheduled_at && new Date(scheduled_at) > now`
  - **Past**: `status === 'completed'` OR (`status === 'scheduled' && scheduled_at < now`)
  - **Cancelled**: `status === 'cancelled'` (shown in Past with muted badge)
  - Hide `status === 'pending'` rows with no `scheduled_at` (those are abandoned checkouts).
- Realtime subscription on `coaching_sessions` filtered by `user_id` so a fresh Cal.com booking appears without reload.
- Render two stacked sections with i18n-friendly headings:
  - **Upcoming session** (singular if 1, plural if >1)
  - **Past sessions**
- Each card shows: formatted local date+time (using user's `profile.timezone` if present, else browser tz), session type label ("1-hour coaching call"), status pill, and actions:
  - Upcoming: "Add to calendar" (ICS download generated client-side) + "Reschedule"/"Cancel" links to `booking_url` when present.
  - Past: read-only.
- Empty state when no upcoming AND no past:
  > "No coaching sessions yet. Book a 1-hour call to get started."
  > with a button that opens the existing `CoachingBooking` modal (reuse the same trigger pattern already in Profile / MotivationCTA).
- Loading skeleton (3 muted cards) while query is in flight.
- Styling: reuse `.ios-card`, semantic tokens only (no hard-coded colors), match existing Profile section spacing.

### 2. `src/pages/Profile.tsx`

- Import `CoachingSessionsList`.
- Insert `<CoachingSessionsList />` immediately above `<CoachingReminderSettings />` (~ line 1039) inside the same coaching block, with a section header "Your coaching".
- No other changes.

### 3. Verification

- Sign in as the test user; expect to see two Upcoming cards (2026-06-17 15:00 and 16:00 UTC, rendered in local tz) and an empty Past section.
- Sign in as a brand-new user; expect the empty state + "Book a call" CTA.
- Cancel a booking in Cal.com → webhook flips `status` to `cancelled` → realtime moves it to Past with a "Cancelled" pill.

User: Plan looks good and the diagnosis is correct: backend + RLS are working, Profile simply doesn’t render sessions yet.

Approved with small refinements:

Keep CoachingSessionsList mounted above CoachingReminderSettings.

Show Upcoming only for future status='scheduled' sessions.

Show Past for completed, cancelled, and scheduled sessions already in the past.

Hide pending rows from the UI.

Hide the Past section entirely when empty.

Confirm coaching_sessions is enabled for Supabase Realtime, or fall back to refetch-on-focus / refetch-after-booking if realtime is unreliable.

Keep the empty state CTA wired to the existing booking flow.

For Add to Calendar, generate a valid .ics file with standard event fields.

No backend changes needed.

### Out of scope

- No backend, webhook, or RLS changes (all already verified working).
- No changes to `CoachingReminderSettings` itself.
- No changes to `CoachingBooking` modal logic.