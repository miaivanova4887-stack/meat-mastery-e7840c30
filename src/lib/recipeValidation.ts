import { z } from "zod";

export const RECIPE_LIMITS = {
  NAME_MAX: 100,
  TIME_MAX: 30,
  MACRO_MAX: 20,
  SERVING_MAX: 80,
  TAG_MAX: 30,
  TAGS_COUNT_MAX: 5,
  INGREDIENT_NAME_MAX: 80,
  INGREDIENT_AMOUNT_MAX: 40,
  INGREDIENTS_COUNT_MAX: 50,
  STEP_MAX: 500,
  STEPS_COUNT_MAX: 30,
  DESC_MAX: 200,
} as const;

const L = RECIPE_LIMITS;

export const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(L.INGREDIENT_NAME_MAX),
  amount: z.string().trim().max(L.INGREDIENT_AMOUNT_MAX).optional().default(""),
});

export const recipeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Recipe name is required" })
    .max(L.NAME_MAX, { message: `Recipe name must be ${L.NAME_MAX} characters or less` }),
  time: z.string().trim().max(L.TIME_MAX, { message: `Cook time must be ${L.TIME_MAX} characters or less` }),
  cal: z.string().trim().max(L.MACRO_MAX, { message: `Calories must be ${L.MACRO_MAX} characters or less` }),
  protein: z.string().trim().max(L.MACRO_MAX, { message: `Protein must be ${L.MACRO_MAX} characters or less` }),
  fat: z.string().trim().max(L.MACRO_MAX, { message: `Fat must be ${L.MACRO_MAX} characters or less` }),
  serving: z.string().trim().max(L.SERVING_MAX, { message: `Portion size must be ${L.SERVING_MAX} characters or less` }),
  tiers: z.array(z.string()).min(1, { message: "Select at least one diet tier" }),
  tags: z
    .array(z.string().trim().min(1).max(L.TAG_MAX, { message: `Each tag must be ${L.TAG_MAX} characters or less` }))
    .max(L.TAGS_COUNT_MAX, { message: `Max ${L.TAGS_COUNT_MAX} tags` }),
  ingredients: z
    .array(ingredientSchema)
    .min(1, { message: "Add at least one ingredient" })
    .max(L.INGREDIENTS_COUNT_MAX, { message: `Max ${L.INGREDIENTS_COUNT_MAX} ingredients` }),
  steps: z
    .array(z.string().trim().min(1).max(L.STEP_MAX, { message: `Each step must be ${L.STEP_MAX} characters or less` }))
    .min(1, { message: "Add at least one cooking step" })
    .max(L.STEPS_COUNT_MAX, { message: `Max ${L.STEPS_COUNT_MAX} steps` }),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

export function deriveDescription(steps: string[]): string {
  const first = steps.find((s) => s.trim().length > 0);
  return first ? first.trim().slice(0, L.DESC_MAX) : "Custom recipe";
}
