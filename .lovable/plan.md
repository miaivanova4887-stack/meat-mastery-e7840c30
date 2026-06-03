# Fix missing French translations

## Findings

Many keys already exist in both `src/i18n/en.json` and `src/i18n/fr.json` (e.g. `mealPlan.aiPlanner`, `mealPlan.singleRecipe`, `mealPlan.fullDay`, `mealPlan.fullWeek`, `mealPlan.preferences`, `mealPlan.preferencesPlaceholder`, `progress.setGoals`, `progress.setGoalsDesc`, `progress.calories`, `progress.protein`, `progress.fat`, `progress.carbs`). The components simply hardcode English instead of calling `t(...)`. A few new keys are needed (Recipe Coach screen, Profile legal links).

## Component fixes (wire `t(...)` where literals are hardcoded)

1. **`src/pages/RecipeCoach.tsx`** — does not import `useTranslation`. Add it, then replace:
   - Header: "Recipe Coach" → `t("recipeCoach.title")`, "AI-powered meal suggestions" → `t("recipeCoach.subtitle")`
   - Empty state: "Your Carnivore Coach" → `t("recipeCoach.heroTitle")`, "Ask me for recipes, meal plans, or cooking tips tailored to your diet." → `t("recipeCoach.heroDesc")`
   - Suggestion chips array (4 prompts) → `t("recipeCoach.prompts.lunch|dinner|breakfast|postWorkout")`
   - Input placeholder "Ask for recipes, meal ideas…" / locked variant → `t("recipeCoach.inputPlaceholder")` / `t("recipeCoach.lockedPlaceholder")`

2. **`src/pages/MealPlan.tsx` (AI Meal Planner modal ~lines 980–1080)** — already has `t`. Replace:
   - "AI Meal Planner" → `t("mealPlan.aiPlanner")`
   - "Generate" label → `t("mealPlan.generate")`
   - 3 mode labels → `t("mealPlan.singleRecipe|fullDay|fullWeek")`
   - "Diet Tier" → `t("profile.dietTier")` (already localized)
   - "Preferences (optional)" → `t("mealPlan.preferences")`, textarea placeholder → `t("mealPlan.preferencesPlaceholder")`
   - Info copy ("AI will fill … cal", "AI will generate 1 recipe…", "Personalized to your goal: …") → new keys `mealPlan.aiInfoSingle/Day/Week` and `mealPlan.aiInfoGoal` with interpolation
   - Generate button "Generate Recipe/Day Plan/Week Plan" → `t("mealPlan.generateRecipe|generateDayPlan|generateWeekPlan")`, "Generating…" → `t("mealPlan.generating")`

3. **`src/components/progress/SetGoalDrawer.tsx`** — does not import `useTranslation`. Add it, then:
   - "Set Goals" title and button → `t("progress.setGoals")`
   - Description → `t("progress.setGoalsDesc")`
   - "Cancel" → `t("common.cancel")` (verify existing) else new `progress.cancel`
   - "Saving..." → `t("progress.saving")`

4. **`src/pages/Profile.tsx` (legal block, lines 1232–1257)** — `t` already in scope:
   - "Privacy Policy" → `t("profile.privacyPolicy")`
   - "Terms of Use" → `t("profile.termsOfUse")`
   - "Wellness Disclaimer" → `t("profile.wellnessDisclaimer")`

## New i18n keys to add (both `src/i18n/en.json` and `src/i18n/fr.json`)

