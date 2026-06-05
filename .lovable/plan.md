# Stabilization pass — SIWA name, bottom nav, notification CTA

Three targeted fixes. No business logic changes.

## 1) Sign in with Apple — name not parsed into Cal.com

**Symptom (IMG_0495):** Cal.com "Your name *" is empty; email is `…@privaterelay.appleid.com`. Apple's keyboard suggests "Maria Ivanova", proving the OS has the name but our prefill didn't include it.

**Root cause:** `CoachingBooking.buildCalUrl` reads `user.user_metadata.display_name` only. For Apple users, the name lives in `profiles.display_name` (written by `reconcileAppleDisplayName`) or in the local cache (`getCachedAppleFullName`), not in `user_metadata` at the moment the dialog opens.

**Change:** In `src/components/CoachingBooking.tsx`:

- Resolve the prefill name in this order and pass it to `buildCalUrl`:
  1. `user.user_metadata.display_name` / `full_name` / `name`
  2. `profiles.display_name` (single `select` on open, cached in state)
  3. `getCachedAppleFullName()` from `@/lib/appleDisplayName`
- Log `[CoachingBooking] prefill-name source=…` so we can verify which source won.
- No change to Cal.com URL builder or to webhook contract.

## 2) Bottom nav — visible gap and drift on scroll

**Symptom:** A faint empty band appears under the tab bar and the bar visibly shifts a few px while scrolling.

**Root cause:** `BottomNav.tsx` repositions itself every `visualViewport.scroll` tick by setting an explicit `top`. On iOS WKWebView those events lag one frame behind the page scroll, which produces the wobble; the safe-area padding plus the computed `top` rounding also produces a 1–2px band below the bar.

**Change:** In `src/components/BottomNav.tsx`:

- Remove the `visualViewport`/`scroll`/`orientationchange` listeners and the `top` state entirely.
- Use a single static style: `position: fixed; left: 0; right: 0; bottom: 0; width: 100%; padding-bottom: env(safe-area-inset-bottom, 0px); transform: none;`.
- Keep the `createPortal(nav, document.body)` (still required to escape any ancestor containing block).
- Keep `contain: layout style` so paints stay local.
- Verify in the preview at 402×606 that no gap is rendered below the bar and that no movement occurs during a long-list scroll.

## 3) "Enable notifications" CTA opens the wrong settings page

**Symptom (IMG_0493):** Tapping the CTA opens iOS' **global** Notifications screen, not CarnivoreX's app-specific notification page.

**Root cause:** `capacitor-native-settings`' `IOSSettings.AppNotification` resolves to the global Notifications panel on some iOS builds. Apple's documented reliable way to land on the app's own settings (which contains the Notifications row pre-selected for our bundle) is the `app-settings:` URL scheme via `App.openUrl`.

**Change:** In `src/lib/openAppSettings.ts`:

- New attempt order on iOS:
  1. `App.openUrl({ url: "app-settings:" })` — opens **CarnivoreX → Settings** directly. Success when `completed === true`.
  2. Fallback: existing `NativeSettings.open({ optionIOS: IOSSettings.App })`.
  3. Fallback: existing `NativeSettings.open({ optionIOS: IOSSettings.AppNotification })`.
  4. Last resort: `CapacitorApp.openSettings()`.
- Android branch unchanged (`AndroidSettings.ApplicationDetails`).
- Keep all `[NotifSettings]` trace logs so we can confirm which branch ran.

No changes to the CTA caller in `Profile.tsx` — it already calls `openAppSettings(traceId)` when `perm !== "granted"`.

Approved with two safeguards added.

Stabilization pass — SIWA name, bottom nav, notification CTA

Three targeted fixes. No business logic changes.

