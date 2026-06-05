## Goal

Tapping "Add to calendar" on a coaching session should:
1. Open an actual **calendar app** (Google Calendar / Apple Calendar), not a generic share sheet.
2. Pre-fill the event with the **meeting link** (Zoom / Google Meet / Cal.com room) so the user can join straight from their calendar reminder.

## What's wrong today

In `src/components/CoachingSessionsList.tsx`:

- Native path uses `Share.share({ url: 'data:text/calendar,...' })`. Android treats this as a generic share → user sees Files / Drive / Gmail, not Calendar. iOS shows the share sheet too, with inconsistent "Add to Calendar" behavior.
- The `.ics` we build only sets `URL:` (rarely surfaced by calendar UIs) and a generic description. The user doesn't see the meeting link inside the event.

In `supabase/functions/cal-webhook/index.ts` (lines 77–80), `booking_url` is computed with broken `??`/ternary precedence:

```ts
const bookingUrl =
  payload?.metadata?.videoCallUrl ?? payload?.location ?? payload?.bookingUrl ?? payload?.uid
    ? `https://cal.com/booking/${payload?.uid}`
    : undefined;
```

→ It always returns the `https://cal.com/booking/<uid>` fallback (a reschedule page), never the real `videoCallUrl`. So even if we surface the link nicely, it points to the wrong place.

## Plan

### 1. Fix `booking_url` to be the real meeting link (backend)

In `supabase/functions/cal-webhook/index.ts`, rewrite the booking URL resolution so it actually prefers the video call URL:

```ts
const videoCallUrl = payload?.metadata?.videoCallUrl;
const locationUrl = typeof payload?.location === "string" && /^https?:\/\//.test(payload.location)
  ? payload.location
  : undefined;
const bookingUrl =
  videoCallUrl
  ?? locationUrl
  ?? payload?.bookingUrl
  ?? (payload?.uid ? `https://cal.com/booking/${payload.uid}` : undefined);
```

This way `coaching_sessions.booking_url` holds the join link when Cal provides one, and we fall back to the booking management page only if nothing else is available.

### 2. Open a real calendar app from the client

In `src/components/CoachingSessionsList.tsx`, replace `downloadIcs(session)` with `addToCalendar(session)` that picks the best strategy per platform:

- **Android (native):** open a **Google Calendar template URL** via `openExternalUrl`:
  ```
  https://calendar.google.com/calendar/render?action=TEMPLATE
    &text=CarnivoreX%20Coaching%20Call
    &dates=YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
    &details=<encoded description incl. join link>
    &location=<encoded booking_url>
  ```
  Android resolves this directly into the Google Calendar app's "New event" screen, with all fields pre-filled. No share sheet.

- **iOS (native):** Apple Calendar doesn't accept template URLs, but it does respect `.ics` opened via the system browser. Use `openExternalUrl` with a `data:text/calendar;charset=utf-8,<encoded ics>` URL — Safari shows a native "Add to Calendar" prompt that drops it straight into Apple Calendar. Keep `Share.share` only as a last-resort fallback if `openExternalUrl` fails.

- **Web:** keep the existing Blob + `<a download>` flow. Most desktop OSes open `.ics` files in the default calendar app.

Detection uses `Capacitor.getPlatform()` (`'android'` / `'ios'` / `'web'`).

### 3. Put the meeting link inside the event

Update `buildIcs(session)` so the link shows up where calendar apps actually display it:

- `LOCATION:<booking_url>` (Apple/Google Calendar render this as a tappable link).
- `DESCRIPTION:` includes a "Join: <booking_url>" line plus the original blurb, with proper CRLF escaping (`\\n`).
- Keep `URL:` for completeness.
- Bump `SUMMARY:` to "CarnivoreX Coaching Call (1 hr)".

The Google Calendar template URL built in step 2 uses the same `location` and `details` strings, so both paths show the join link identically.

### 4. Light UX polish

- If `booking_url` is missing, still allow "Add to calendar" but omit the location / join line (don't block the action).
- Keep the existing `toast.error("No scheduled time yet for this session.")` guard for sessions with no `scheduled_at`.
- Rename the button label internally only if needed; the visible text stays "Add to calendar".

## Files touched

- `src/components/CoachingSessionsList.tsx` — replace `downloadIcs` with `addToCalendar`, update `buildIcs`, drop the `Share` import (or keep as fallback only).
- `supabase/functions/cal-webhook/index.ts` — fix `bookingUrl` precedence so we persist the real meeting link.

## Out of scope

- Adding a dedicated native calendar plugin (e.g. `@capacitor-community/calendar`). The Google Calendar template URL + `.ics` data URL combo covers both platforms without a new Gradle dependency or Android rebuild.
- Backfilling `booking_url` for sessions already stored with the wrong fallback. New bookings will be correct; old ones still show a working (if less ideal) Cal.com link.
