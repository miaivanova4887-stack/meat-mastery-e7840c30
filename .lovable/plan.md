# Add photos for the five recipes that have none

Five recipes still fall back to the default steak icon because no photo was ever created for them:

- Wagyu Steak
- Suya Beef Skewers
- South African Boerewors
- Smoked Turkey Legs
- Steak & Cheese Omelette

## What happens

1. Generate one cinematic, high-contrast food photo per recipe, matching the look of the existing 204 photos (dark moody plating, natural light, close crop, no text, no people).
2. Save each into the app's image library under the exact name the app looks for, so it appears automatically with no app change:
   - `wagyu-steak.png`
   - `suya-beef-skewers.png`
   - `south-african-boerewors.png`
   - `smoked-turkey-legs.png`
   - `steak-cheese-omelette.png`
3. Confirm each photo loads, then open the Recipes screen and check all five show real photos instead of the placeholder.

## Notes

- No app code changes, so no new Play Store upload is needed — the photos appear in the version already installed.
- Prompts are written per recipe from its own description (e.g. thinly sliced seared A5 wagyu; charred spice-rubbed skewers; coiled sausage on coals; dark-skinned smoked turkey legs; folded omelette with steak and melted cheddar).

## Technical details

- Filenames follow the slug rule in `src/hooks/useMealImage.tsx` (`toCacheKey`: lowercase, non-alphanumerics collapsed to `-`), uploaded as PNG into the public `meal-images` bucket.
- Upload uses the project's service-role credentials from a temporary script; nothing is added to the codebase.
