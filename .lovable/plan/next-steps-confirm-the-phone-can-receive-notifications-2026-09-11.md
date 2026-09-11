# Next steps: confirm the phone can receive notifications

Right now the backend shows **no notification token from any phone yet**, so a test notification would have nowhere to go. The steps below get the token registered, then fire a real test notification at your device.

## Step 1 — On the phone (do this first)

1. Open the app.
2. Sign in with the account you want to test (Google sign-in or email).
3. When the "Allow notifications?" system prompt appears, tap **Allow**.
   - If no prompt appears, go to the app's Profile → Settings and enable notifications there.
   - If it was previously denied: phone Settings → Apps → CarnivoreX → Notifications → turn on.
4. Leave the app open on the home screen for about 10 seconds, then tell me it's done.

## Step 2 — I verify the token arrived

I check the stored device tokens for a new Android entry tied to your account. Two outcomes:

- **Token present** → continue to Step 3.
- **Still empty** → we read the phone's live log to see exactly why registration failed. You run these two lines from the project root, one at a time, with the phone connected:

```
adb logcat -c
```
```
adb logcat | grep -iE "Push|FCM|Firebase|CarnivoreX"
```
Then reopen the app on the phone, let it run 15 seconds, copy the output here, and press Ctrl+C to stop.

## Step 3 — Real test notification

Once your token is stored, I send an actual notification to that one device and you confirm it arrives:

- App closed (background delivery)
- App open (foreground delivery)
- Tapping the notification opens the right screen in the app

## Step 4 — Scheduled notifications check

The automatic checks already run (every 5 minutes for coaching reminders, hourly for campaigns). After the direct test works, I confirm a scheduled notification also lands, so nothing is dependent on manual sending.

## Technical notes

- `device_tokens` is currently empty; token registration happens through the `register-device-token` function and requires an active signed-in session, so an anonymous first launch will not register anything.
- Android FCM is enabled in the build (`NATIVE_FCM_ENABLED_ANDROID`), `android/app/google-services.json` is committed, and the Firebase service-account credential was verified against project `carnivore-84bd2`.
- Test sends will target a single token so no other user is affected.
