

## Fix Missing "Terms of Service" in CMS Content Tab

### Root cause
The `PAGE_NAMES` dictionary in `CmsContentEditor.tsx` doesn't include `privacy` or `terms`, so these pages only appear if search matches them — and without human-readable labels. Privacy happens to show because of existing DB rows with matching fields, but terms is effectively invisible.

### Change 1 — Add `privacy` and `terms` to `PAGE_NAMES` (line 23-48 of `CmsContentEditor.tsx`)

Add two entries to the `PAGE_NAMES` object:
```
privacy: "Privacy Policy",
terms: "Terms of Service",
```

Also add `main` to `SECTION_NAMES` if not already present (it is not — line 50-74):
```
main: "Main",
```

### Change 2 — Insert missing `content_blocks` rows for terms

The DB already has `terms|main|body` for en/fr but is missing `title` and `last_updated`. Run a migration:

```sql
INSERT INTO content_blocks (page, section, key, type, locale, value)
VALUES
  ('terms', 'main', 'title', 'text', 'en', 'Terms of Service'),
  ('terms', 'main', 'title', 'text', 'fr', 'Conditions d''utilisation'),
  ('terms', 'main', 'last_updated', 'text', 'en', 'Last updated: March 2026'),
  ('terms', 'main', 'last_updated', 'text', 'fr', 'Dernière mise à jour : mars 2026')
ON CONFLICT DO NOTHING;
```

(The `body` rows already exist — skip those.)

### Files modified
- `src/components/cms/CmsContentEditor.tsx` — add `privacy` and `terms` to `PAGE_NAMES`, add `main` to `SECTION_NAMES`
- New migration SQL — insert 4 missing content_blocks rows

