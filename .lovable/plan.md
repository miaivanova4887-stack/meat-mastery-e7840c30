Capture six Play Store-ready screenshots of the running preview and save them to `public/screenshots/`.

## Approach

Use the browser automation tool to navigate to each route at a 1080×1920 viewport (Play Store phone screenshot spec) and save a full screenshot for each.

## Routes → filenames

1. `/` → `screen-01-home.png`
2. `/ketosis-timer` → `screen-02-ketosis.png`
3. `/recipes` → `screen-03-recipes.png`
4. `/meal-plan` → `screen-04-meal-plan.png`
5. `/progress` → `screen-05-progress.png`
6. `/budget-eating` → `screen-06-budget.png`

## Steps

1. Set viewport to 1080×1920 (will snap to nearest supported size; final image will be resized to exactly 1080×1920 with sharp).
2. For each route: navigate, wait for render, take screenshot, save raw to `/tmp/`.
3. Run a small script using `sharp` to resize/pad each capture to exactly 1080×1920 PNG and write to `public/screenshots/screen-0N-*.png`.
4. Verify all 6 files exist and are 1080×1920.

## Notes

- Onboarding gate: if the Home route redirects to onboarding, complete (or bypass via localStorage flag) before capturing.
- Auth-gated screens (Progress) require a logged-in session in the preview. If not signed in, the Progress page shows the sign-in prompt — will note this and ask user to sign in if encountered.
