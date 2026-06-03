# Add back navigation + remove dead ends

## Problem

`LegalPage` (Privacy, Terms, Wellness Disclaimer) and `CmsPageView` render no back control. Users opening them from Profile, Pricing ("Choose your plan"), the Consent Banner, or any CMS deep link have no way back except the bottom nav, which loses their previous context.

A sweep of `src/pages` against `ArrowLeft|navigate(-1)|BackButton` found these candidates without back nav:
- `LegalPage.tsx` — confirmed dead end (user request).
- `CmsPageView.tsx` — dead end for any `/p/:slug` route.
- `NotFound.tsx` — has a Home link but no back option.
- `Admin.tsx`, `CmsEditor.tsx`, `Index.tsx`, `Onboarding.tsx`, `AuthCallback.tsx` — intentional entry/tabbed surfaces, not dead ends. No change.

## Changes

### 1. `src/pages/LegalPage.tsx`
Add a sticky top-left back button matching other inner pages (e.g. `RecipeCoach`, `Guide`):
- `ArrowLeft` icon button inside a header row above the `<h1>`.
- `onClick`: `navigate(-1)` when `window.history.length > 1`, else `navigate("/profile")` as a safe fallback so deep-link entries (push notification, shared link) still go somewhere sensible.
- Respect `safe-area-inset-top`; keep existing padding token.
- aria-label localized via existing `common.back` key (already in `en.json` / `fr.json`; add if missing).

### 2. `src/pages/CmsPageView.tsx`
Same back-button pattern, layered above the `CmsLayoutDocument`. Same fallback rule (`/` when no history). Also turn the "Page not found" state into a small centered card with a back button + Home link so the slug 404 isn't a dead end.

### 3. `src/pages/NotFound.tsx`
Add a secondary "Go back" button next to the existing "Return to Home" link using `navigate(-1)` with the same history-length guard.

### 4. i18n
Ensure `common.back` exists in both `src/i18n/en.json` ("Back") and `src/i18n/fr.json` ("Retour"). Add only if missing — no other key churn.

## Out of scope
- No visual redesign of legal copy, Profile, or Pricing.
- No route changes, no router restructuring.
- No changes to onboarding/auth flows or admin shells.
- No edits to CMS content, business logic, or backend.

## Verification
- From Profile → Privacy / Terms / Wellness Disclaimer: back returns to Profile, scroll position preserved by browser history.
- From Pricing footer links (lines 303/310, 504/511, 522/529): back returns to Pricing.
- From Consent Banner → Privacy: back returns to the originating screen.
- Direct deep link to `/privacy` (no history): back button routes to `/profile` fallback, not a blank page.
- `/p/:slug` CMS page: back returns to referrer; unknown slug shows recoverable 404.
- `/some-bad-url`: NotFound shows both "Go back" and "Return to Home".
