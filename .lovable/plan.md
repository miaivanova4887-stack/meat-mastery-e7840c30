## Verification: Storage RLS

Checked the live `storage.objects` policies on the `recipe-images` bucket:

- **INSERT** "Auth users upload own recipe images": `bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text`
- **UPDATE / DELETE** "Users update/delete own recipe images": same predicate
- **SELECT** "Public read recipe images": public

`CreatePostSheet.tsx` uploads to path `${user.id}/posts/${uuid}.${ext}`, so segment `[1]` is the uploader's `auth.uid()`. The existing policy already covers post image uploads — **no migration needed**. Safe to test image upload as-is.

## i18n migration plan

Migrate all inline English strings in the new post UI to `src/i18n/en.json` + `src/i18n/fr.json` under a new `community.*` namespace, then replace literals with `t(...)` calls. No behavior changes, no new components.

### New keys (en.json / fr.json)

Under `community`:

- `create.title` — "Create" / "Créer"
- `create.shareRecipe` — "Share a Recipe" / "Partager une recette"
- `create.shareRecipeDesc` — short helper (match current inline copy)
- `create.writePost` — "Write a Post" / "Écrire une publication"
- `create.writePostDesc` — short helper
- `post.titlePlaceholder` — "Give it a headline" / "Donnez-lui un titre"
- `post.bodyPlaceholder` — "Share a tip, question, win, or update…" / "Partagez un conseil, une question, une victoire…"
- `post.removeImage` — "Remove image" / "Supprimer l'image"
- `post.publish` — "Post" / "Publier"
- `post.publishing` — "Publishing…" / "Publication…"
- `post.published` — "Post published" / "Publication publiée"
- `post.signInToPost` — "Sign in to post" / "Connectez-vous pour publier"
- `post.signInToLike` — "Sign in to like posts" / "Connectez-vous pour aimer"
- `post.invalidInput` — "Invalid input" / "Entrée invalide"
- `post.imageTypeError` — "Use a JPG, PNG, or WEBP image" / "Utilisez une image JPG, PNG ou WEBP"
- `post.imageSizeError` — "Image must be under 5MB" / "L'image doit faire moins de 5 Mo"
- `post.readMore` / `post.readLess` — "Read more" / "Read less" → "Lire la suite" / "Réduire"
- `post.badge` — "Post" / "Publication"
- `recipe.badge` — "Recipe" / "Recette"
- `recipe.signInToLike` — "Sign in to like recipes" / "Connectez-vous pour aimer"
- `common.close` — reuse if it exists; otherwise add "Close" / "Fermer"

### Files to edit

- `src/i18n/en.json` — add `community.*` keys above
- `src/i18n/fr.json` — add French translations
- `src/components/community/CreateChoiceSheet.tsx` — replace 4 literals + aria-label
- `src/components/community/CreatePostSheet.tsx` — replace title, placeholders, aria-labels, button labels, and all 6 toast strings
- `src/components/community/PostCard.tsx` — Read more/less, badge
- `src/components/community/RecipeCard.tsx` — Recipe badge (if literal)
- `src/components/CommunityFeed.tsx` — 2 `toast("Sign in to like …")` calls

### Validation

- Switch app language to FR and confirm Create sheet, Write a Post sheet, badges, Read more, and toast messages all render in French.
- No DB or RLS changes.
- Make sure `common.close` is checked for an existing key before adding a new one. If the key already exists elsewhere in `en.json` / `fr.json`, adding a duplicate under `community.common.close` instead of reusing it would create inconsistency. The plan already notes this — just make sure Lovable checks rather than blindly adds