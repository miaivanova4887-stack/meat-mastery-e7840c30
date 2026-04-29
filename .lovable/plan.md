# Firebase Push Messaging with Consent & Segmentation

Before any code changes — confirming the scope below, since you asked me to ask for permission before adding/modifying SDKs, cloud functions, analytics, or backend logic. **Nothing will be modified until you approve.**

## What you already have (no changes needed to baseline)
- `firebase` web SDK + `src/lib/firebase.ts` (Analytics + Messaging init scaffolded)
- Web push pipeline via Supabase `push-notifications` edge function + VAPID + `push_subscriptions` table
- Capacitor Android shell, `com.google.gms:google-services` plugin already wired in `android/app/build.gradle` (currently inert because no `google-services.json` exists yet)

## What's missing & will be added

### 1. Native Android FCM (Capacitor)
- **New SDK**: `@capacitor/push-notifications` (official Capacitor plugin → routes through FCM on Android, APNs on iOS). Lightweight, no extra cost.
- Add `google-services.json` (you provide from Firebase console; project `carnivore-84bd2` already exists per `src/lib/firebase.ts`).
- AndroidManifest: add `POST_NOTIFICATIONS` permission (Android 13+) and a default notification icon/color meta-data.
- Build script (`scripts/build-android-fresh.sh`): no logic change needed beyond `npx cap sync` picking up the new plugin.

### 2. Web push — keep current VAPID flow
Web push already works through Supabase + `web-push`. No need to switch web to FCM (would add complexity and a second SDK). Native uses FCM; web stays on standards-based VAPID. Both write to the same consent state and segmentation tables.

### 3. Consent capture at the right moment
- Trigger: **after onboarding Step 11 (Wellness Disclaimer)** completes — that's the natural "first value delivered" moment, not at app launch (which Apple/Google both penalize for prompt fatigue).
- Soft pre-prompt screen ("Get streak reminders, fasting alerts, new recipes — you choose what") → if user taps Enable, then OS prompt fires.
- Save consent state immediately whether granted or denied.
- Re-surface from Profile → Notifications panel anytime; deep-link to OS settings if previously denied.

### 4. Backend: consent + segmentation storage
New columns on existing `profiles` table (additive, no breaking change):
- `push_consent` (text: `granted` | `denied` | `unset`)
- `push_consent_at` (timestamptz)
- `notification_preferences` (jsonb, e.g. `{ streaks: true, recipes: true, fasting: true, marketing: false }`)

New table `device_tokens` (FCM tokens per user/device, separate from `push_subscriptions` which holds web VAPID subs):
- `user_id`, `token`, `platform` (`android`|`ios`|`web`), `app_version`, `last_seen_at`
- RLS: user manages own rows; service role reads all for sending.

New table `push_campaigns` (admin-defined sequences):
- `id`, `name`, `trigger_type` (`event` | `attribute`), `trigger_config` (jsonb — e.g. `{ event: "meal_logged", count_gte: 3 }` or `{ attribute: "diet_tier", equals: "lion" }`)
- `steps` (jsonb array — `[{ delay_minutes: 0, title, body, deeplink, category }, { delay_minutes: 1440, ... }]`)
- `active` (bool)

New table `push_campaign_runs`:
- `campaign_id`, `user_id`, `current_step`, `next_send_at`, `status` (`pending`|`done`|`cancelled`)
- Drives the sequence scheduler.

### 5. Edge functions (Deno, Supabase — counts as Lovable Cloud)
- **`fcm-send`** — accepts `{ user_id?, segment?, title, body, data }`, looks up tokens from `device_tokens` filtered by `notification_preferences` + segment criteria, sends via FCM HTTP v1 API using a Firebase service account JSON (stored as secret `FIREBASE_SERVICE_ACCOUNT`). Cleans up invalid tokens.
- **`push-event-trigger`** — called from the app (or from other edge functions) when a domain event happens (e.g. `meal_logged`, `streak_milestone`, `subscription_started`). Matches active `push_campaigns` with `trigger_type=event`, enqueues `push_campaign_runs`.
- **`push-scheduler`** — runs on Supabase cron (every 5 min), picks `push_campaign_runs` where `next_send_at <= now()`, sends step via `fcm-send`, advances or completes.
- **`register-device-token`** — auth'd endpoint to upsert FCM token + platform.

