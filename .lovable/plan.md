
# Pin a separate AOS project to the working v1.0.3 build

## Goal

Create an independent Lovable project, **Carnivore Coach AOS**, whose codebase matches the AAB you uploaded to Play Store on **25 May 16:24** (Production release 6, versionName **1.0.3**, versionCode **6**). The current project (`carnivore-coach-pro`) stays exactly as it is — no rollback, no edits — so iOS StoreKit + ongoing work is preserved.

Chat history confirms Android subscriptions have used **RevenueCat → Google Play Billing** since 7 May 2026 (msg #1875, the day the real `goog_…` key replaced the placeholder). Coaching calls remained on Stripe. The 1.0.3 AAB shipped two weeks after that, so the pinned project must keep RC for subscriptions and Stripe for coaching.

## Plan

### Step 1 — Identify the exact chat turn that produced the 1.0.3 AAB
Search the current project's History (top of chat) for the turn dated **on or just before 25 May 2026 16:24** that ran `scripts/build-android-fresh.sh` and produced `app-release.aab` with `versionCode 6` / `versionName "1.0.3"`. That single turn is the "Restore point."

### Step 2 — Remix the project at that restore point
1. In the current project's chat, scroll to the restore point identified in Step 1.
2. Click the **Restore** button on that assistant message — but **do NOT confirm**. Instead, in the project sidebar three-dot menu, choose **Remix** so the remix forks from that historical state, not from `HEAD`.
3. Rename the remix **Carnivore Coach AOS**.
4. Close the current project's tab without confirming the restore. The original `carnivore-coach-pro` project stays untouched.

(If the editor UI only allows remix from `HEAD`, alternative: remix first, then inside the AOS remix open History and click Restore on the same dated turn — that rolls only the AOS copy back.)

### Step 3 — Verify the AOS remix matches v1.0.3
Run the line-by-line shell checks below inside the freshly cloned AOS repo. All five must match.

### Step 4 — Build the AOS AAB locally and compare
Run `scripts/build-android-fresh.sh` in the AOS repo, then diff `versionCode`, `versionName`, and SHA256 against your archived 25 May AAB. Only after byte-level / fingerprint verification do you upload to a Play Internal Testing track.

### Step 5 — Treat AOS as the Android-only stable line
- AOS = only Android releases. Keep RC + Play Billing for subs, Stripe for coaching.
- `carnivore-coach-pro` = web + iOS line; experiments live here.
- When fixes land in either, port across explicitly — never auto-sync.

## Technical details

### Verification commands (Step 3, run in AOS repo root)

```bash
cd ~/Carnivore-Coach-AOS
git pull
grep -n 'versionName' android/app/build.gradle
grep -n 'versionCode' android/app/build.gradle
grep -n 'REVENUECAT_ANDROID_KEY' src/lib/revenuecat.ts
grep -rn 'paywall.enabled\|isRevenueCatAvailable' src/pages/Pricing.tsx src/components/CoachingBooking.tsx src/pages/Coaching.tsx
grep -n 'NATIVE_FCM_ENABLED' src/lib/pushNativeConfig.ts
```

Expected for the pinned 1.0.3 state:
- `versionName "1.0.3"`
- `versionCode 6`
- `REVENUECAT_ANDROID_KEY = "goog_LJgdLQzxkXUPLaORSMbZNpIPLMW"` (real key, not `REPLACE_ME`)
- The `grep -rn` for `paywall.enabled` / `isRevenueCatAvailable` returns **no matches** in those three files (those gates were introduced 5 June and caused the current Pro/Elite "Unavailable" regression)
- `NATIVE_FCM_ENABLED = false`

If any line disagrees, the remix landed on the wrong turn — back out and try the next-older History entry.

### Build + fingerprint (Step 4)

```bash
cd ~/Carnivore-Coach-AOS
bash scripts/build-android-fresh.sh
shasum -a 256 android/app/build/outputs/bundle/release/app-release.aab
unzip -p android/app/build/outputs/bundle/release/app-release.aab BundleConfig.pb > /dev/null && echo "AAB OK"
```

Compare the SHA256 line above against the SHA256 of the archived 25 May AAB. They will not match byte-for-byte (timestamps differ), but `versionCode`/`versionName`/the bundled JS hash inside `base/assets/public/assets/index-*.js` must match.

### Out of scope
- No code edits in either project as part of this plan.
- No Play Console upload until Step 4 fingerprints pass.
- No changes to RevenueCat dashboard, Play Console subscription products, or service-account JSON — those are already wired up and were healthy on 25 May.
