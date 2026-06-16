## Problem

In the screen recording, after choosing a Google account the app shows the auth callback screen with an orange debug chip:

```
AUTH_FLOW_BUILD=v11-20260526-proof-path
```

It appears on both the "Activating your account…" and "Verified! Redirecting…" states, then the user lands on Home signed in. The sign-in flow works correctly — the only defect is this developer-only proof banner leaking into the real user experience. The code itself labels it a `TEMPORARY PROOF BANNER` (`src/pages/AuthCallback.tsx`).

## Fix

Remove the user-visible debug banner from the sign-in/verification callback screen so users only see the clean CarnivoreX 🥩 + status text. Keep the underlying diagnostic logging (used for debugging the OAuth deep-link flow) intact — only the on-screen chip is removed.

### Steps

1. **`src/pages/AuthCallback.tsx`** — Delete the proof-banner block (the `AUTH_FLOW_BUILD={AUTH_FLOW_BUILD}` chip and its comment) from the render output. The screen then starts directly with the app icon and "Activating your account…" / "Verified! Redirecting…" text.

2. Leave the `AUTH_FLOW_BUILD` constant and the `logAuthDiag(...)` proof logging in place — they are console-only and useful for future native-build verification (per the project's evidence-first build practice). No behavioral change to the actual sign-in logic.

3. **Verify** in the preview that the `/auth/callback` screen no longer renders the orange chip and the sign-in success toast + redirect still fire.

### Out of scope (separate, config-only)

The Google "Choose an account → to continue to `…supabase.co`" wording is controlled by the OAuth consent screen / auth domain configuration, not app code. Removing it would require a custom auth domain setup. I can outline that separately if you want it addressed, but it is not part of this code fix.