### 6. Attribute-based segmentation
`fcm-send` supports a `segment` filter joining `device_tokens` ↔ `profiles`:
- `diet_tier in (...)`, `health_targets contains (...)`, `subscription_tier = ...`, `notification_preferences.<key> = true`, `push_consent = 'granted'` (always enforced).

### 7. Client wiring (lightweight)
- `src/lib/pushFcm.ts` — native init: requests permission via `@capacitor/push-notifications`, registers token, calls `register-device-token`, listens for foreground messages.
- Existing `src/lib/pushNotifications.ts` (web VAPID) updated only to also write `push_consent` to `profiles` so segmentation works across web + native.
- New `src/components/NotificationConsentSheet.tsx` — soft pre-prompt + preference toggles.
- Hook into `Onboarding.tsx` post-Step 11 and into `Profile.tsx` notifications panel (already has a Bell icon import).
- Event triggers: thin wrapper `triggerPushEvent(eventName, payload)` invoked from existing flows (meal log, streak hit, etc.) — calls `push-event-trigger`. Won't change unrelated logic; only adds non-blocking calls.

### 8. Admin UI (minimal)
Extend existing `AdminNotifications.tsx`:
- Tab for **Campaigns**: list/create/edit `push_campaigns` (name, trigger, steps, active toggle).
- Reuse existing admin auth gate (`useIsAdmin`).

## Third-party services / SDKs being added
| Service / SDK | Purpose | Cost |
|---|---|---|
| Firebase Cloud Messaging (FCM) | Native push transport (Android, iOS-ready) | Free |
| `@capacitor/push-notifications` (official Capacitor plugin) | Native permission + token APIs | Free, MIT |
| Firebase Admin (service account JSON) | Server-side FCM send via HTTP v1 | Free |
| Supabase Edge Functions + cron | Sequence scheduler, consent storage | Already on Lovable Cloud |
| `web-push` (existing) | Web browser push via VAPID | Already in use |

No paid analytics, no OneSignal/Braze/Customer.io. Firebase Analytics already initialized (you can later use Firebase Console's built-in Audiences for segmentation if you want, but **the in-app/server segmentation is self-contained and does not require it**).

## Permissions I'll need from you before I start
1. Approve adding `@capacitor/push-notifications` to dependencies.
2. Approve creating new Supabase tables: `device_tokens`, `push_campaigns`, `push_campaign_runs`, plus 3 new columns on `profiles`.
3. Approve creating 4 new edge functions: `fcm-send`, `push-event-trigger`, `push-scheduler`, `register-device-token`.
4. Approve adding 1 secret: `FIREBASE_SERVICE_ACCOUNT` (you generate from Firebase Console → Project Settings → Service Accounts → Generate new private key; paste full JSON).
5. You'll need to upload `google-services.json` to `android/app/` (I'll tell you exactly where after approval). I can't pull this for you — it must come from your Firebase Console.

## Order of implementation (after you approve)
1. Schema migration (tables + columns)
2. Backend: 4 edge functions + Supabase cron config
3. Client: consent sheet, FCM init, token registration
4. Wire post-onboarding consent prompt + Profile preferences panel
5. Wire event triggers into existing logged-event paths (additive only)
6. Admin Campaigns UI
7. AndroidManifest tweaks + sync; you drop in `google-services.json` and rebuild APK

## What I will NOT touch
- Existing onboarding flow logic, recipe code, meal plan, Health Connect, Stripe, RLS on unrelated tables, build script logic beyond what `npx cap sync` does automatically, or any UI not directly related to notifications.

---

Reply **"approve"** to proceed, or tell me what to change (e.g. "skip Admin Campaigns UI", "use a different consent moment", "don't add cron — manual sends only", etc.).
