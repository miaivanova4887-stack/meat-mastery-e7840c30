## Goal

Guarantee `profiles.locale` is always one of the supported values (`en` | `fr`) — never a regional variant like `fr-CA` or `en-US` — so server-side push sends hit the seeded template directly, without relying on fallback.

## Current state

- `supabase/functions/_shared/i18nStep.ts` already exports `normalizeLocale()` (maps `fr*` → `fr`, everything else → `en`). `push-scheduler` uses it at send time.
- `src/lib/pushFcm.ts` normalizes before writing on push consent.
- `src/components/LanguageSwitcher.tsx` writes the toggle value (`"en"` or `"fr"`), which is already safe.
- **Gap:** there is no single client-side helper, no DB-level guarantee, and any future write path (e.g. signup, profile edit, migration backfill) could insert a raw `i18n.language` value like `fr-CA`.

## Changes

### 1. Client helper (single source of truth)

Add `src/lib/locale.ts`:

```ts
export type SupportedLocale = "en" | "fr";
export function normalizeLocale(input?: string | null): SupportedLocale {
  return (input ?? "").toLowerCase().startsWith("fr") ? "fr" : "en";
}
```

Refactor `src/lib/pushFcm.ts` and `src/components/LanguageSwitcher.tsx` to use this helper instead of inline ternaries. (Server keeps its own copy in `_shared/i18nStep.ts` — Deno can't import from `src/`.)

### 2. DB-level enforcement (defense in depth)

One migration:

- **Backfill** any existing rows: `UPDATE profiles SET locale = CASE WHEN lower(locale) LIKE 'fr%' THEN 'fr' ELSE 'en' END WHERE locale NOT IN ('en','fr');`
- **Normalizing trigger** on `profiles` (BEFORE INSERT OR UPDATE OF locale): rewrites `NEW.locale` to `'fr'` if it starts with `fr` (case-insensitive), else `'en'`. Using a trigger (not a CHECK constraint) per project memory and so old clients that send `fr-CA` silently get coerced instead of erroring.

### 3. Server send path

No change needed — `push-scheduler` already calls `normalizeLocale()` on the DB value. The trigger makes that call a no-op in steady state, which is the goal.

In the DB trigger, coerce `NULL` or `''` to `'en'` explicitly before the `fr%` check

## Files

- new: `src/lib/locale.ts`
- edit: `src/lib/pushFcm.ts`, `src/components/LanguageSwitcher.tsx`
- new migration: trigger + backfill on `profiles.locale`

## Out of scope

- CMS `content_blocks.locale` (already constrained to seeded `en`/`fr` rows by the editor).
- Adding new supported locales — current product is EN/FR only.