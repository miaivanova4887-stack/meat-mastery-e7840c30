Evidence gathered so far

- Push/Profile route: the app does reach `/profile?tab=settings&section=coaching`, and `Profile` parses `tab=settings` and `section=coaching`.
- The route is then redirected to `/auth` when auth bootstrap finishes with no user in the preview session: `[PushRoute] no user after auth load — redirect /auth`.
- `Profile` also attempts to scroll before the coaching section exists: `[PushRoute] coaching-section element { found: false }`. So there are two real failure modes: auth/bootstrap can steal the route, and Profile can ignore the query intent because the section has not rendered yet.
- Coaching data exists for the reported user. Latest row `daeb1931-286e-4271-82f4-af5f3340d33a` is `status='pending'`, `source='appstore'`, `scheduled_at=null`, tied to user `7c33371c-d1e4-4344-9f00-0707c06b0686`.
- Bottom nav is currently portaled, but the native drift report means CSS-only `fixed` is still not stable enough in the iOS scroll context.

Implementation plan

1. Push deep-link stabilization
   - Add a small durable `pushRouteIntent` helper that stores `{ path, createdAt, consumedAt?, verifiedAt? }` in localStorage/sessionStorage.
   - In `pushFcm.ts`, write the intent before dispatching `push-nav`, and include a `sessionId` when present.
   - In `usePushNavigation.ts`, navigate with `replace: true`, log each stage, and verify after 250ms/1s/3s whether the route stayed on target.
   - In `Profile.tsx`, do not immediately redirect `/profile?...section=coaching` to `/auth` while there is an active push intent; preserve the full `returnTo` and log whether auth or Profile consumed the route.
   - Replace the one-shot coaching scroll with a retry loop that waits until the settings tab content and `#coaching-section` actually exist, then scrolls and logs success/failure.

2. Enable-notifications CTA wiring
   - Make the visible Profile notifications CTA always log a single trace ID from tap → OS permission check → `openAppSettings()` call → plugin result.
   - If native permission is `denied`, `prompt`, or `prompt-with-rationale`, open iOS notification/app settings directly instead of opening the in-app consent sheet first.
   - Add fallback logging inside `openAppSettings.ts` for `IOSSettings.AppNotification`, `IOSSettings.App`, and `CapacitorApp.openSettings` so the native console proves which branch ran.

3. Paid-unscheduled coaching flow
   - Keep the Profile query loading `pending` rows and add explicit logs for row totals/counts and whether pending rows rendered.
   - Make the pending card visibly render under `Action needed — Schedule your session` even when there are scheduled sessions above/below it.
   - On Schedule tap, open `CoachingBooking` with `mode='already_paid'`, `sessionId`, and `sessionSource` and log those values.
   - In already-paid mode, ensure payment code is unreachable, auto-build the no-payment URL for `source='appstore'`, and log the base URL host/path plus metadata presence without logging private email details.
   - Ensure `source='appstore'` uses `https://cal.com/carnivorex/coaching-session-ios`, never the paid Cal.com event.

4. Bottom tab bar P0 regression
   - Replace the current pure fixed nav with a native-safe viewport-anchored implementation:
     - keep the portal to `document.body`
     - attach a `visualViewport` listener on native/mobile
     - set explicit `top/left/width` from `visualViewport.offsetTop`, `visualViewport.height`, and safe-area inset so the bar follows the real visible viewport during scroll/keyboard/address-bar changes
     - add a fixed bottom spacer CSS variable so content does not hide behind the bar
   - Remove any nav dependency on parent layout/scroll and add a one-time diagnostic log with measured viewport/nav positions.

5. Verification pass before reporting done
   - Browser/mobile-size screenshot after scrolling a long page showing the tab bar pinned at the bottom.
   - Browser console evidence for Profile route consumption and retry-scroll success.
   - Database evidence for the latest pending `appstore` row and current user linkage.
   - Browser/native-console log hooks for notification CTA tap → native-settings helper invocation.
   - Console evidence that Schedule opens already-paid mode and builds the iOS no-payment Cal.com URL.

Files expected to change

- `src/lib/pushFcm.ts`
- `src/hooks/usePushNavigation.ts`
- `src/pages/Profile.tsx`
- `src/lib/openAppSettings.ts`
- `src/components/CoachingSessionsList.tsx`
- `src/components/CoachingBooking.tsx`
- `src/components/BottomNav.tsx`
- `src/index.css`