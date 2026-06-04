# Validate community recipe inputs

Add client-side zod validation with explicit length limits to the recipe submission forms so users can't save empty or excessively long content. Mirrors the pattern already used in `CreatePostSheet.tsx`.

## Limits

| Field | Min | Max | Notes |
|---|---|---|---|
| Recipe name | 1 | 100 | already capped at 100; add non-empty check |
| Cook time | 0 | 30 | optional |
| Calories / Protein / Fat | 0 | 20 | optional |
| Serving | 0 | 80 | optional |
| Tag (each) | 1 | 30 | max 5 tags total (already enforced) |
| Ingredient name | 1 | 80 | required if row kept |
| Ingredient amount | 0 | 40 | optional |
| Step text | 1 | 500 | min 1 step required |
| Steps count | 1 | 30 | |
| Ingredients count | 1 | 50 | at least one valid ingredient required |
| Auto-derived `desc` | 1 | 200 | still derived from first step, but now guaranteed non-empty since steps are required |

## Files to change

1. **`src/pages/CreateRecipe.tsx`**
   - Add zod schema (`recipeSchema`) at module scope.
   - In `handleSave`, run `recipeSchema.safeParse(...)` after trimming; on failure toast the first `issue.message` and stop.
   - Add `maxLength` to remaining inputs (time, cal, protein, fat, serving, tags, ingredient amount/name, step textarea) matching the schema.
   - Keep existing required checks but route through zod for consistent messaging.

2. **`src/pages/EditRecipe.tsx`**
   - Import and apply the same schema (export it from CreateRecipe or place in a new `src/lib/recipeValidation.ts` — preferred so it's shared).
   - Same `maxLength` additions and `safeParse` call in the save handler.

3. **`src/lib/recipeValidation.ts`** (new)
   - Export `recipeSchema` and the field-level constants (so both pages and any future server check stay in sync).

## Out of scope

- No DB schema change. `community_recipes.description` keeps current `text NOT NULL DEFAULT ''`; validation lives on the client (RLS already restricts writes to the owner).
- No new user-facing "Description" textarea (per user choice).
- No edge-function-side validation added; can be a follow-up if abuse is observed.

## Verification

- Try saving with empty name → toast "Recipe name is required".
- Try saving with no valid steps → toast "Add at least one step".
- Paste 5000-char string into a step → input caps at 500 and save still passes.
- Existing happy-path save still works on both Create and Edit.
