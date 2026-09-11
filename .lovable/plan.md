# Android push: still waiting on the right Firebase file

## What you just uploaded

This is a Firebase **admin service account key** (`firebase-adminsdk-...json`) for project `carnivore-84bd2`. That credential is the *sending* side, and it is already saved and verified working — Firebase accepted it earlier and only rejected my deliberately fake test phone.

Two notes:

1. It is not the file the app needs. Phones can only receive notifications once the Android app config file `google-services.json` is added to the app.
2. This key was pasted into chat in plain text, so it should be treated as exposed. In Firebase, Project settings, Service accounts, generate a new private key and delete the old one, then send me the replacement privately so I can update the stored value.

## The file I need

Firebase console, project `carnivore-84bd2`, Project settings, Your apps, the Android app `com.mi4labs.carnivorex`, then the download button for `google-services.json`. Attach that file here.

If no Android app is listed there, add one with package name `com.mi4labs.carnivorex` first; the download appears after that.

## What I do once I have it

1. Add `google-services.json` into the Android app folder.
2. Turn on Android notifications (the `NATIVE_FCM_ENABLED_ANDROID` switch) and add the Google services Gradle plugin so the file is picked up at build time.
3. Bump the app version to build 14, version name 1.1.6.
4. Give you copy-paste, line-by-line terminal steps to clean, rebuild, and install on your phone.
5. Verify on device: the app registers a notification token, and a test notification arrives. I check the stored device token and the send result, not just the app screen.

## Optional, say the word

Browser notifications need two extra values (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`). Not required for the Android app. I can generate that pair and wire web push in the same pass.

## Technical notes

- Sending path (already live): scheduled checks every 5 minutes for reminders and hourly for campaigns, all returning success.
- `FIREBASE_SERVICE_ACCOUNT` is set and validated against project `carnivore-84bd2`; rotating it is a value swap only, no code change.
- `android/app/google-services.json` is absent; without it the native Firebase SDK cannot initialize, so token registration stays disabled by design.
