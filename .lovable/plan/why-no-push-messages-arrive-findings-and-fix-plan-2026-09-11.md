# Why no push messages arrive — findings and fix plan

Push notifications cannot work in this project right now. Not one link in the chain is complete. I checked each part; here is the real state.

## How push is supposed to work

```text
User taps "Enable notifications"
   -> phone asks permission
   -> Firebase gives the app a device token
   -> token saved in the database (device_tokens)
   -> account record marked "notifications allowed" (profiles)
Admin sends a message (Admin > Notifications, or a scheduled/event message)
   -> backend picks accounts that allowed notifications
   -> looks up their device tokens
   -> sends each one to Firebase
   -> Firebase delivers to the phone
```

## What is actually broken

1. Android notifications are switched off in the app code. A safety switch (`NATIVE_FCM_ENABLED_ANDROID`) is set to off, so the app never asks Firebase for a device token on Android.
2. The Firebase Android config file is missing from the app project (`android/app/google-services.json`). Without it the Android build has no Firebase identity at all — this is why the safety switch was turned off.
3. The Firebase sending credential is missing from the backend. The send function needs a `FIREBASE_SERVICE_ACCOUNT` value and it is not set, so every send attempt fails immediately.
4. Web notification keys are missing too (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), so browser notifications also cannot be sent.
5. No device is registered: the device token table is empty.
6. Account records are never created. There are 2 sign-ups but 0 rows in the accounts table, because the automatic "create record on sign-up" hook was not carried over when this project was remixed. Even with everything else fixed, the sender finds zero eligible recipients.

So testing could never have produced a notification.

## Fix plan

Step 1 — Restore account records (backend only)

- Re-create the automatic hook that inserts an account record when someone signs up.
- Backfill records for the 2 existing sign-ups so they become addressable.

Step 2 — Add the Firebase sending credential

- You provide the Firebase service account JSON for the `carnivore-84bd2` Firebase project (Firebase console > Project settings > Service accounts > Generate new private key).
- I store it as `FIREBASE_SERVICE_ACCOUNT` and verify a send request is accepted.

Step 3 — Add the Android Firebase config file

- You download `google-services.json` for the Android app `com.mi4labs.carnivorex` from the same Firebase project.
- I place it in the Android project so the build wires Firebase in.

Step 4 — Turn Android notifications on

- Flip the Android switch on, keep the existing permission flow, and confirm the device token is saved after granting permission.

Step 5 — Web notifications (optional, tell me if you want it)

- Generate a web push key pair and store both halves so browser notifications work as well.

Step 6 — Verify end to end (evidence-first)

- Rebuild the Android app, install, grant permission.
- Confirm a token row appears and the account is marked as allowing notifications.
- Send a test message from the admin screen and confirm both the delivery report and the notification on the phone.
- New app version needed for this: version code 14, version name 1.1.6.

## Technical notes

- `src/lib/pushNativeConfig.ts`: `NATIVE_FCM_ENABLED_ANDROID = false`; `isNativeFcmEnabled()` gates listener binding and `register()` in `src/lib/pushFcm.ts`.
- `android/app/build.gradle` applies the `com.google.gms.google-services` plugin only when `google-services.json` exists, otherwise logs "Push Notifications won't work".
- `supabase/functions/_shared/fcm.ts` throws `FIREBASE_SERVICE_ACCOUNT not set`; used by `fcm-send`, `push-scheduler`, `push-event-trigger`, `admin-test-push`.
- `fcm-send` filters `profiles.push_consent = 'granted'` then joins `device_tokens` on platform android/ios — both empty today.
- Missing trigger: `on_auth_user_created` calling `public.handle_new_user()` on `auth.users` (the function exists; the trigger does not). Migration will create it plus an idempotent backfill insert.
- Blocked items needing your input: Firebase service account JSON, `google-services.json`, and (if wanted) VAPID keys.

User notes: please also verify and activate auto-triggered notifications