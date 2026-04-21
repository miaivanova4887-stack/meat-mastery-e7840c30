

## Refactor Disclaimer into the legal accordion

### Change
Replace the standalone Disclaimer card in `src/pages/Index.tsx` with a third item inside the existing legal accordion, matching Privacy Policy and Terms of Service exactly.

### Edits in `src/pages/Index.tsx`

**1. Remove the standalone Disclaimer card** (lines 238–246) — the entire `<div className="pt-4 pb-2 flex items-start gap-2.5">…</div>` block.

**2. Update the accordion** (lines 248–269):
- Change the existing `terms` item from `border-b-0` to `border-b border-border/30` so it has a divider above the new Disclaimer item.
- Add a third `AccordionItem value="disclaimer"` with `border-b-0`, using the same trigger and content classes as the other two items.

**3. Update the existing `lucide-react` import** (line 8) — remove `ShieldCheck` since it is no longer used.

### New accordion markup
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
  <AccordionItem value="terms" className="border-b border-border/30">
    <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
      {t("home.footer_legal.terms_label")}
    </AccordionTrigger>
    <AccordionContent>
      <div className="max-h-64 overflow-y-auto text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-line">
        {t("terms.main.body")}
      </div>
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="disclaimer" className="border-b-0">
    <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
      Disclaimer
    </AccordionTrigger>
    <AccordionContent>
      <div className="text-xs text-muted-foreground/80 leading-relaxed">
        CarnivoreX is a wellness tracking tool, not a medical service. Nothing in this app constitutes medical advice — consult your physician before making any dietary changes.
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Result
- Disclaimer is the third row in the same accordion, identical row height, typography, chevron, padding, and divider styling as Privacy/Terms.
- Collapsed by default; expands inline.
- Body text uses the same `text-xs text-muted-foreground/80 leading-relaxed` styling as Privacy and Terms.
- Standalone card is fully removed.
- Light/dark mode and rest of footer unchanged.

