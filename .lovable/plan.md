

## Add Edit & Delete Actions to My Recipes Cards

### What changes

Currently, the delete button is hidden inside the expanded ingredients section. There is no edit functionality. This plan adds visible Edit and Delete action buttons on every custom recipe card, and creates an edit route that reuses the CreateRecipe form pre-filled with existing data.

### Plan

**1. Add Edit/Delete buttons to RecipeCard (Recipes.tsx)**

In the `RecipeCard` component, when `isCustom` is true, render a row of two compact action buttons (Edit with `Pencil` icon, Delete with `Trash2` icon) below the description, always visible without needing to expand ingredients. Remove the existing delete button from inside the expanded ingredients section.

Add a confirmation dialog before delete using `window.confirm()` or a simple inline confirmation.

**2. Create Edit Recipe route and page**

- Add `/edit-recipe/:id` route in `App.tsx`
- Create `src/pages/EditRecipe.tsx` that reuses the same form layout as `CreateRecipe.tsx` but:
  - Loads existing recipe data from `useCustomRecipes()` by ID
  - Pre-fills all fields (name, time, cal, protein, fat, serving, tiers, meal, tags, ingredients, steps, image)
  - On save, calls `updateRecipe(id, updates)` instead of `addRecipe`
  - Navigates back to `/recipes` on success

**3. Add i18n keys**

- `en.json`: `"editRecipe": "Edit"` 
- `fr.json`: `"editRecipe": "Modifier"`

**4. Wire navigation**

In `RecipeCard`, the Edit button navigates to `/edit-recipe/${custom.id}`.

### Files changed

| File | Change |
|------|--------|
| `src/pages/Recipes.tsx` | Add Edit/Delete row on custom cards, remove buried delete |
| `src/pages/EditRecipe.tsx` | New page — form pre-filled with recipe data, calls `updateRecipe` |
| `src/App.tsx` | Add `/edit-recipe/:id` route |
| `src/i18n/en.json` | Add `editRecipe` key |
| `src/i18n/fr.json` | Add `editRecipe` key |

