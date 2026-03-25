

## Two Changes: Remove Recipes Tab from Profile + Add "My Recipes" Filter to Recipes Page + Case-Insensitive Filters

### Change 1 — Profile.tsx: Remove `tab === "recipes"` block

1. **Tab state** (line 80): Change type from `"feed" | "recipes" | "goals" | "settings"` to `"feed" | "goals" | "community" | "settings"`

2. **Tab bar** (lines 395-411): Replace `"recipes"` tab entry with `"community"` tab:
   - `{ key: "community", label: "Community", icon: Users }`

3. **Delete lines 416-468** entirely (the `tab === "recipes"` block with My Recipes / Favorites / Liked sections)

4. **Add `tab === "community"` block**: Import and render `<CommunityFeed />` (new extracted component — per the approved plan)

5. Remove unused imports that were only used in the recipes tab block (e.g. `ChefHat` if not used elsewhere)

### Change 2 — Recipes.tsx: Add "My Recipes" as a filter option

Add a new filter button alongside the existing Favorites toggle in the combined filter row (line 409-421):

- A "My Recipes" toggle button (similar to the Favorites toggle) that when active, shows only `customRecipes` (user-created recipes)
- New state: `const [showMyRecipesOnly, setShowMyRecipesOnly] = useState(false)`
- In the `filtered` useMemo, add: `if (showMyRecipesOnly)` — for `builtIn`, return none; for `custom`, return all matching
- This replaces the Profile "My Recipes" tab — users now filter their own recipes directly on the Recipes page

### Change 3 — Case-insensitive filter comparisons in Recipes.tsx

Currently the tag filter comparison at line 89 is already case-insensitive (`t.toLowerCase() === activeTag.toLowerCase()`), but the `handleTagClick` comparison at line 132 (`activeTag === tag`) and the active tag highlight at line 316 (`activeTag === tg`) are case-sensitive.

Fix:
- Line 132: `if (activeTag?.toLowerCase() === tag.toLowerCase())`
- Line 316: `activeTag?.toLowerCase() === tg.toLowerCase()`

### New File: `src/components/CommunityFeed.tsx`

Extract the feed body from `Community.tsx` into a reusable component (per the approved plan). Both the `/community` route and the Profile Community tab will render this component.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | Remove "recipes" tab, add "community" tab, delete recipes block, render CommunityFeed |
| `src/pages/Recipes.tsx` | Add "My Recipes" filter toggle, fix case-insensitive tag comparisons |
| `src/components/CommunityFeed.tsx` | New — extracted feed from Community.tsx |
| `src/pages/Community.tsx` | Refactor to use `<CommunityFeed />` |

### What is NOT changed
- My Feed tab, My Goals tab, Settings tab
- Recipe page layout/styling (only adding one filter button)
- Bottom nav changes (separate from this plan — already covered in the approved plan)

