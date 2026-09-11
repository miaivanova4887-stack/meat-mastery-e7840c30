# Push notifications: remaining checks before Play Store submission

Your test notification arrived, so the whole delivery chain now works: phone registers, backend sends, Firebase delivers. Two small checks are worth doing before you submit, then the build is good to go.

## Recommended checks on your phone (10 minutes)

1. **App fully closed** — swipe CarnivoreX away from recents, then I send another test. Confirms notifications arrive when the app isn't running (the case most users will be in).
2. **Tap-through** — tap the notification and confirm the app opens on the right screen instead of a blank page.
3. **Second device or second account (optional)** — confirms registration isn't a one-off for your account.

## What I will verify on my side

- A scheduled reminder actually fires on its own, not just a manual test. The automatic checks run every 5 minutes and every hour and are both active, but no reminder has ever been scheduled yet, so nothing has been proven end to end.
- I'll schedule one reminder a few minutes out for your account, watch it get picked up, and confirm it lands on your phone.
- Confirm stale/expired phone registrations get cleaned up so sending doesn't error later.

## Build readiness

The current build is version 1.1.7 (code 15) and targets Android 16 (API 36), which satisfies the new Play requirement. Nothing in the app needs changing for submission.

Before you upload the release bundle:

- Build the release AAB (not the debug APK you're testing with) and confirm it also targets API 36.
- Since you added notifications, the Play Console listing needs the notification permission mentioned in the Data Safety answers if it isn't already.
- Keep the device exclusion rules as agreed: exclude Android Go, RAM at or below 1024 MB, no Play Integrity rule.

## Technical notes

- Registered device: one Android FCM token for mia.ivanova.4887@gmail.com, saved 20:40 UTC.
- `fcm-send` returned `sent: 1, failed: 0` for that token.
- Cron jobs `push-dispatch-every-5min` and `push-reconcile-hourly` are both active; `push_campaigns` is empty (no campaign has ever run).
- Android: minSdk 26, compileSdk 36, targetSdk 36; versionCode 15 / versionName 1.1.7.
