

## Fix Recipe Add Flow — Complete Technical Plan

### Current State
- `community_recipes` table exists with proper RLS (owner insert/update/delete, public read)
- `useCustomRecipes` hook uses `localStorage` only — no database sync
- `CreateRecipe.tsx` has no image upload field
- `RecipeCard` uses `MealImage` component (looks up AI-generated images by name) — no support for user-uploaded images
- No `recipe-images` storage bucket exists; only `meal-images` bucket exists

---

### Step 1 — Database Migration

**Add `image_url` column:**
```sql
ALTER TABLE community_recipes ADD COLUMN IF NOT EXISTS image_url text DEFAULT '';
```

**Create `recipe-images` storage bucket + policies:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true);

-- Anyone can view recipe images (bucket is public, but policy needed for RLS)
CREATE POLICY "Public read recipe images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'recipe-images');

-- Authenticated users can upload to their own folder: recipe-images/{user_id}/...
CREATE POLICY "Auth users upload own recipe images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete only their own uploads
CREATE POLICY "Users delete own recipe images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'recipe-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

**Why this is safe:** The existing `community_recipes` RLS policies are untouched. The new `image_url` column has a default of `''` so existing rows are unaffected. Storage policies scope uploads/deletes to `{user_id}/` folders, preventing users from tampering with others' images.

---

### Step 2 — Update `CustomRecipe` type (`src/data/recipes.ts`)

Add optional fields:
```typescript
export interface CustomRecipe extends Recipe {
  id: string;
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
  isCustom: true;
  image_url?: string;
  user_id?: string;
}
```

---

### Step 3 — Rewrite `useCustomRecipes` hook

Replace localStorage with database calls:

- **Requires auth**: uses `useAuth()` to get current user; returns empty array if not logged in
- **Fetch**: `SELECT * FROM community_recipes WHERE user_id = auth.uid() ORDER BY created_at DESC`
- **`addRecipe(recipe, imageFile?)`**:
  1. If `imageFile` provided: upload to `recipe-images/{userId}/{recipeId}.jpg`, get public URL
  2. Insert into `community_recipes` with all fields including `image_url`
  3. Optimistically prepend to local state so it appears immediately
- **`deleteRecipe(id)`**: delete from `community_recipes` by id (RLS enforces ownership), remove from local state
- **`updateRecipe(id, updates)`**: update in `community_recipes` by id (RLS enforces ownership), update local state

**localStorage migration**: On first load, if `localStorage` has recipes under `carnivore-custom-recipes` and user is authenticated, offer to import them (insert into DB), then clear localStorage. Silent — no UI change needed, just a one-time migration in the hook's `useEffect`.

---

### Step 4 — Add image upload to `CreateRecipe.tsx`

Changes to the form (inserted between the header and the "Recipe Name" field):

1. **Auth guard**: Check `useAuth()` — if no user, redirect to `/auth` with toast "Sign in to create recipes"
2. **File state**: `useState<File | null>(null)` + preview URL via `URL.createObjectURL`
3. **Upload UI**: A tappable area showing either:
   - Camera icon + "Add Photo" label (no file selected)
   - Image preview thumbnail with an X button to remove (file selected)
   - `accept="image/*"` to allow camera/gallery on mobile
4. **On save**: Pass the file to `addRecipe(recipe, imageFile)` — the hook handles upload
5. **Cleanup**: Revoke object URL on unmount

No other layout or styling changes.

---

### Step 5 — Display uploaded images in `RecipeCard` (`src/pages/Recipes.tsx`)

Line 162 currently:
```tsx
<MealImage recipeName={r.name} tags={recipeTags} className="w-full h-40" />
```

Change to:
```tsx
{isCustom && (r as CustomRecipe).image_url ? (
  <img src={(r as CustomRecipe).image_url} alt={r.name}
    className="w-full h-40 object-cover" loading="lazy" />
) : (
  <MealImage recipeName={r.name} tags={recipeTags} className="w-full h-40" />
)}
```

This is a 3-line change. No other modifications to Recipes page.

---

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | New column + storage bucket + 3 storage policies |
| `src/data/recipes.ts` | Add `image_url?`, `user_id?` to `CustomRecipe` |
| `src/hooks/useCustomRecipes.ts` | Full rewrite: localStorage → database + storage upload |
| `src/pages/CreateRecipe.tsx` | Add image upload field, preview, auth guard |
| `src/pages/Recipes.tsx` | 3-line conditional in `RecipeCard` for `image_url` |

### What is NOT changed
- Existing `community_recipes` RLS policies (already correct: owner insert/update/delete, public read)
- Recipe page layout, filters, styling, navigation
- `MealImage` component / `meal-images` bucket
- Any other page or component

