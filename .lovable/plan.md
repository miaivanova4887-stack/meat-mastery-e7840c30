## Goal

On `/progress`, when a signed-out user lands on the gate, add warm, user-friendly copy explaining *why* they need an account: to track progress consistently, set personal goals, and get a personalized experience. Keep it consistent with the recent Auth-page "whyAccount" addition.

## Changes

### 1. `src/i18n/en.json` — update `progress.signInDesc`

Replace the current dry sync-focused string with a benefit-led one:

- `signInToTrack` (kept): `"Sign in to unlock your progress"`
- `signInDesc` (revised): `"Create a free account to track your progress consistently, set personal goals, and enjoy a tailored carnivore experience — your data stays secure and synced across devices."`

### 2. `src/i18n/fr.json` — matching French copy

- `signInToTrack`: `"Connectez-vous pour débloquer vos progrès"`
- `signInDesc`: `"Créez un compte gratuit pour suivre vos progrès en continu, définir vos objectifs et profiter d'une expérience carnivore personnalisée — vos données restent sécurisées et synchronisées sur tous vos appareils."`

### 3. `src/pages/Progress.tsx` — light layout polish on the gate (lines 36–46)

Keep the existing structure but give the description a bit more room so the longer copy reads cleanly:

- Wrap the description in `max-w-sm` so it doesn't run edge-to-edge on phones.
- Bump bottom margin from `mb-4` to `mb-6` between description and CTA.
- No logic changes, no new components, no extra strings.

## Out of scope

- No changes to the Auth page, sign-in flow, or any other gated screens.
- No new translations beyond the two revised keys.
- No design system / token changes.
