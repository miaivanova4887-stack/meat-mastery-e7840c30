

## Add Yoga Flow Training Program — Technical Plan

### Files Modified
| File | Change |
|------|--------|
| `src/pages/Exercise.tsx` | Import and render `<YogaFlowProgram />` after the existing `categoryKeys.map(...)` block (line 189), inside the Training Programs `<div>` |

### Files Created
| File | Purpose |
|------|---------|
| `src/components/exercise/YogaFlowProgram.tsx` | Self-contained Yoga Flow component with idle card + active timer flow |

### Database Changes
Insert ~40 rows into `content_blocks` table (`page='exercise'`, `section='yoga_flow'`) for EN and FR locales using the insert tool.

### What Will NOT Change
- Existing 4 training program cards (strength, hiit, liss, recovery) — untouched
- Quiz card, personal tip, page layout, header, styling — all untouched
- No changes to `useContentOverrides.ts`, `en.json`, `fr.json`, or any other existing file besides `Exercise.tsx`

---

### Data Structure — content_blocks rows

All pose content stored in `content_blocks` with `page='exercise'`, `section='yoga_flow'`. The `useContentOverrides` hook automatically maps these to i18n keys like `exercise.yoga_flow.{key}`.

**Keys per locale (EN + FR = ~40 rows):**

| Key | EN Value | Type |
|-----|----------|------|
| `name` | Yoga Flow | text |
| `desc` | A 7-pose guided recovery flow... | text |
| `start` | Start Flow | text |
| `restart` | Restart | text |
| `pause` | Pause | text |
| `resume` | Resume | text |
| `skip` | Skip | text |
| `complete_title` | Flow Complete | text |
| `complete_desc` | Great work! Namaste. | text |
| `pose_of` | Pose {{current}} of {{total}} | text |
| `each_side` | Each side | text |
| `left_side` | Left Side | text |
| `right_side` | Right Side | text |
| `pose_1_name` | Child's Pose (Balasana) | text |
| `pose_1_desc` | Kneel, sit back on heels, extend arms forward... | text |
| `pose_2_name` through `pose_7_name` | ... | text |
| `pose_2_desc` through `pose_7_desc` | ... | text |

Durations and side counts are hardcoded in the component as static config (not content — they are numeric configuration, not translatable text):

```typescript
const POSES = [
  { key: 1, duration: 60, sides: 1 },
  { key: 2, duration: 60, sides: 1 },
  { key: 3, duration: 45, sides: 1 },
  { key: 4, duration: 45, sides: 2 },  // each side
  { key: 5, duration: 60, sides: 1 },
  { key: 6, duration: 45, sides: 2 },  // each side
  { key: 7, duration: 120, sides: 1 },
];
```

---

### Component Architecture — `YogaFlowProgram.tsx`

**State:**
- `active: boolean` — idle card vs active flow
- `poseIndex: number` — current pose (0-6)
- `sideIndex: number` — 0 = left/only, 1 = right (for 2-sided poses)
- `timeLeft: number` — countdown seconds
- `paused: boolean`
- `completed: boolean`

**Idle state** (matches existing card style exactly):
```
bg-card border border-border rounded-lg p-4 mb-3 animate-fade-in-up
```
- `Sun` icon (from lucide, already imported in Exercise.tsx)
- Title from `t("exercise.yoga_flow.name")`
- Description from `t("exercise.yoga_flow.desc")`
- Bullet list of all 7 pose names from `t("exercise.yoga_flow.pose_N_name")`
- "Start Flow" button

**Active state** (replaces card content):
- Progress indicator: `t("exercise.yoga_flow.pose_of", { current, total: 7 })`
- `<Progress />` bar (reuses existing `src/components/ui/progress.tsx`)
- Current pose name + description from content_blocks
- Side indicator for 2-sided poses (Left Side / Right Side)
- Countdown timer display (mm:ss format)
- Pause/Resume + Skip buttons

**Timer implementation:**
```typescript
useEffect(() => {
  if (paused || completed) return;
  const id = setInterval(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        // Auto-advance logic
        advanceToNext();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(id);
}, [poseIndex, sideIndex, paused, completed]);
```

**Auto-advance logic (`advanceToNext`):**
1. If current pose has `sides: 2` and `sideIndex === 0` → increment sideIndex to 1, reset timer
2. Else if `poseIndex < 6` → increment poseIndex, reset sideIndex to 0, reset timer
3. Else → set `completed = true`

**Skip:** Calls same `advanceToNext` logic.

**Completion screen:** Shows "Flow Complete" message with restart button.

**No existing components reused** besides `<Progress />` and `<Button />` from ui library.

---

### Integration in Exercise.tsx

```tsx
import YogaFlowProgram from "@/components/exercise/YogaFlowProgram";

// Inside the Training Programs <div>, after the categoryKeys.map() block:
<YogaFlowProgram />
```

The component renders its own card with `animationDelay` matching the 5th card position (`0.24s`).

