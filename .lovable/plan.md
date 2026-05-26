## Goal

Resolve the runtime error:

```
Unacceptable audience in id_token: [com.mi4labs.carnivorex]
```

The native iOS Sign in with Apple flow is working (the plugin returns a valid Apple ID token). Supabase rejects it only because the Apple provider's **Authorized Client IDs** list does not yet include the iOS bundle ID `com.mi4labs.carnivorex`. This is a backend config change only — no code changes are needed.

## Why this happens

For native iOS Sign in with Apple, Apple signs the ID token with the `aud` claim set to your **iOS bundle ID** (`com.mi4labs.carnivorex`), not a web Services ID. Supabase's Apple provider verifies that `aud` against its list of authorized client IDs. If the bundle ID isn't in that list, the token is rejected even though it's perfectly valid.

You confirmed Apple sign-in is iOS-only — no web flow — so we only need the single bundle ID. No client-secret JWT, no Services ID, no `.p8` upload needed.

## Step-by-step (line-by-line)

### Step 1 — Open backend Apple provider settings

1. In the Lovable editor, click the **Open Backend** button below this plan (or: Cloud → Users → Auth Settings).
2. In the backend UI, go to: **Authentication → Sign In Methods → Apple**.
3. Make sure the **Enable Sign in with Apple** toggle is ON.

### Step 2 — Set Authorized Client IDs

In the Apple provider form, find the field labeled **Client IDs** (also sometimes shown as "Authorized Client IDs" or "Bundle IDs").

Set it to exactly this value (no spaces, no quotes):

```
com.mi4labs.carnivorex
```

That's the entire field — one entry, your iOS bundle ID.

### Step 3 — Leave web-only fields blank

Because this is iOS-only:

- **Secret Key (Client Secret JWT)**: leave blank (or untouched if a stale value is there — clearing it is fine and won't break native flow).
- **Services ID / Web Client ID**: not needed.
- **Team ID / Key ID / .p8**: not needed for native-only.

If the UI requires the Client Secret field to be non-empty to save, you can still save with just the Client IDs populated — the secret is only used by Supabase's web OAuth redirect flow, which you are not using.

### Step 4 — Save and confirm

1. Click **Save** in the Apple provider form.
2. Reload the page and re-open Apple settings to verify the saved value is exactly `com.mi4labs.carnivorex`.

### Step 5 — Test on device

No new build needed — this is a server-side config change that takes effect immediately.

1. On the iPhone, fully close the CarnivoreX app (swipe up from app switcher).
2. Reopen the app and tap **Sign in with Apple**.
3. Complete the native Apple sheet.
4. Expected result: app proceeds into the onboarding / home flow instead of throwing `Unacceptable audience`.

## Final Apple provider values you should have in Supabase

| Field | Value |
|---|---|
| Enable Sign in with Apple | ON |
| Client IDs (Authorized Client IDs) | `com.mi4labs.carnivorex` |
| Secret Key (Client Secret JWT) | (blank — native iOS only) |
| Services ID | (not used) |
| Team ID / Key ID / .p8 | (not used) |

## If web Apple login is added later

When/if you ever add Sign in with Apple on the web app, you'll then need to:

1. Create an Apple **Services ID** in Apple Developer Console (e.g. `app.carnivorex.web`).
2. Add it to **Client IDs** as a second comma-separated entry: `com.mi4labs.carnivorex,app.carnivorex.web`.
3. Generate a client secret JWT from your `.p8` key and paste it into **Secret Key**.

Not needed now.

## What this plan does NOT change

- No code files are edited.
- No new build / archive / TestFlight upload is required.
- No native plugin or entitlement changes.

Ready to switch to build mode? There's nothing for me to code here — the fix is entirely in the backend UI per the steps above. Once you've saved the Client IDs field and tested on device, paste the result and I'll either confirm it's done or debug the next error.
