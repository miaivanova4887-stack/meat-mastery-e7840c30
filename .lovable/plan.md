# App Review Resubmission Plan

## Audit results

### 1) Subscription / paywall compliance — **FAIL**

File: `src/pages/Pricing.tsx`

Present:

- Localized App Store price label per package (`paywall.packages.*.priceLabel`, e.g. `$6.99/mo`)
- Tappable Privacy Policy / Terms of Use links (native footer, lines 419–433)
- Restore Purchases button (native only)
- One-line disclosure: "Subscriptions auto-renew unless cancelled at least 24 hours before the period ends. Manage or cancel anytime in your Apple ID settings." (lines 415–418)

Missing / non-compliant:

- No explicit **subscription title + duration** next to each Buy button. Apple wants e.g. "Pro — Monthly subscription (1 month, auto-renewing) — $6.99".
- No **per-unit price** when yearly is selected (currently shows `$49.99/yr`, no `≈ $4.17/mo`).
- Disclosure block does **not** include all required Apple lines: charge at confirmation, renewal charged within 24h before period end, manage/turn off in Account Settings, free-trial forfeiture (only required if a trial exists — none currently configured, so we will state explicitly "no free trial").
- Disclosures must sit **above the Buy buttons within the purchase flow**, not only in the footer.

### 2) Camera permission flow — **FAIL**

File: `src/components/progress/BarcodeScanner.tsx` (lines 49–77, 126–149)

- `handleCameraBlocked` auto-calls `openAppSettings()` the moment `getUserMedia` returns NotAllowedError on the very first denial → exactly the behavior Apple rejected.
- No pre-prompt explainer sheet before the iOS system dialog.
- Toast copy is persuasive ("Enable it in app settings, then return.").

`PhotoRecognition.tsx` uses `<input type="file" capture="environment">` which delegates to the native picker (lower risk), but still needs an explainer for consistency.

### 3) In-app account deletion — **FAIL**

- No `delete-account` edge function exists.
- `Profile.tsx` has no "Delete Account" entry in the settings tab.
- Sign in with Apple is enabled (`src/pages/Auth.tsx` line 135+), so deletion must also call Apple's `/auth/revoke` endpoint per App Store Guideline 5.1.1(v).

---

## Implementation plan (priority order)

### Step 1 — Paywall disclosures (Pricing.tsx)

1. Add a **per-plan subtitle line** under the price: `Monthly subscription · 1 month · Auto-renewing` / `Annual subscription · 12 months · Auto-renewing` and, for yearly, a computed "≈ $X.XX/mo equivalent" using the package's `pricePerMonth` (RC provides `pricePerMonth`/`pricePerMonthString` on yearly products; otherwise derive from `price` / 12).
2. Add an **Apple-compliant disclosure card** rendered directly above the Buy buttons (native only). Copy:
  > **Subscription terms**
  > • Payment is charged to your Apple ID at confirmation of purchase.
  > • Your subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
  > • Your account will be charged for renewal within 24 hours prior to the end of the current period at the selected plan's price.
  > • You can manage your subscription and turn off auto-renew in your Apple ID Account Settings after purchase.
  > • No free trial is offered; any unused portion of a free trial, if offered, is forfeited when purchasing a subscription.
  > [Privacy Policy](…) · [Terms of Use](…)
3. Keep existing footer Privacy/Terms links but the disclosure card above is the in-flow source of truth.
4. Add the subscription title + duration **into the confirm CTA tooltip / sub-label** so it is visible the moment the user taps Upgrade (defensive).

### Step 2 — Camera permission flow (Guideline 5.1.1)

1. New component `src/components/CameraPermissionExplainer.tsx` — a small modal/sheet with copy:
  > **Camera access**
  > Camera access lets you scan barcodes and snap meals to log macros instantly.
  > [Not now] [Continue]
2. Modify `BarcodeScanner.tsx`:
  - On first tap of "Scan Barcode": show explainer sheet → on Continue, call `getUserMedia` once.
  - **Remove** the auto `openAppSettings()` call on first denial. On denial, just `toast("You can enable camera later in Settings if you'd like to scan.")` and close — no redirect, no persuasive copy.
  - Track denial in `localStorage` (`camera-denied-once`). On a **subsequent** tap of a camera-only action (Scan Barcode), show a neutral re-entry modal:
    > Camera access is currently off. You can continue without it, or enable it in Settings.
    > [Not now] [Open Settings]
  - Only the re-entry modal may call `openAppSettings()`, only via the explicit "Open Settings" button.