```
"recipeCoach": {
  "title": "Recipe Coach" / "Coach Recettes",
  "subtitle": "AI-powered meal suggestions" / "Suggestions de repas par IA",
  "heroTitle": "Your Carnivore Coach" / "Votre Coach Carnivore",
  "heroDesc": "Ask me for recipes, meal plans, or cooking tips tailored to your diet." /
              "Demandez-moi des recettes, plans de repas ou conseils adaptés à votre alimentation.",
  "prompts": {
    "lunch": "🥩 Quick lunch ideas for today" / "🥩 Idées de déjeuner rapides",
    "dinner": "🔥 High-protein dinner under 30 min" / "🔥 Dîner riche en protéines en moins de 30 min",
    "breakfast": "🍳 Easy breakfast recipes" / "🍳 Recettes faciles pour le petit-déjeuner",
    "postWorkout": "💪 Post-workout meal suggestions" / "💪 Repas post-entraînement"
  },
  "inputPlaceholder": "Ask for recipes, meal ideas…" / "Demandez recettes, idées de repas…",
  "lockedPlaceholder": "Unlock with Pro to chat with your coach" /
                       "Débloquez avec Pro pour discuter avec votre coach"
},
"profile.privacyPolicy": "Privacy Policy" / "Politique de confidentialité",
"profile.termsOfUse":    "Terms of Use"   / "Conditions d'utilisation",
"profile.wellnessDisclaimer": "Wellness Disclaimer" / "Avis bien-être",
"mealPlan.generateRecipe":  "Generate Recipe"   / "Générer une recette",
"mealPlan.generateDayPlan": "Generate Day Plan" / "Générer le plan du jour",
"mealPlan.generateWeekPlan":"Generate Week Plan"/ "Générer le plan de la semaine",
"mealPlan.aiInfoSingle":   "AI will generate 1 recipe and add it to {{day}}'s plan." /
                           "L'IA générera 1 recette et l'ajoutera au plan de {{day}}.",
"mealPlan.aiInfoDay":      "AI will fill {{count}} meal slots for {{day}} targeting {{cal}} cal." /
                           "L'IA remplira {{count}} repas pour {{day}} ciblant {{cal}} cal.",
"mealPlan.aiInfoWeek":     "AI will generate {{count}} meals/day for all 7 days targeting {{cal}} cal/day." /
                           "L'IA générera {{count}} repas/jour pour les 7 jours, ciblant {{cal}} cal/jour.",
"mealPlan.aiInfoGoal":     "Personalized to your goal: {{goal}}." /
                           "Personnalisé selon votre objectif : {{goal}}."
```

(SetGoalDrawer can reuse the existing `progress.setGoals`, `progress.setGoalsDesc`, `progress.saving`. Add `progress.cancel` = "Cancel" / "Annuler" if no shared `common.cancel` exists — will verify during build.)

## Broader audit (read-only sweep, then fix what's safely in-scope)

After the above is done, run targeted `rg` sweeps in `src/pages` and `src/components` for visible user-facing literals that are likely missed:
- Sticky page headers / titles
- Button labels (`<Button>...</Button>`)
- `placeholder=`, `aria-label=`, `title=`
- DrawerTitle / DialogTitle / SheetTitle children

Limit this pass to **labels/titles/placeholders only** (no body copy regeneration). For each finding, either wire to an existing key (preferred) or add a new key pair to both JSON files. Any literal that's genuinely English-only by design (admin-only screens, debug overlays) will be left alone and listed in the final response.

## Files touched

- `src/i18n/en.json` (add keys)
- `src/i18n/fr.json` (add same keys, mirrored)
- `src/pages/RecipeCoach.tsx`
- `src/pages/MealPlan.tsx`
- `src/pages/Profile.tsx`
- `src/components/progress/SetGoalDrawer.tsx`
- Plus whatever the broader audit surfaces (will be listed explicitly in the final response — not silently changed).

## Verification

1. Toggle FR via Profile → Langue and visit: `/recipe-coach`, `/meal-plan` → AI Meal Planner modal, `/progress` → Set Goals drawer, `/profile` legal block. All listed strings render in French.
2. Toggle back to EN and confirm the same strings render in English (no fallback keys leaking).
3. `grep` confirms no remaining hardcoded "Recipe Coach", "AI Meal Planner", "Set Goals", "Privacy Policy", "Terms of Use", "Wellness Disclaimer" in the touched files outside i18n JSON.

## Out of scope

- Translation of recipe content (already covered by `recipesFr.ts`).
- Admin-only pages and CMS editor UI (per memory, admin tooling is EN-only).
- Visual/layout changes.
