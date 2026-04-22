

## Make Privacy, Terms & Disclaimer first-class CMS pages

### Goal

Admins edit Privacy Policy, Terms of Service, and Disclaimer from `/cms` (the admin CMS) like any other page. Public routes `/privacy`, `/terms`, `/disclaimer` and the home-page footer accordion all render from the same CMS-managed source.

### Why this is the smallest safe change

The CMS already has a working override pipeline:

```
content_blocks (DB)  →  useContentOverrides  →  i18n resource bundle  →  t("privacy.main.body")
```

Long-form legal text already lives in `src/i18n/en.json` / `fr.json` (`privacy.main.body`, `terms.main.body`). The `/cms` Content tab auto-discovers any key in i18n once the page is registered in `APP_PAGES`. So we don't need a new schema, new RLS, or a new editor — we just need to: register the pages, add the missing public routes, and add a Disclaimer key.

### Changes

**1. Register legal pages in CMS registry — `src/components/cms/cmsPages.ts`**

Append three rows to `APP_PAGES`:

```ts
{ title: "Privacy Policy",   slug: "privacy",    route: "/privacy",    contentKey: "privacy" },
{ title: "Terms of Service", slug: "terms",      route: "/terms",      contentKey: "terms" },
{ title: "Disclaimer",       slug: "disclaimer", route: "/disclaimer", contentKey: "disclaimer" },
```

Result: they appear immediately in the `/cms` → Pages list and Content tab, with EN + FR editable side-by-side, saving to `content_blocks` and overriding i18n at runtime. Admin-only RLS on `content_blocks` is already enforced.

**2. Add a Disclaimer i18n key — `src/i18n/en.json` and `src/i18n/fr.json`**

Add a top-level block (so it's editable as its own CMS page, separate from `guide.disclaimer`):

```json
"disclaimer": {
  "main": {
    "title": "Medical Disclaimer",
    "body": "The content in CarnivoreX is for informational and educational purposes only…"
  }
}
```

(Seed with the existing `guide.disclaimer.content` text in EN and FR.)

**3. Create a single shared legal page component — `src/pages/LegalPage.tsx`**

A minimal page that takes a content namespace and renders title + long-form body using `whitespace-pre-line` (matches the home accordion style). It uses `useTranslation`, so CMS overrides flow in automatically.

```tsx
function LegalPage({ ns }: { ns: "privacy" | "terms" | "disclaimer" }) {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-24 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-4">{t(`${ns}.main.title`)}</h1>
      <div className="text-sm text-muted-foreground/90 leading-relaxed whitespace-pre-line">
        {t(`${ns}.main.body`)}
      </div>
    </main>
  );
}
```

**4. Register public routes — `src/App.tsx`**

Add (before the `*` catch-all):

```tsx
<Route path="/privacy"    element={<LegalPage ns="privacy" />} />
<Route path="/terms"      element={<LegalPage ns="terms" />} />
<Route path="/disclaimer" element={<LegalPage ns="disclaimer" />} />
```

This also fixes the existing dead link in `ConsentBanner.tsx` which navigates to `/privacy`.

**5. Wire footer accordion to the same source — `src/pages/Index.tsx`**

Already uses `t("privacy.main.body")` and `t("terms.main.body")` — no change needed, it inherits CMS overrides automatically. Add a third accordion item for Disclaimer pulling `t("disclaimer.main.body")` so the footer matches the new page.

### How admins will use it

1. Open `/admin` → tap **CMS Editor** (or go directly to `/cms`).
2. **Pages** tab → see `Privacy Policy`, `Terms of Service`, `Disclaimer` listed alongside other app pages, with a working "Preview" button (`/privacy`, `/terms`, `/disclaimer`).
3. **Content** tab → select one of the legal pages → edit `title` and `body` in EN and FR in a multi-line textarea → **Save**. Overrides hot-reload via `reloadContentOverrides()` and emit `languageChanged` so all open tabs update.
4. Public `/privacy`, `/terms`, `/disclaimer` and the home-page footer accordion all reflect the new text.

### Technical notes

- No DB migration needed — `content_blocks` already supports arbitrary `page/section/key` overrides and has admin-only RLS for write operations.
- No new dependency, no schema change, no new editor UI — the existing `CmsContentEditor` already renders `<Textarea>` for multi-line content (see line 4 import).
- `ConsentBanner`'s broken `/privacy` link starts working as a side-effect.
- Body text uses `whitespace-pre-line` so admins can format with blank lines without HTML.
- Disclaimer remains separately editable from `guide.disclaimer.*` (which is the in-app Guide page note). They are intentionally two different surfaces.

### Files touched

- `src/components/cms/cmsPages.ts` (3 lines added)
- `src/i18n/en.json`, `src/i18n/fr.json` (1 block each)
- `src/pages/LegalPage.tsx` (new, ~25 lines)
- `src/App.tsx` (3 routes + 1 import)
- `src/pages/Index.tsx` (1 accordion item added for Disclaimer)

