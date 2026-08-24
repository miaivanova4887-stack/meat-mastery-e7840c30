# Fix: Onboarding Step 4 renders an empty screen

## What's happening

Step 4 ("What's your target?") has no hardcoded options. Every category heading and every target label is pulled from the backend `content_blocks` table (`page = onboarding`, `section = health_targets`). The screen only renders its content when at least one of those rows loads.

Verified in this project's database:

- `content_blocks` filtered to `page='onboarding'`, `section='health_targets'` returns **0 rows**
- `content_blocks` is **entirely empty** (no rows for any page/section/locale)
- Read access itself is fine (a public read policy exists), so this is missing data, not a permissions problem

Those label rows were authored through the CMS in the original project and were never part of a migration, so the remixed backend started with an empty table. Result: the header and progress bar draw, the target list renders nothing, and the Continue button sits on a blank page.

Note: other CMS-driven copy across the app is also unseeded, but the visible blank screen is step 4 because it has no built-in fallback at all.

## The fix

Two parts, so the screen can never blank again:

1. **Built-in defaults (primary fix).** Add the English and French category/target labels directly in the onboarding code as the default label set. Backend `content_blocks` rows, when present, override them. Step 4 then always renders, even with an empty or unreachable database.
2. **Seed the CMS rows.** Insert the same EN + FR labels into `content_blocks` (`page='onboarding'`, `section='health_targets'`) via a migration using an idempotent upsert, so the copy stays editable in the CMS and matches the original project.

Labels covered: 6 category headings (metabolic, inflammation, gut, mental, energy, hormonal), the 20 target keys, and the step subtitle.

## Technical details

- `src/pages/Onboarding.tsx`: introduce a `DEFAULT_HEALTH_TARGET_LABELS` map keyed by locale (`en`, `fr`), initialize `healthTargetLabels` state from it based on `i18n.language`, and merge fetched rows on top instead of replacing. The `healthTargetLabels.size > 0` render guard then passes on first paint.
- New migration: `INSERT ... ON CONFLICT DO NOTHING` into `public.content_blocks` for both locales. No schema, policy, or grant changes needed — the table already exists with a public read policy.
- No changes to Android/native config; a web rebuild + `cap sync` picks this up in the next debug APK.

## Verification

- Preview: step through onboarding to step 4 and confirm all six categories and their chips/tiles render and toggle.
- Query `content_blocks` to confirm the seeded EN/FR row counts.
- Then rebuild the debug APK and re-run onboarding on the device.
