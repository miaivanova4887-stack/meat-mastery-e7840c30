

## Replace Footer Links with Inline Accordion Panels

### Overview
Replace the two footer `<Link>` elements with a Radix Accordion that expands policy text inline. Content loads from `content_blocks` via the existing i18n override system.

### Change 1 — Update `src/pages/Index.tsx`

Replace lines 213-219 (the footer `<div>` with Links) with:

```tsx
<Accordion type="single" collapsible className="pb-6 pt-2 px-0">
  <AccordionItem value="privacy" className="border-b border-border/30">
    <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
      {t("home.footer_legal.privacy_label")}
    </AccordionTrigger>
    <AccordionContent>
      <div className="max-h-64 overflow-y-auto text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
        {t("privacy.main.body")}
      </div>
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="terms" className="border-b-0">
    <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
      {t("home.footer_legal.terms_label")}
    </AccordionTrigger>
    <AccordionContent>
      <div className="max-h-64 overflow-y-auto text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
        {t("terms.main.body")}
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

- Import `Accordion, AccordionItem, AccordionTrigger, AccordionContent` from `@/components/ui/accordion`
- Remove `Link` from react-router-dom import (check if used elsewhere first — it is not used elsewhere in this file, so remove it)
- `type="single" collapsible` ensures only one open at a time

### Change 2 — Seed content_blocks for policy body text

Database migration to insert body text rows (with `WHERE NOT EXISTS` guard):

| page | section | key | locale | type | value |
|------|---------|-----|--------|------|-------|
| privacy | main | body | en | text | *(Privacy policy placeholder text)* |
| privacy | main | body | fr | text | *(French privacy policy placeholder)* |
| terms | main | body | en | text | *(Terms of service placeholder text)* |
| terms | main | body | fr | text | *(French terms placeholder)* |

### Change 3 — Add i18n fallback keys

Add `privacy.main.body` and `terms.main.body` keys to `src/i18n/en.json` and `src/i18n/fr.json` as fallback text before content_blocks load.

### Files modified
- `src/pages/Index.tsx` — replace links with accordion
- `src/i18n/en.json` — add fallback body text
- `src/i18n/fr.json` — add fallback body text
- New migration SQL — seed 4 content_blocks rows

