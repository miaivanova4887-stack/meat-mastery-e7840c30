# Fix FCM `SENDER_ID_MISMATCH`

## Diagnosis

The iOS client is healthy. The 403 `SENDER_ID_MISMATCH` from FCM means the **device token was minted for one Firebase project, but the backend is calling `messages:send` against a different project**.

What we know from the codebase:

- iOS `ios/App/App/GoogleService-Info.plist` is bound to:
  - `PROJECT_ID = carnivore-84bd2`
  - `GCM_SENDER_ID = 963699055181`
  - `BUNDLE_ID = com.mi4labs.carnivorex`
  - `GOOGLE_APP_ID = 1:963699055181:ios:fc5864a5705a012dd7da04`
- The web SDK (`src/lib/firebase.ts`) also points at `carnivore-84bd2` / sender `963699055181`. ✅ matches iOS.
- Backend `supabase/functions/_shared/fcm.ts` reads the `FIREBASE_SERVICE_ACCOUNT` secret and posts to:
  ```
  https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send
  ```
  So whatever `project_id` is inside that JSON is the project FCM uses. If it is **not** `carnivore-84bd2`, every send to an iOS token from `carnivore-84bd2` fails with `SENDER_ID_MISMATCH`. This is almost certainly the cause.

No client changes are needed.

## Plan

### Step 1 — Add a one-shot diagnostic log (safe, no secrets exposed)

Edit `supabase/functions/_shared/fcm.ts` so that on first use it logs the service account's `project_id` and `client_email` (these are not secrets — `client_email` is a `*.iam.gserviceaccount.com` address; the private key is never logged). Example added inside `getServiceAccount()` after parsing:

```ts
console.log("[fcm] service account project_id=", cachedSa.project_id,
            "client_email=", cachedSa.client_email);
```

Then trigger the existing **"Send test reminder"** button once and read the `coaching-reminder-test` edge function logs. Expected line:

```
[fcm] service account project_id= carnivore-84bd2 ...
```

If `project_id` is **not** `carnivore-84bd2`, the mismatch is confirmed.

### Step 2 — Replace the `FIREBASE_SERVICE_ACCOUNT` secret with one from `carnivore-84bd2`

In the Firebase console (project **carnivore-84bd2**):

1. Open **Project settings → Service accounts → Firebase Admin SDK**.
2. Click **Generate new private key** → download the JSON.
3. Confirm the JSON contains `"project_id": "carnivore-84bd2"` and `"client_email"` ending in `@carnivore-84bd2.iam.gserviceaccount.com`.
4. In Lovable, update the `FIREBASE_SERVICE_ACCOUNT` secret with the **entire JSON file contents** (one line or multiline, both work — it is parsed with `JSON.parse`).

I will trigger that secret-update prompt for you once you approve this plan.

### Step 3 — Re-verify

1. Tap **Send test reminder** in the iOS app.
2. Confirm the new edge log shows `project_id= carnivore-84bd2`.
3. Confirm the response is `{ ok: true, deliveredNative: 1 }` and the iOS device receives the banner.

### Step 4 — Cleanup

Remove the diagnostic `console.log` from `fcm.ts` once verified, so we are not logging service-account identifiers on every send.

## Things to also double-check on your side (no code action needed)

- **APNs key uploaded in the right Firebase project.** In Firebase console → Project settings → **Cloud Messaging → Apple app configuration** for app `1:963699055181:ios:fc5864a5705a012dd7da04`, an APNs **Auth Key (.p8)** with Team ID `$APPLE_TEAM_ID` and Key ID `$APPLE_KEY_ID` must be uploaded. Without it, FCM can mint tokens but cannot deliver to APNs — but it would surface as a different error (`Unregistered` / APNs failure), not `SENDER_ID_MISMATCH`. Still worth confirming while you are in the console.
- **Bundle ID in Firebase app = `com.mi4labs.carnivorex**` — matches the installed app.
- **No stale device tokens.** After Step 2, old tokens minted under a different project (if any leaked in earlier builds) will return `UNREGISTERED` on the next send and be auto-deleted by `fcm-send` (already implemented). The freshly registered iOS token from your latest run is already correct.

User: Approved.

The diagnosis is correct:

the iOS token is being minted under Firebase project carnivore-84bd2,

the backend sender credentials are almost certainly from a different Firebase project,

that is exactly what produces FCM 403 SENDER_ID_MISMATCH.

I approve this fix plan:

Add the temporary backend log for project_id and client_email

Confirm whether the current service account matches carnivore-84bd2

Replace FIREBASE_SERVICE_ACCOUNT with a Firebase Admin SDK JSON from project carnivore-84bd2

Re-test with the existing iOS app

Remove the temporary log after verification

One addition: during verification, also confirm the logged client_email ends in @[carnivore-84bd2.iam.gserviceaccount.com](http://carnivore-84bd2.iam.gserviceaccount.com).

## Out of scope

- No client / push-bridge code changes.
- No Android changes.
- No Supabase schema changes.