3. Apply the same explainer pattern wrapper to `PhotoRecognition.tsx` before opening the file picker (defensive consistency).
4. Update copy in `ios/App/App/Info.plist` `NSCameraUsageDescription` to match the explainer's purpose string.
5. Replace `localStorage` tracking with permission-state checking or in-app state that does not depend on browser storage.

### Step 3 — Account deletion

**Backend**

1. New edge function `supabase/functions/delete-account/index.ts`:
  - Verify JWT, get `user.id`.
  - Best-effort delete user-owned rows: `profiles`, `user_roles`, `community_recipes`, `recipe_likes`, `progress_entries`, `progress_goals`, `user_attributes`, `device_tokens`, push subscription rows, meal plan rows, favorites — wrap each in try/catch so a missing table doesn't abort.
  - If the user signed in with Apple, look up the stored Apple `refresh_token` (stored in `auth.identities.identity_data`) and POST to `https://appleid.apple.com/auth/revoke` with a client secret JWT (ES256 signed with Apple private key). Requires new secrets: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_BUNDLE_ID` (`com.mi4labs.carnivorex`), `APPLE_PRIVATE_KEY` (.p8 contents). Skip silently if secrets unset, but log a warning.
  - Finally call `supabaseAdmin.auth.admin.deleteUser(user.id)`.
  - Return `{ ok: true }`. Function block in `supabase/config.toml` with `verify_jwt = true`.
2. Add the four Apple secrets via `add_secret` (only required to fully revoke SiwA — without them deletion still completes inside our DB / auth tables; we will note this gap to the user before they submit). 
3. Treat Sign in with Apple revocation as a required implementation item, not a silent fallback

**Frontend** — `src/pages/Profile.tsx` Settings tab

1. New section "Account" with a red-tinted "Delete Account" row.
2. Tapping it opens a confirmation modal:
  - Headline: "Delete your account?"
  - Body explaining permanence (data removed, active subscriptions must still be cancelled in Apple ID Settings).
  - Required text input: user must type `DELETE` to enable the destructive button.
  - Buttons: `Cancel` / `Delete forever`.
3. On confirm: call `supabase.functions.invoke("delete-account")`, on success → show success screen "Your account has been deleted." with a single "OK" button that signs out and routes to `/`.
4. Mirror copy in `src/i18n/en.json` + `src/i18n/fr.json`.

---

## Files changed

- `src/pages/Pricing.tsx` — disclosure card, plan-row subtitles, per-month equivalent
- `src/components/CameraPermissionExplainer.tsx` (new)
- `src/components/progress/BarcodeScanner.tsx` — remove auto-settings redirect, add explainer + re-entry modal, denial flag
- `src/components/progress/PhotoRecognition.tsx` — wrap with explainer
- `ios/App/App/Info.plist` — refine `NSCameraUsageDescription`
- `supabase/functions/delete-account/index.ts` (new)
- `supabase/config.toml` — register `delete-account` with `verify_jwt = true`
- `src/pages/Profile.tsx` — Account section + Delete Account modal + success state
- `src/i18n/en.json`, `src/i18n/fr.json` — new strings

## Required secrets (Apple token revocation, Step 3 only)

- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_BUNDLE_ID` (set to `com.mi4labs.carnivorex`)
- `APPLE_PRIVATE_KEY` (contents of the `.p8` from Apple Developer → Keys, with `Sign In with Apple` enabled)

If you do not have these yet, the deletion flow will still ship and pass review for our DB-side data; SiwA revocation will be best-effort once the secrets are added.

## Recommended priority order for fastest resubmission

1. **Camera fix** (Step 2) — smallest diff, highest rejection-risk if missed.
2. **Account deletion** (Step 3) — required UI + backend; can ship without Apple secrets and add SiwA revocation immediately after.
3. **Paywall disclosures** (Step 1) — content-heavy but mechanical.

After approval of this plan I'll implement in that order and give you the exact terminal steps to build, install on device, and verify each fix with screenshots before resubmitting.