# Remove the empty legacy consent pop-up

## What you're seeing

The card with an X and an orange **I Accept** button and no text on Profile is the legacy `ConsentBanner`. It pulls its wording from CMS content (`content_blocks`, page `consent`). In this remixed project that content was never seeded — a query returns zero rows — so the banner renders with an empty body and only the button, exactly as in your screenshot. It appears on **Profile** and **Progress** for any signed-in user who hasn't accepted or dismissed it.

## Is it needed?

No. Onboarding already includes the mandatory Wellness Disclaimer step, which records `wellness_disclaimer_consented`, a timestamp, and a version on the profile. The banner is a duplicate of that consent from before onboarding enforced it.

## The fix

Remove the legacy banner entirely:

- Delete `src/components/ConsentBanner.tsx`.
- Remove its import and render from `src/pages/Profile.tsx`.
- Remove its import and render from `src/pages/Progress.tsx`.

No database or auth changes. Existing `consent_given` values on profiles stay untouched; onboarding's wellness consent remains the single source of truth.

## After the change

Web/preview shows it immediately. Your installed debug APK bundles the web assets, so the banner disappears there only after a rebuild — I'll give you the line-by-line rebuild commands once this is applied.
