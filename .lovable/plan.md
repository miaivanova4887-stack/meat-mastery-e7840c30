

## Refine Onboarding: Premium Sans-Serif Typography + Warmer Styling

Roll back the clinical Performance Clinic hardness while keeping its structural improvements (cleaner grouping, segmented dots, better rhythm).

### What changes

**1. `src/pages/Onboarding.tsx` — Typography & card warmth**

- **Page title** (line 429): Replace `text-[22px] font-bold uppercase tracking-[0.04em]` with `text-[26px] font-extrabold tracking-[-0.02em] leading-[1.15]` — large, confident, sentence-case sans-serif. No uppercase, no condensed. Matches the rest of the app.
- **Subtitle** (line 432): Bump to `text-[13px]` with `tracking-normal` instead of `tracking-wide`. Warmer, more readable.
- **Option cards**: Increase row height from `h-[44px]` to `h-[52px]`. Add `rounded-xl` to the container (from `rounded-lg`). This restores breathing room without losing the grouped structure.
- **Option label text**: Bump from `text-[13px]` to `text-[14px]`. Description text from `text-[10.5px]` to `text-[11px]`.
- **Selected state**: Replace hard solid amber fill with a warmer treatment — `bg-primary/10 border-l-2 border-l-primary` instead of full `onboarding-segment-selected`. Text stays `text-foreground` (not inverted). This feels premium without the high-contrast clinical inversion.
- **Category headers** (health targets, line 525): Keep uppercase small-caps style but soften — `text-[11px] font-semibold tracking-[0.08em]` instead of `font-bold tracking-[0.12em]`. Keep the accent rule but make it `bg-primary/20` and `w-6`.
- **Input field labels**: Same softening — `text-[11px] font-semibold tracking-[0.06em]`.
- **Continue button**: Sentence-case instead of uppercase. `text-[14px] font-semibold tracking-normal rounded-xl h-[50px]`.
- **Step counter**: Keep dots but soften — active dots `w-2.5 h-2.5`, connector lines `w-3`.
- **"Skip for now"**: `text-[11px]` with normal tracking instead of ultra-wide uppercase.

**2. `src/index.css` — Updated utility classes**

- Replace `.onboarding-segment-selected` with a warm tint: `background: hsl(var(--primary) / 0.08); border-left: 2.5px solid hsl(var(--primary));`
- `.onboarding-segment-idle`: keep `background: hsl(var(--card))` but add subtle hover warmth.
- `.onboarding-check-active`: keep as-is (solid primary circle with check).
- Keep `.font-editorial` class definition (other parts of app may use it) but it won't be used in onboarding.

### What stays the same
- Segmented dot progress indicator (good improvement, keeping it)
- Grouped category containers with divide-y (cleaner than individual floating cards)
- Health target category organization
- All onboarding logic, data flow, step order
- Color palette, tailwind config

### What this achieves
- Title feels like the rest of the app: bold, modern sans-serif, not editorial or clinical
- Cards have warmth and breathing room, not dense utility rows
- Selected state is refined (warm tint + accent border) not aggressive (solid fill inversion)
- Overall feel: premium wellness product, consistent with existing app pages

