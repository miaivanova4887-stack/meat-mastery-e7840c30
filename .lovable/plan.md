

## Move YogaFlowProgram to First Position in Training Programs

### Change
**File: `src/pages/Exercise.tsx`**

Move `<YogaFlowProgram />` from line 191 (after `categoryKeys.map()`) to line 170 (before `categoryKeys.map()`), so it renders as the first item inside the Training Programs section.

```
Before:
  <h2>Training Programs</h2>
  {categoryKeys.map(...)}
  <YogaFlowProgram />

After:
  <h2>Training Programs</h2>
  <YogaFlowProgram />
  {categoryKeys.map(...)}
```

### What does NOT change
- No styling, logic, imports, or other components modified
- Only the render order changes

