

## Performance Clinic Onboarding Redesign

Replace the current Editorial Luxury direction with a clinical, sports-science premium aesthetic.

### Key Visual Changes

**Typography**: Replace serif `font-editorial` headers with bold condensed uppercase Inter. Step titles become `text-[22px] font-bold uppercase tracking-[0.04em]` in sans-serif. Subtitles stay light but tighter.

**Progress bar**: Replace continuous track with **segmented step dots** — small circles for each step, filled/active with primary color, connected by thin lines.

**Category headers (health targets step)**: Remove rounded medallion icons. Use bold condensed uppercase labels with a thin 2px primary accent rule beneath — no icon circles, just the label and underline.

**Option cards (all steps)**: Replace individual floating rounded cards with **segmented control blocks** — all options in a category grouped into one bordered container with internal hairline dividers. Tight 44px row height. No emoji medallions — emoji rendered inline at 14px before label text. Sharp `rounded-lg` corners.

**Selected state**: Replace warm glow/gradient with **solid amber fill** (`bg-primary text-primary-foreground`). Crisp, decisive, high-contrast. No shadows or glows on selection.

**Health target pills (2-item categories)**: Same segmented-control treatment — grouped in a single bordered block with divider, not separate floating pills.

**Spacing**: Tighter gaps — `space-y-0` within segmented blocks, `gap-5` between category sections (down from `space-y-6`). Overall feel is dense and clinical.

**Motion**: Faster transitions (150ms), no staggered reveals. Sharp and immediate.

### Files to Change

1. **`src/pages/Onboarding.tsx`**
   - Replace header typography classes: remove `font-editorial`, use `font-bold uppercase tracking-[0.04em]` on Inter
   - Replace progress bar with segmented dot indicator
   - Wrap each step's options in a single bordered container with `divide-y` instead of individual cards
   - Remove emoji medallion wrapper — render emoji inline before label
   - Remove `onboarding-card-selected/idle` classes, use conditional `bg-primary text-primary-foreground` directly
   - Health targets: unify pill and tile treatments into one segmented-control style per category
   - Category headers: remove icon circle, use uppercase label + thin accent rule only
   - Tighten all spacing values

2. **`src/index.css`**
   - Remove or replace `.onboarding-card-selected`, `.onboarding-card-idle`, `.onboarding-pill-selected`, `.onboarding-pill-idle`, `.onboarding-medallion*` classes
   - Add new `.onboarding-segment-selected` (solid primary fill) and `.onboarding-segment-idle` (card bg) utilities
   - Remove `onb-stagger` keyframe (no staggered animations)
   - Keep `slideDown` keyframe

### No Changes To
- Onboarding logic, step order, data persistence, navigation
- Tailwind config or color palette
- Any other pages or components

