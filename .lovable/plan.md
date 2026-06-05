## Evidence from code/database review

- Push payloads are being created with `data.path`, `data.target = coaching_upcoming_session`, and optional `data.session_id` in the coaching reminder functions.
- The app currently queues push paths only in module memory + `sessionStorage`; on iOS cold start, `sessionStorage` can be too fragile if the native tap arrives before the web app is fully hydrated.
- The push router consumer mounts inside React Router, but there is no persistent route-intent record that survives reload/auth/onboarding races beyond `sessionStorage`.
- iOS push capability evidence exists in code: `aps-environment` is present and `UIBackgroundModes` includes `remote-notification`.
- Database evidence shows paid-but-unscheduled rows exist now: `11` `pending` `appstore` coaching sessions, with recent pending row `daeb1931-286e-4271-82f4-af5f3340d33a` created at `2026-06-05 18:14:26 UTC`.
- Backend evidence shows `record-coaching-purchase` returned `sessionRowId` for recent purchases.
- The screenshot shows the bottom nav rendered in the middle of the scrollable page; I will treat this as a native WebView fixed-position stability bug, not just a styling issue.

## Implementation plan

### 1) Make push tap routing deterministic
- Replace the fragile push pending queue with a durable helper that writes the route intent to both `localStorage` and `sessionStorage` before dispatching `push-nav`.
- Add a short-lived diagnostic object containing:
  - raw action timestamp
  - extracted data keys
  - resolved path
  - queue storage success/failure
  - drain attempts
  - final navigation call
- Update `usePushNavigation` to drain in this order:
  1. module memory
  2. `sessionStorage`
  3. `localStorage`
- Delay navigation with `requestAnimationFrame` plus a short timeout so Router/Auth/Profile have mounted.
- Add route verification after navigation at `250ms`, `1s`, and `3s`, logging if anything overwrites `/profile?tab=settings&section=coaching...`.

### 2) Prevent app startup/auth flows from stealing the push route
- Keep Profile auth redirect deferred until auth loading completes.
- Add a global “push route intent” check so generic startup code does not scroll/reset or redirect over the push route while it is being consumed.
- Update the scroll-to-top hook so it does not immediately scroll away from the coaching anchor when the push route includes `section=coaching`.

### 3) Prove Profile consumes the route
- Add/keep `[PushRoute]` logs in `Profile.tsx` for:
  - mounted path/search
  - auth state when mounted
  - parsed `tab`, `section`, and `sessionId`
  - settings tab activation
  - coaching section element found/not found
  - final scroll attempt
- Ensure `tab=settings&section=coaching` always switches to Settings before scrolling.

### 4) Fix coaching pending-session visibility and scheduling
- Add targeted logs in `CoachingSessionsList` showing:
  - current user id
  - total sessions loaded
  - count by status
  - pending session ids
  - whether the Action Needed section rendered
- Keep pending rows included in the query and rendered in the “Action needed” section.
- Make the pending “Schedule your session” CTA always open `CoachingBooking` in `already_paid` mode.
- Ensure `already_paid` mode:
  - skips payment
  - builds a no-payment Cal.com URL for appstore/iOS rows
  - includes `metadata[user_id]`
  - includes `metadata[session_row_id]`
  - logs the host/path and metadata presence without exposing sensitive values.

### 5) Fix native notification settings fallback
- Keep using the native notification authorization flow (`PushNotifications.requestPermissions()` then `register()`).
- Improve the denied-state CTA so it always opens native settings and logs:
  - current OS permission
  - plugin target used: iOS notification settings first, app settings fallback second
  - success/failure from each settings-opening attempt.
- Keep the existing native capability checks documented, and add runtime logs that identify if no APNs/FCM token arrives after `register()`.

### 6) Fix bottom menu drifting during scroll
- Move `BottomNav` out of the scroll/layout stacking context by rendering it through a React portal directly into `document.body`.
- Harden the nav CSS for native WebView scrolling:
  - explicit `position: fixed`
  - explicit `bottom: 0`
  - full viewport width
  - safe-area padding
  - stable height
  - high z-index
  - no parent-dependent positioning.
- Add a mobile-safe bottom spacer variable so page content still clears the nav without the nav participating in the page scroll.

### 7) Verification I will run after implementation
- Static checks with code search confirming:
  - iOS entitlements include `aps-environment`
  - Info.plist includes `remote-notification`
  - push payload contains `path` / `target` / `session_id`
  - pending coaching rows are not filtered out
  - BottomNav is portaled and fixed outside page flow.
- Database read checks confirming pending/scheduled coaching rows still load shape expected by the UI.
- Edge logs check for `record-coaching-purchase` showing `sessionRowId` issuance.

## What you will still need to test on device
- Cold start from locked phone: tap push and verify logs show `actionPerformed -> resolved path -> queued -> drained -> navigate calling -> Profile mount`.
- Backgrounded app: same route log chain.
- Already-open app/banner tap: same route log chain.
- Denied notification state: tap Enable Notifications and verify native settings opens.
- Paid unscheduled flow: buy, do not schedule, return to Profile and verify Action Needed appears and Schedule opens no-payment booking.