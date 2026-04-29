## Goal

Stop the anonymous push opt-in sheet from appearing instantly on app launch. Hold it behind a shared shell-level grace timer (60–250s, configurable) and add stricter eligibility checks plus rich diagnostic logging.

## Scope

Only these files change:

- `src/hooks/usePushConsentFallback.ts` — main logic (delay, eligibility, logs)
- `src/components/PushConsentFallbackHost.tsx` — anchor the timer to a single shell-mounted instance and ensure source is `"shell"`
- (No changes to onboarding, Health Connect, campaigns, AuthContext, or `pushFcm.ts`.)

## Behavior changes

### 1. Shared shell-level delay (single source of truth)

Capture `appStartAt = Date.now()` at module load of `usePushConsentFallback.ts` (one timestamp per JS bundle / app launch — survives route changes since the hook module is shared).

Add a configurable grace window:

```ts
const FALLBACK_DELAY_MIN_MS = 60_000;   // 60s floor
const FALLBACK_DELAY_MAX_MS = 250_000;  // 250s ceiling
const FALLBACK_DELAY_MS = 90_000;       // default ~90s
```

Allow override via `localStorage["push-fallback-delay-ms"]` (clamped to [MIN, MAX]) for QA tuning, no UI.

The hook computes `remaining = max(0, FALLBACK_DELAY_MS - (Date.now() - appStartAt))` and schedules a single `setTimeout(remaining)`. Because `appStartAt` is module-scoped, a remount on a new route does NOT restart the clock — the delay is shared regardless of route.

Replace the existing `INITIAL_DELAY_MS = 600` short delay with this longer grace timer.

### 2. Eligibility check (run when the timer fires)

In order, skip with a logged reason if any of these are true:

- not native or platform !== `"android"` → `reason=not-android`
- `sessionStorage["push-prompt-shown"] === "1"` → `reason=already-shown-session`
- **Authenticated branch** (`supabase.auth.getUser()` returns a user):
  - Read `profiles.push_consent` AND `profiles.notification_preferences`.
  - If `push_consent === "granted"` → `reason=consent-granted`
  - If `push_consent === "denied"` → `reason=consent-denied`
  - If `notification_preferences` shows the user already opted into any push category (any of `streaks|recipes|fasting|coaching` is `true`) AND `push_consent === "unset"` → `reason=prefs-indicate-opted-in` (skip; they implicitly want push, native permission will be asked elsewhere — don't pester now).
  - Only open if `push_consent === "unset"` AND no truthy push category in prefs.
- **Anonymous branch** (no signed-in user):
  - Read `getLocalPushConsent()`. If not `"unset"` → skip with reason.
  - Additionally require minimal "user has progressed" signal: `localStorage["carnivore-onboarding-complete-v2"] === "true"` OR `localStorage["carnivore-onboarding-complete"] === "true"`. If neither is set → `reason=anonymous-not-progressed` (skip; they haven't engaged enough yet).
  - Otherwise open.

### 3. Once-per-session + dismissal guard (unchanged)

Still set `sessionStorage["push-prompt-shown"] = "1"` the moment we open the sheet. After dismissal we do not re-open in the same session. (Onboarding-triggered sheet already sets this flag too.)

### 4. Single-host enforcement

Update `PushConsentFallbackHost.tsx` to use a module-level boolean `mounted` so a second mount becomes a no-op (defensive — prevents double timers if anything ever re-mounts the host). The hook already uses a module-shared `appStartAt`, but this is a small extra safety net.

### 5. Logging (logcat-friendly, prefix `[Push] fallback`)

On hook mount log:

- `appStartAt`, `now`, `elapsed`, `delayMs`, `remaining`, `source`

When the timer fires log:

- `native`, `platform`, `alreadyShown`, `userPresent`, `branch`, `consent`, `prefsOptedIn`, `onboardingProgressed`

When opening: `reason=open branch=... consent=...`
When skipping: `reason=<one of above> branch=... details=...`

All logs use `console.info` so they appear in logcat at default verbosity.

## Non-goals

- Do NOT change `Onboarding.tsx`, `AuthContext.tsx`, `pushFcm.ts`, `pushConsentLocal.ts`, route guards, Health Connect, or campaign code.
- Do NOT change the onboarding-triggered push sheet behavior.
- Do NOT request native permissions during the eligibility check (still done only when user taps Enable).

## Acceptance

- Cold launch on Android: no push sheet for at least 60s (default 90s) regardless of route.
- After delay: sheet only opens if Android + session-not-shown + (authenticated→consent unset & no prefs opted-in) OR (anonymous→onboarding-complete flag set & local consent unset).
- Logcat shows `[Push] fallback` lines covering app-start time, elapsed delay, profile presence, consent state, and an explicit open/skip reason.
- No regressions on web, iOS, or the in-onboarding push sheet.

- I would make the shell host the only active prompt source and avoid leaving any page-level fallback hooks in place, unless they are fully disabled. That reduces surprise re-triggers.
- I would keep the default at **90 seconds** and use the 60–250 second range only as a QA override, not as a live user-visible range.
- For anonymous users, the “onboarding complete” requirement is good, but make sure it’s the same versioned key you already migrated to, so it doesn’t regress on older installs.
- The plan says “if `notification_preferences` shows the user already opted into any push category, skip because native permission will be asked elsewhere.” That’s fine only if there is actually another later prompt path. If not, it could accidentally suppress the only chance to ask