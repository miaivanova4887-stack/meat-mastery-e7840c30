

## Two Design Changes to Onboarding Flow

### Change 1 — Move Goal Weight to Measurements Step (index 2)

Add a `goalWeight` field to the existing measurements step (step index 2, line 82-86):

```typescript
fields: [
  { key: "age", label: "Age", placeholder: "e.g. 30", unit: "years", type: "number" },
  { key: "height", label: "Height", placeholder: "e.g. 175", unit: "cm", type: "number" },
  { key: "weight", label: "Current weight", placeholder: "e.g. 80", unit: "kg", type: "number" },
  { key: "goalWeight", label: "Goal weight", placeholder: "e.g. 72", unit: "kg", type: "number" },
],
```

Remove the `fields` array from Step 4 (index 3) entirely — make it a new step type `"health_targets"` (or keep as `"input"` with empty fields). The `goalWeight` value is already read from `inputValues.goalWeight` at save time (line 282), so no save logic changes needed.

### Change 2 — Redesign Step 4 as Full-Width Icon Cards

**a) Step 4 definition changes:**
- Change type to `"health_targets"` (custom type) or remove `fields` array
- Update subtitle to load from `content_blocks` (fetched alongside other labels, key=`subtitle`)
- Hardcode fallback: "Select everything that applies — we'll personalize your plan around it"

**b) Insert 2 new content_blocks rows** for the subtitle:
- `page='onboarding'`, `section='health_targets'`, `key='subtitle'`, `locale='en'`: "Select everything that applies — we'll personalize your plan around it"
- Same for `locale='fr'`: "Sélectionnez tout ce qui s'applique — nous personnaliserons votre plan"

**c) Category icon mapping** (using Lucide icons):
```typescript
import { Heart, Flame, Leaf, Brain, Zap, Scale } from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Heart> = {
  cat_metabolic: Heart,
  cat_inflammation: Flame,
  cat_gut: Leaf,
  cat_mental: Brain,
  cat_energy: Zap,
  cat_hormonal: Scale,
};
```

**d) Replace the pill-button rendering** (lines 446-478) with full-width cards:

```tsx
{HEALTH_TARGET_CATEGORIES.map((cat) => {
  const CatIcon = CATEGORY_ICONS[cat.catKey];
  return (
    <div key={cat.catKey}>
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-1">
        {healthTargetLabels.get(cat.catKey) || cat.catKey}
      </h3>
      <div className="space-y-1">
        {cat.targets.map((targetKey) => {
          const selected = healthTargets.includes(targetKey);
          return (
            <button
              key={targetKey}
              onClick={() => toggleHealthTarget(targetKey)}
              className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                selected
                  ? "bg-primary/10 border-primary/40"
                  : "bg-card border-border/50"
              }`}
            >
              <CatIcon size={16} className={selected ? "text-primary" : "text-muted-foreground"} />
              <span className={`flex-1 text-sm font-medium text-left ${selected ? "text-primary" : "text-foreground"}`}>
                {healthTargetLabels.get(targetKey) || targetKey}
              </span>
              {selected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check size={12} className="text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
})}
```

**e) Update Step 4 subtitle** to use the fetched `subtitle` key from `healthTargetLabels`:
- Override `current.subtitle` display when on step 4 with the content_blocks value

**f) Remove input field rendering for step 4** — since `fields` is now empty or step type changed, the goal weight input won't render on this step.

### Files changed
| What | Where |
|------|-------|
| Insert 2 subtitle content_blocks rows | Data insert (en + fr) |
| Move goalWeight field, redesign health targets UI | `src/pages/Onboarding.tsx` |

### No changes to
- Data saving logic (goalWeight still saved from `inputValues.goalWeight`)
- Health targets save logic (unchanged)
- Any other onboarding steps
- UserProfileContext

