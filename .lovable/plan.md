

## Fix build errors + add homepage Disclaimer footer block

### Issue 1 — Edge function import error
`supabase/functions/_shared/requireTier.ts` uses `npm:@supabase/supabase-js@2.57.2`, but every other edge function in the project uses `https://esm.sh/@supabase/supabase-js@2`. The Deno runtime can't resolve the npm specifier in this project.

**Fix** — change line 23 of `requireTier.ts`:
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```
Update the comment on line 20–21 to match.

### Issue 2 — TS error in `SubscriptionContext.test.ts` (line 67)
Because `FEATURES` is `as const` and no entry has `required: "free"`, TypeScript narrows `required` to `"pro" | "elite"`, so `required === "free"` is flagged as a no-overlap comparison.

**Fix** — line 67: replace
```ts
expect(hasAccess("free", required)).toBe(required === "free");
```
with
```ts
expect(hasAccess("free", required)).toBe(false);
```
This preserves test intent (no FEATURE entry is free-tier, so a free user must always be denied) and removes the dead comparison.

### Issue 3 — TS error in `parseHealthTranscript.ts` (line 595)
The `pairs` array is typed `Array<[RegExp, string]>`, but line 595 supplies a replacer function for `String.replace`. TS rejects the function as a `string`.

**Fix** — broaden the tuple's second slot to accept either form (line 521):
```ts
const pairs: Array<[RegExp, string | ((substring: string, ...args: string[]) => string)]> = [
```
The existing `for…of` loop on line 625 already works with either overload of `String.prototype.replace`, but to keep TS happy the call site needs a tiny cast:
```ts
for (const [re, rep] of pairs) s = s.replace(re, rep as string);
```
(Runtime is unaffected; `String.replace` accepts both.)

### Feature — Homepage Disclaimer footer block

**Location**: `src/pages/Index.tsx`, inserted just **above** the existing legal `<Accordion>` (around line 238), so it sits inside the same footer wrapper as Privacy/Terms.

**Markup** (matches surrounding footer typography — `text-xs`, `text-muted-foreground`, no heavy card chrome):
```tsx
<div className="pt-4 pb-2 flex items-start gap-2.5">
  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
  <div className="space-y-1">
    <p className="text-xs font-semibold text-muted-foreground">Disclaimer</p>
    <p className="text-[11px] leading-relaxed text-muted-foreground/80">
      CarnivoreX is a wellness tracking tool, not a medical service. Nothing in this app constitutes medical advice — consult your physician before making any dietary changes.
    </p>
  </div>
</div>
```
Add `ShieldCheck` to the existing `lucide-react` import on line 8.

**Why this placement & style**
- Reuses the existing footer container, so no duplicate legal section.
- Same `text-xs / text-muted-foreground` palette as Privacy/Terms — subtle but readable.
- Small `ShieldCheck` icon gives a visual cue without competing with the brand.
- Pure flex layout — naturally responsive on 390px mobile and desktop.
- Copy is verbatim from the request.

### Files changed
1. `supabase/functions/_shared/requireTier.ts` — swap supabase-js import specifier
2. `src/contexts/SubscriptionContext.test.ts` — replace impossible comparison with `false`
3. `src/lib/parseHealthTranscript.ts` — widen `pairs` tuple type + small cast at the call site
4. `src/pages/Index.tsx` — add `ShieldCheck` import + disclaimer block above the legal accordion

### What stays the same
- All other edge functions, test cases, and parser behavior
- Footer accordion (Privacy/Terms), reset preferences button, layout
- Light/dark mode styling, responsive behavior

