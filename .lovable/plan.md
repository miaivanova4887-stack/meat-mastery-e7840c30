# Push-Tap Deep Linking to Coaching

Make tapping a coaching reminder notification open the app at **Profile → Settings tab → Your Coaching**, scrolled to and highlighting the specific upcoming session when a `sessionId` is included in the payload. Falls back to the Your Coaching section if no session id is present or the session can't be matched.

## Routing target

- Route: `/profile?tab=settings&section=coaching[&sessionId=<uuid>]`
- Profile already has a `tab` state ("feed" | "goals" | "community" | "settings"); coaching lives in `settings`. We add query-param initialization and a `section`/`sessionId` scroll target.
- Safe fallback: `/profile?tab=settings&section=coaching` (no sessionId).

## Push payload contract (added to FCM `data` and web push body)

Every coaching reminder push will include:

```
type:        "coaching_reminder" | "coaching_reminder_test"
target:      "coaching_upcoming_session"
session_id:  "<uuid>"   // omitted for test pushes
path:        "/profile?tab=settings&section=coaching[&sessionId=<uuid>]"
url:         <same as path; replaces old booking_url usage for tap routing>
```

`path` is the single source of truth the client uses to navigate; `target`/`session_id` are kept for analytics and future deep links.

## Files to change

### Backend (payload)

1. `supabase/functions/coaching-reminder-dispatch/index.ts`
  - Replace the FCM `data` block:
    - `type: "coaching_reminder"`
    - `target: "coaching_upcoming_session"`
    - `session_id: s.id`
    - `path: "/profile?tab=settings&section=coaching&sessionId=" + s.id`
    - `url: <same as path>` (keeps backward-compat with existing web push click handler)
  - Replace the web push payload (`webPush.sendNotification(...)`) to send `{ title, body, url: <path>, data: { type, target, session_id, path } }`.
2. `supabase/functions/coaching-reminder-test/index.ts`
  - Update FCM `data` to `{ type: "coaching_reminder_test", target: "coaching_upcoming_session", path: "/profile?tab=settings&section=coaching", url: "/profile?tab=settings&section=coaching" }` (no session_id).
  - Update web push payload to the same path.

No edge function signature changes; just deploy `coaching-reminder-dispatch` and `coaching-reminder-test`.

### Native push tap handler (iOS + Android)

3. `src/lib/pushFcm.ts`
  - In `bindListenersOnce`, also register:
    - `PushNotifications.addListener("pushNotificationActionPerformed", handler)` — fires on tap when app is backgrounded or cold-started.
    - `PushNotifications.addListener("pushNotificationReceived", handler)` — used only to log foreground receives; we do NOT auto-navigate on foreground because iOS now shows the banner (alert presentation) and we let the user choose to tap.
  - The handler extracts `notification.data` (Capacitor merges FCM `data` keys into a flat object on both platforms) and resolves a navigation path with this precedence:
  1. `data.path` if it starts with `/`
  2. else if `data.target === "coaching_upcoming_session"` → build `/profile?tab=settings&section=coaching` + optional `&sessionId=<data.session_id>`
  3. else `data.url` if it starts with `/`
  4. else no-op
    vigation is performed by dispatching a `window` `CustomEvent("push-nav", { detail: { path } })`. This decouples push code from React Router and is safe to call at cold start (handler queues until React mounts).

### React Router push-nav consumer

4. New hook `src/hooks/usePushNavigation.ts`
  - Listens for `push-nav` events and calls `navigate(path, { replace: false })`.
  - Also reads a one-shot cold-start path stored in `sessionStorage["push-nav-pending"]` on mount and navigates if present.
5. `src/lib/pushFcm.ts` handler additionally writes `sessionStorage["push-nav-pending"] = path` before dispatching the event — covers the case where the listener hasn't bound yet (cold start, before React mounts).
6. `src/App.tsx`
  - Add `<PushNavHandler />` (calls `usePushNavigation`) inside `<BrowserRouter>` next to existing `<DeepLinkHandler />`.

### Profile page wiring

7. `src/pages/Profile.tsx`
  - On mount, read `useSearchParams()`; if `tab` is one of the four valid values, initialize state to that tab.
  - If `section === "coaching"`, after render scroll a new `coaching-section` anchor into view (smooth).
  - Pass `highlightSessionId` (from `searchParams.get("sessionId")`) to `<CoachingSessionsList />`.
8. `src/components/CoachingSessionsList.tsx`
  - Accept optional `highlightSessionId?: string` prop.
  - When set and the session is found, scroll its card into view and apply a temporary ring/glow (e.g., `ring-2 ring-primary` for ~3s using the existing `ios-card` styling).
  - If `sessionId` doesn't match any session in the list (stale id, already past, etc.), do nothing — section is already visible (graceful fallback).

### Web push parity

9. `public/sw.js`
  - `notificationclick` already uses `data.url`; since we now send `url = "/profile?tab=settings&section=coaching[&sessionId=...]"`, web push taps will route correctly without further changes.

## Verification

- Edge functions deploy: `coaching-reminder-dispatch`, `coaching-reminder-test` (auto on save).
- iOS Send Test Reminder → tap banner from lockscreen, from background, from foreground notification center → app opens on Profile · Settings · Your Coaching with section in view.
- Android (web/PWA path until google-services.json lands): web push tap opens correct URL.
- A real scheduled reminder dispatch will include `session_id`; tapping highlights that session card.
- Fallback: send a notification with no `session_id` → still lands on the Your Coaching section without errors.

Approved with one implementation adjustment.

I agree with:

push payload contract using path as the main navigation field,

tap handling via pushNotificationActionPerformed,

route /profile?tab=settings&section=coaching[&sessionId=<uuid>],

Profile query-param initialization,

scrolling/highlighting the matching upcoming session,

fallback to the coaching section when session lookup fails.

One required change:

do not rely on sessionStorage as the primary cold-start handoff in the Capacitor native app.

Use a module-level pending navigation value in pushFcm.ts as the main mechanism, drained by usePushNavigation on mount.

sessionStorage can remain only as a secondary fallback if you want belt-and-suspenders protection.

Additional requirement:

bind pushNotificationActionPerformed as early as practical, because cold-start delivery depends on the listener attaching in time.

Everything else in this plan looks correct.

## Out of scope

- No Android native FCM changes (still gated by `NATIVE_FCM_ENABLED_ANDROID = false`). When that flag flips on, the same `pushFcm.ts` handler will already work because Capacitor's plugin contract is identical across platforms.
- No changes to `coaching_sessions` schema or `CoachingBooking` modal.
- No analytics events added in this pass (can layer on later by reading `data.type` in the same handler).