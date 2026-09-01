# Play Console declarations for this submission

What to declare (and what to exclude) for CarnivoreX, based on what the app actually ships.

## 1. Data safety form

Declare collected + linked to identity (account required):
- Email address and name (account creation, Google sign-in)
- Health & fitness: steps, heart rate, weight, calories (Health Connect reads), plus logged meals/progress
- App activity / app interactions and diagnostics (Firebase Analytics)
- Device or other IDs (Firebase/FCM push tokens, AppsFlyer attribution)
- Photos (only if the user takes a food photo — collected, optional)
- Audio: voice input for Smart Log — declare only if audio leaves the device; if speech is transcribed on-device and only text is stored, declare "not collected" and say so in the description
- Purchase history (coaching call payments via Stripe, subscriptions via RevenueCat)

For every item: encrypted in transit = Yes, users can request deletion = Yes (in-app account deletion exists).

Exclude / mark "not collected":
- Precise or approximate location
- Contacts, calendar, SMS, call logs
- Installed apps list, files & docs
- Financial info beyond purchase history (card data never touches the app — Stripe/Google Play handle it)

Do not tick "Data shared with third parties" for analytics/attribution processors unless you treat AppsFlyer as sharing; declare processors as collection, not sharing, and keep the Privacy Policy consistent with whatever you tick.

## 2. Health Connect declaration form

Required because the app reads Health Connect data. Declare:
- Permissions requested: READ_STEPS, READ_HEART_RATE, READ_WEIGHT, READ_ACTIVE_CALORIES_BURNED, READ_TOTAL_CALORIES_BURNED (read-only, no writes)
- Use case: display the user's own fitness metrics inside their progress dashboard
- Confirm no advertising or resale use of health data, and record a demo video of the permission prompt + where the data appears

## 3. Permissions declarations

Sensitive-permission forms to complete or exclude:
- No declaration needed: INTERNET, POST_NOTIFICATIONS, camera, microphone (all standard/runtime, tied to visible features)
- Excluded — never add these, they trigger extra review: QUERY_ALL_PACKAGES, SMS/Call Log, MANAGE_EXTERNAL_STORAGE, foreground service types, exact alarms, all-files access, accessibility
- The only `<queries>` entry is the Health Connect package, which is the documented allowed use

## 4. Content and policy declarations

- Ads: **No** — the app serves no advertising (AppsFlyer is attribution only, not ad serving)
- App access: provide the reviewer test credentials, since content is behind sign-in
- Content rating questionnaire: no violence/sexual content/gambling; select the health & fitness category
- Target audience: 18+ only — exclude children's audiences so Families policy and Play's teacher-approved rules don't apply
- Health apps declaration: not a medical device, no diagnosis/treatment claims; point to the in-app wellness disclaimer
- News, COVID-19 contact tracing, financial features, VPN, government app: all **No**
- Data deletion URL: required — link the in-app account deletion path plus a web-facing deletion request page
- Government/medical claims: exclude any wording implying treatment of disease in the store listing

## 5. Payments declarations

- Subscriptions must use Google Play billing (RevenueCat wraps it) — already the case on Android
- Coaching calls go through Stripe. This is only compliant if the coaching call is a real-world one-to-one service, not digital in-app content. Declare it as a physical/real-world service; if Play challenges it, the fallback is routing coaching purchases through Play billing on Android too.
- Do not include external payment links for subscriptions anywhere in the Android build

## 6. Countries and distribution exclusions

- Include US and Canada, since coaching pricing is only defined for USD and CAD
- Exclude countries where Stripe coaching checkout has no configured currency, or ship coaching as USD-only there
- Exclude Wear OS, Android TV, Auto and Chromebook form factors — the app is portrait phone-locked (`resizeableActivity="false"`)

## Notes

- No code changes are part of this; it is entirely Play Console form work.
- One open question decides two answers: whether voice audio is uploaded for transcription, and whether AppsFlyer counts as sharing. Confirm both before submitting, because the Data safety form must match the Privacy Policy exactly.
