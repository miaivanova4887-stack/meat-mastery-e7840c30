

## Redesign Step 4 Health Targets Visual Style

UI-only changes to the health targets rendering block (lines 458-497 in `src/pages/Onboarding.tsx`). No data, state, or save logic changes.

### Changes in `src/pages/Onboarding.tsx`

**1. Replace `CATEGORY_ICONS` with emoji + style config map:**

```typescript
const CATEGORY_STYLES: Record<string, { emoji: string; gradient: string; border: string; glow: string }> = {
  cat_metabolic:     { emoji: "🫀", gradient: "from-red-500/15 to-orange-500/15", border: "border-red-500/30", glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]" },
  cat_inflammation:  { emoji: "🔥", gradient: "from-orange-500/15 to-amber-500/15", border: "border-orange-500/30", glow: "shadow-[0_0_12px_rgba(249,115,22,0.3)]" },
  cat_gut:           { emoji: "🌿", gradient: "from-green-500/15 to-emerald-500/15", border: "border-green-500/30", glow: "shadow-[0_0_12px_rgba(34,197,94,0.3)]" },
  cat_mental:        { emoji: "🧠", gradient: "from-blue-500/15 to-purple-500/15", border: "border-blue-500/30", glow: "shadow-[0_0_12px_rgba(59,130,246,0.3)]" },
  cat_energy:        { emoji: "⚡", gradient: "from-yellow-500/15 to-orange-500/15", border: "border-yellow-500/30", glow: "shadow-[0_0_12px_rgba(234,179,8,0.3)]" },
  cat_hormonal:      { emoji: "⚖️", gradient: "from-purple-500/15 to-pink-500/15", border: "border-purple-500/30", glow: "shadow-[0_0_12px_rgba(168,85,247,0.3)]" },
};
```

**2. Replace category headers** (line 464-466) with gradient accent card rows:

```tsx
<div className={`flex items-center gap-2.5 ${catIdx === 0 ? "mt-6" : "mt-5"} mb-2`}>
  <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${style.gradient} flex items-center justify-center`}>
    <span className="text-[20px]">{style.emoji}</span>
  </div>
  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
    {healthTargetLabels.get(cat.catKey) || cat.catKey}
  </span>
</div>
<div className={`border-b ${style.border} opacity-30 mb-2`} />
```

**3. Replace target card rendering** (lines 468-492) with emoji cards + category-specific selected state:

- Unselected: `bg-card border-border/40` with emoji and foreground text
- Selected: `bg-gradient-to-r ${style.gradient}` at higher opacity, `${style.border}` at 50%, white text, checkmark in category accent
- Active tap: `active:scale-[0.97]` with `transition-all duration-150`
- Checkmark: wrap in a div with `transition-transform duration-100` and `scale-0`/`scale-100`
- Selected cards get the category glow shadow

**4. Remove Lucide icon imports** that are no longer needed: `Heart, Flame, Leaf, Zap, Scale` (keep `Brain` and `Check` as they're used elsewhere). Remove the `CATEGORY_ICONS` constant.

### Single file changed
`src/pages/Onboarding.tsx` — visual rendering of the health targets block only.

