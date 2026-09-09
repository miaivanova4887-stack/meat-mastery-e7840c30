# Restore recipe photos from the previous app

## What's wrong

The recipe photos aren't missing from the code — they're missing from this project's file storage. The three image libraries in this project (`meal-images`, `recipe-images`, `app-assets`) contain **0 files**. When a recipe card asks for its photo, nothing is found, so it shows the steak placeholder instead.

This is expected fallout from remixing: a remix copies the code and database structure, but not stored image files.

## The fix

Copy the existing recipe photos from the previous CarnivoreX app into this one.

1. Open a read-only snapshot of the previous project (`8cc44691-15e2-40ab-844f-f90c5fa95cc6`) and read its backend address from its configuration. Its photo library is public, so the files can be read directly.
2. List every file in the old `meal-images` library, plus `recipe-images` and `app-assets`.
3. Download each file and upload it into this project's library under the exact same filename, so existing recipe lookups match without any code change.
4. Verify: count files in each library afterwards, and load the Recipes screen to confirm real photos appear instead of placeholders.
5. Report anything that couldn't be copied (for example, recipes that never had a photo in the old app), and list which recipes are still without an image.

Nothing in the app's code needs to change if the copy succeeds — the lookup already points at the right filenames.

## If the old library can't be reached

If the previous project's storage is no longer publicly readable, the copy will fail cleanly and nothing here breaks. In that case the fallback is to generate fresh photos for the ~209 recipes (uses AI credits), which I'd confirm with you first rather than starting automatically.

## Technical notes

- Lookup path: `src/hooks/useMealImage.tsx` builds `…/storage/v1/render/image/public/meal-images/<slug>.png`, falling back to the raw object URL; `<slug>` is the lowercased, hyphenated recipe name truncated to 80 chars. Filenames must be preserved exactly.
- Copy will run as a temporary script in the sandbox using the service role for uploads (`upsert: true`), then be discarded.
- Bucket public flags are already correct (`public: true` on all three); no policy changes needed.
- `community_recipes` has 0 rows, so no user-uploaded images are affected.
