## Current verified findings

1. **Push tap route is likely being overwritten after startup**
  - `pushNotificationActionPerformed` is bound at module load and queues `/profile?tab=settings&section=coaching...`.
  - `usePushNavigation()` drains pending paths and calls `navigate(path)`.
  - `Profile.tsx` currently redirects immediately when `user` is temporarily `null`:
    ```ts
    if (!user) navigate('/auth')
    ```
  - On cold start, auth is still loading when `/profile...` mounts, so this can overwrite the push route to `/auth` before the session hydrates.
2. **Notification settings plugin exists, but CTA wiring is incomplete**
  - `capacitor-native-settings` is installed in `package.json` and included in `ios/App/CapApp-SPM/Package.swift`.
  - `openAppSettings()` currently uses `IOSSettings.App`; the plugin also supports `IOSSettings.AppNotification` for iOS 15.4+.
  - The Profile “Enable notifications” switch only toggles local/server prefs and does not open OS settings.
  - The manual Profile notification CTA can be suppressed by `prefs-opted-in`, so it may never open settings even when OS notifications are denied.
3. **Paid-unscheduled rows do exist, but the scheduling flow is wrong**
  - Database evidence shows recent `coaching_sessions` rows with `status='pending'`, tied to the current user.
  - `CoachingSessionsList` fetches pending rows and renders an Action needed section.
  - The pending Schedule button bypasses `CoachingBooking`; it directly opens an external URL.
  - It checks `session.source === 'paid_ios'`, but the backend stores `source='appstore'`, so iOS pending sessions can choose the paid Cal.com URL instead of the no-payment iOS URL.

## Implementation plan

### 1. Make push tap deep-linking evidence-first and stop route overwrites

- Update `AuthContext` usage in `Profile.tsx` to read `loading`.
- Change the unauthenticated redirect so it only runs after auth bootstrap finishes:
  ```ts
  if (!loading && !user) navigate('/auth')
  ```
- Add explicit `[PushRoute]` logs in `Profile.tsx` for:
  - initial mount path/search
  - auth loading/user state before any redirect
  - query params read: `tab`, `section`, `sessionId`
  - `setTab('settings')` from query params
  - coaching section scroll attempt, success/failure
  - `CoachingSessionsList` highlight session received/found/missing
- Add a small route-watch logger in the push navigation handler after `navigate()` to prove whether another effect overwrote the route shortly after startup.
- Keep all existing `[PushTap]` and `[PushNav]` diagnostics until cold start, background, and foreground tap are confirmed.

### 2. Fix “Enable notifications” denied-state settings fallback

- Add a dedicated helper/log flow around opening settings:
  - `[NotifSettings] CTA tapped`
  - `[NotifSettings] opening iOS app settings`
  - `[NotifSettings] plugin result` with success/failure
- Update `openAppSettings()` to prefer `IOSSettings.AppNotification` on iOS, then fall back to `IOSSettings.App`, then Capacitor App fallback if available.
- Wire every denied-state notification CTA to the helper:
  - `NotificationConsentSheet` denied result
  - Profile manual notification preferences CTA
  - Profile “Enable notifications” switch when turning on while OS permission is denied
- Avoid `auditPushDecision()` suppressing the manual CTA due to saved prefs; manual settings taps should check OS permission directly and open settings when denied.

### 3. Fix paid-unscheduled coaching scheduling flow end-to-end

- Add logs in `recordCoachingPurchase()` client wrapper for:
  - function invoke start
  - returned `ok`, `calComUrl`/`iosBookingUrl` presence
  - returned session row ID if added by backend
- Update `record-coaching-purchase` function to return `sessionRowId` so client logs can prove which pending row was created/reused.
- Add `sessionRowId` to `RecordCoachingPurchaseResult`.
- Extend `CoachingBooking` with an already-paid mode, for example:
  ```ts
  mode="already_paid"
  sessionId="..."
  sessionSource="appstore"
  ```
- In already-paid mode:
  - skip StoreKit/Stripe payment entirely
  - build the scheduler URL with `metadata[user_id]` and `metadata[session_row_id]`
  - use `CAL_IOS_NO_PAYMENT_URL` when `source='appstore'` or native iOS is active
  - log `[CoachingPending] already_paid open scheduler` with session ID/source and URL type, not full private URL
- Change `CoachingSessionsList` pending Schedule button to open `CoachingBooking` in already-paid mode instead of directly calling `openExternalUrl()`.
- Add logs in `CoachingSessionsList` for:
  - fetch user ID
  - row counts by status
  - pending rows found
  - pending section render
  - Schedule tap session ID/source

### 4. Evidence and validation after implementation

- Run a read-only DB query for recent coaching sessions to show pending/scheduled counts by user.
- Review or fetch edge logs for `record-coaching-purchase` after a test purchase to confirm insert/reuse and returned `sessionRowId`.
- Provide exact expected Xcode console log sequences for:
  1. cold start from locked phone
  2. backgrounded app
  3. already-open app with banner tap
  4. denied notification CTA tap
  5. pending coaching Schedule tap

## Files to update

- `src/pages/Profile.tsx`
- `src/hooks/usePushNavigation.ts`
- `src/lib/openAppSettings.ts`
- `src/components/NotificationConsentSheet.tsx`
- `src/components/CoachingSessionsList.tsx`
- `src/components/CoachingBooking.tsx`
- `src/lib/coachingPurchase.ts`
- `supabase/functions/record-coaching-purchase/index.ts`

No schema migration is needed for these fixes.

Approved.

This plan correctly identifies three likely root causes:

push route overwritten by premature /auth redirect during auth hydration

notification settings plugin exists but denied-state CTA wiring is incomplete

paid-unscheduled data exists, but scheduling uses the wrong flow/source mapping

I agree with:

adding loading-aware auth gating for Profile

keeping all [PushTap], [PushNav], and new [PushRoute] diagnostics

preferring IOSSettings.AppNotification with fallback to [IOSSettings.App](http://IOSSettings.App)

wiring every denied-state notification CTA to the settings helper

extending CoachingBooking with an already-paid mode

changing pending Schedule to open the already-paid booking flow instead of raw external URL

fixing source handling for iOS pending sessions (appstore)

Two implementation notes:

in Profile.tsx, prefer a guarded render/loading state over an eager imperative redirect while auth is still hydrating

keep fallback logging for notification settings because AppNotification behavior can vary by iOS version

No schema migration is needed for this pass.