1) Sign in with Apple — name not parsed into [Cal.com](http://Cal.com)

Symptom: [Cal.com](http://Cal.com) “Your name” is blank while the Apple relay email is prefilled; iOS keyboard suggests the real full name, which shows the OS has it but our app did not pass it through.

IMG_0493.jpeg

Root cause: CoachingBooking is likely relying too narrowly on user.user_metadata.display_name, while Apple users may have the usable name in profile storage or Apple name cache instead.

IMG_0493.jpeg

Change in src/components/CoachingBooking.tsx:

Resolve prefill name in this order:

user.user_metadata.display_name, full_name, name

profiles.display_name

getCachedAppleFullName() from @/lib/appleDisplayName

Cache the resolved profile name in component state when the dialog opens.

Log [CoachingBooking] prefill-name source=metadata|profile|cache|missing.

Pass the resolved value into buildCalUrl.

No webhook contract change.

Safeguard: trim whitespace and reject placeholder/empty strings before falling through to the next source, so a blank profile value does not incorrectly “win.”

2) Bottom nav — visible gap and drift on scroll

Symptom: There is still a visible slot below the tab bar and slight movement during scroll.

IMG_0490.jpeg

+1

Root cause: viewport-driven repositioning on scroll is likely introducing lag and rounding artifacts on iOS WKWebView, especially when combined with safe-area math. The screenshot pattern is consistent with a fixed element being over-managed rather than statically anchored.

IMG_0491.jpeg

+1

Change in src/components/BottomNav.tsx:

Remove visualViewport listeners, scroll listeners, orientation-driven manual top calculation, and any top state.

Keep createPortal(nav, document.body).

Use a single static layout rule:

position: fixed

left: 0

right: 0

bottom: 0

width: 100%

padding-bottom: env(safe-area-inset-bottom, 0px)

transform: none

Keep contain: layout style.

Safeguard: make sure the page content container gets bottom padding equal to nav height plus safe-area inset, otherwise the nav may stop drifting but still cover the final content rows.

IMG_0490.jpeg

+1

3) “Enable notifications” CTA opens the wrong settings page

Symptom: The CTA is landing in general iOS Notifications or generic app settings, not the app-specific notification permissions destination. The screenshots show global Notifications and CarnivoreX app settings, but not a successful app notification landing target.

IMG_0494.jpeg

+2

Root cause: IOSSettings.AppNotification is not reliably landing on the desired destination on this iOS/device combination, so the current attempt order is not producing the correct user outcome.

IMG_0495.jpeg

+2

Change in src/lib/openAppSettings.ts:

iOS attempt order:

App.openUrl({ url: "app-settings:" })

[NativeSettings.open](http://NativeSettings.open)({ optionIOS: [IOSSettings.App](http://IOSSettings.App) })

[NativeSettings.open](http://NativeSettings.open)({ optionIOS: IOSSettings.AppNotification })

CapacitorApp.openSettings()

Android unchanged.

Keep [NotifSettings] logs for each branch and result.

Safeguard: log both the attempted branch and the returned completion/result value, because “settings opened” is not the same as “correct destination opened.”

Verification

After clean install on device, capture:

[CoachingBooking] prefill-name source=profile|cache|metadata and [Cal.com](http://Cal.com) shows the real Apple name prefilled. 

IMG_0493.jpeg

Bottom nav remains visually pinned with no band beneath it and no wobble during long scroll on Profile and Recipes.

IMG_0491.jpeg

+1

Notification CTA logs show which branch ran, and the user lands on CarnivoreX settings via the most direct supported destination rather than the generic Notifications list.

IMG_0489.jpeg

+2

Files touched

src/components/CoachingBooking.tsx

src/components/BottomNav.tsx

src/lib/openAppSettings.ts

## Verification

After build + clean install on device, capture:

- Xcode console: `[CoachingBooking] prefill-name source=profile` (or `cache`/`metadata`) and the resulting Cal.com page shows the Apple name pre-filled in "Your name".
- Bottom nav: scroll Recipes / Profile — bar stays pinned; no band underneath at 402×606.
- Notification CTA: `[NotifSettings] open() result=app-settings:` followed by iOS landing on **Settings → CarnivoreX** (not the global Notifications list).

## Files touched

- `src/components/CoachingBooking.tsx`
- `src/components/BottomNav.tsx`
- `src/lib/openAppSettings.ts`