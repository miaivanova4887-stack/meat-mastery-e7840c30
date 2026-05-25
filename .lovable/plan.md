# Fix "Recommended for you" still appearing on Home

## Root cause

The i18n JSON files are already correct (`"Recommended"` / `"Recommandé"`), and `src/pages/Index.tsx:205` already renders the `home.recommendedForYou` key. The label still appears as "Recommended for you" because the **CMS content overrides table (`content_blocks`)** stores values that override the i18n JSON at runtime:

```
home | general | recommendedForYou | en | Recommended for you
home | general | recommendedForYou | fr | Recommandé pour vous
```

The CMS hook (`useContentOverrides`) hydrates these into the i18n store on load, replacing the JSON values. So no APK rebuild or code change to `Index.tsx` will ever fix this — the DB row must be updated.

## Change

One SQL migration that updates the two existing rows:

```sql
UPDATE public.content_blocks
SET value = 'Recommended', updated_at = now()
WHERE page = 'home' AND section = 'general'
  AND key = 'recommendedForYou' AND locale = 'en';

UPDATE public.content_blocks
SET value = 'Recommandé', updated_at = now()
WHERE page = 'home' AND section = 'general'
  AND key = 'recommendedForYou' AND locale = 'fr';
```

## Verification

- Reload preview (no rebuild needed) — EN renders "Recommended", FR renders "Recommandé".
- Confirm via `SELECT … FROM content_blocks WHERE key = 'recommendedForYou'`.

## Files changed

- New migration under `supabase/migrations/` (SQL only).
- No component or i18n JSON edits needed — those are already correct from the previous change.

## Answers to the questions asked

- Component: `src/pages/Index.tsx` (the recommendation card header `<span>` at line 205).
- i18n key: `home.recommendedForYou`.
- EN value: `Recommended`. FR value: `Recommandé`.
- The previous "false done" wasn't actually false in code — it just missed the CMS override layer that wins over JSON.

Approved. Proceed with the SQL migration only.

Please update the existing content_blocks rows for:

page = home

section = general

key = recommendedForYou

locales en and fr

Keep the app code unchanged. After running the migration, confirm:

the exact migration filename,

the SELECT result for both locales,

that Preview shows Recommended in EN and Recommandé in FR without rebuilding.