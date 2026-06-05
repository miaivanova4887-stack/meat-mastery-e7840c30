## Evidence

- The backend now sends successfully: `deliveredNative: 1`, `fcmAttempts: 1`, `errors: 0`.
- The Firebase secret is correct: `project_id= carnivore-84bd2`.
- The current iOS/FCM payload only includes generic `notification`, `data`, and Android priority.
- The Capacitor config does not set iOS foreground notification presentation options.

## Likely cause

FCM accepted the message, but iOS may not display it when the app is foregrounded, or the APNs-specific payload is too generic for reliable visible delivery.

## Plan

1. Update the shared FCM sender to include iOS/APNs-specific fields:
  - `apns-priority: 10`
  - `aps.alert.title/body`
  - `aps.sound: default`
  - `aps.badge: 1`
  - `fcm_options.analytics_label` for tracing
2. Add Capacitor iOS foreground display settings in `capacitor.config.json`:
  - `PushNotifications.presentationOptions = ["badge", "sound", "alert"]`
3. Remove the temporary diagnostic service-account log from `supabase/functions/_shared/fcm.ts` now that the Firebase project is verified.
4. Deploy/retest the affected edge functions after implementation.

Approved with one clarification.

I agree with:

adding APNs-specific iOS payload fields in the shared FCM sender,

adding Capacitor iOS presentationOptions = ["badge", "sound", "alert"],

removing the temporary Firebase service-account diagnostic log,

redeploying and retesting.

Clarification:

this is the right fix for foreground presentation and for making the iOS payload more correct,

but it is not full proof of background/locked-screen delivery by itself.

Required validation after deploy:

Test while app is open in foreground — expect visible alert/banner.

Test while app is backgrounded or phone is locked — expect normal iOS notification delivery.

If foreground works but background/locked does not, next verify APNs key/environment configuration in Firebase for com.mi4labs.carnivorex.

## After implementation, test on the iPhone

- Keep the app open and tap **Send test reminder**: it should show a banner/alert because foreground presentation is enabled.
- Then lock the phone or background the app and send again: it should show through normal iOS notification delivery.
- If foreground works but locked/background does not, the next thing to verify is the Firebase APNs key/environment configuration for `com.mi4labs.carnivorex`.