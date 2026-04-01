

## Add Privacy Policy & Terms of Service Footer to Home Page

### Change 1 — Footer in `src/pages/Index.tsx`

Add a centered footer below the "Update preferences" button (before the Drawer), inside the `px-4` content div:

```tsx
<div className="text-center pb-4 pt-2">
  <span className="text-xs text-muted-foreground">
    <Link to="/privacy" className="hover:underline">{t("home.footer_legal.privacy_label")}</Link>
    <span className="mx-2">·</span>
    <Link to="/terms" className="hover:underline">{t("home.footer_legal.terms_label")}</Link>
  </span>
</div>
```

Add `Link` to the existing `react-router-dom` import.

### Change 2 — Seed `content_blocks` via migration

Run a database migration inserting 4 rows (with `ON CONFLICT DO NOTHING` if a unique constraint exists, otherwise guarded by `NOT EXISTS`):

| page | section | key | locale | type | value |
|------|---------|-----|--------|------|-------|
| home | footer_legal | privacy_label | en | text | Privacy Policy |
| home | footer_legal | privacy_label | fr | text | Politique de confidentialité |
| home | footer_legal | terms_label | en | text | Terms of Service |
| home | footer_legal | terms_label | fr | text | Conditions d'utilisation |

### Change 3 — Register in CMS Content tab

In `src/components/cms/CmsContentEditor.tsx`:

1. Add `"footer_legal": "Footer / Legal"` to `SECTION_NAMES` dict
2. No other CMS changes needed — the existing content editor auto-discovers keys from `content_blocks` and renders them with EN/FR side-by-side inputs. The seed data is sufficient for the section to appear under Home.

### Files modified
- `src/pages/Index.tsx` — add footer with i18n links
- `src/components/cms/CmsContentEditor.tsx` — add section label
- New migration SQL — seed 4 content_blocks rows

