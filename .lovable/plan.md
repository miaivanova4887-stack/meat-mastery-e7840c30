## Problem

After successful build, Health Connect is wired up correctly — **steps** and **calories** populate, but:

1. **Weight is empty** on both Home and Progress.
2. **Unit mismatch**: Home shows `lbs`, Progress shows `kg`, but Samsung Health stores the value in **kg**. Progress is actually displaying the lbs-converted number under a hardcoded `kg` label — so the displayed value is wrong, not just the label. Units need to show as entered on the user device

## Root Causes

### A) Unit mismatch / wrong number on Progress

- `HealthConnectContext` reads weight in kg (correct), then converts to lbs if `localStorage["carnivore-unit-system"]` is `"imperial"` (the default). It exposes the *converted* number plus a `weightUnit` field.
- `HealthDashboard` (Home) correctly renders `{healthData.weightUnit}`.
- `Progress.tsx` (line 142) hardcodes the label as `"kg"` while showing the already-converted lbs value → **wrong number under a wrong label**.
- Default unit is `imperial`, so on a fresh install Android/Samsung users see lbs even though their data is metric.

### B) Weight empty

- Samsung Health does **not** write WeightRecord to Health Connect unless the user manually toggles "Body composition → Weight" sharing in Samsung Health → Settings → Health Connect. Most users miss this. --> this is not the case, data entered. Update on function - once user updated weight on Samsung helth - it fetches to our app. Weight data need not to be updated every time, see if there's a last entered fetch possibility. 
- The Kotlin `readWeight` does no Samsung-aware fallback or diagnostic logging — when no record exists we silently return `[]` with no signal to the user about why.
- The 30-day window is fine, but a bug-resistant fix is 90 days plus a clear empty-state message.

## Plan

### 1. Fix Progress page unit label (`src/pages/Progress.tsx`)

Replace the hardcoded `"kg"` label with `{healthData.weightUnit}` so Progress matches Home and is internally consistent.

### 2. Default Health Connect users to kg (no app-wide change)

The shopping bag's `unitSystem` toggle (imperial/metric) should NOT govern body weight from Samsung Health — Samsung stores in kg and most Android users expect kg.

Change `HealthConnectContext` to:

- **Always emit weight in kg** (no conversion). 
- Set `weightUnit` to `"kg"` unconditionally.

Rationale: the cooking-units toggle is for ingredients (oz vs g), not body weight. This eliminates the conversion confusion entirely and matches what the user sees in Samsung Health. (The Profile/onboarding has its own height/weight unit preference for manual entry; that flow is unchanged.)

### 3. Make weight read more resilient (`HealthConnectPlugin.kt`)

In `readWeight`:

- Widen window to **90 days** on the native side as a safety net.
- Add `Log.i` diagnostics: number of records found + their dataOrigin packages, so future debugging is trivial via `adb logcat`.
- No behavior change when records exist.

### 4. Surface a helpful empty-state for weight

In the dashboard tiles, when `weight === 0` and the user is connected, show `"—"` (already done) and add a one-time toast / inline hint on the **Progress** page: *"To see weight here, open Samsung Health → Settings → Health Connect → enable Weight."*

Implementation: add a small dismissible banner under the Health Connect grid in `Progress.tsx`, only visible when `isConnected && healthData.weight === 0`. Persist dismissal in localStorage so it doesn't nag.

### 5. After deploy

User runs:

```
git pull
rm -rf android/.gradle android/app/build
bash scripts/build-android-fresh.sh
```

Reinstall the APK. Open the app — weight should now display in **kg** on both Home and Progress. If it's still empty, the new banner will guide the user to enable weight sharing in Samsung Health.

## Files Changed

- `src/contexts/HealthConnectContext.tsx` — always kg, no conversion
- `src/pages/Progress.tsx` — use `healthData.weightUnit`; add empty-state banner
- `android/app/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt` — 90-day window + diagnostic logging in `readWeight`