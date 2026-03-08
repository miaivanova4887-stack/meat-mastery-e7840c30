import { useCallback } from "react";
import { useAddEntry } from "@/hooks/useProgress";
import { useAuth } from "@/contexts/AuthContext";
import type { PlannedMeal } from "@/hooks/useMealPlan";

/**
 * Auto-syncs completed meal macros to progress_entries.
 * Called when a meal is checked off in the meal plan.
 */
export function useMealSync() {
  const addEntry = useAddEntry();
  const { user } = useAuth();

  const syncMealToProgress = useCallback(
    (meal: PlannedMeal, wasCompleted: boolean) => {
      // Only sync when marking as completed (not when un-completing)
      if (!user || wasCompleted) return;

      const now = new Date().toISOString();
      const note = `[meal-sync] ${meal.recipeName}`;

      const cal = parseFloat(meal.cal) || 0;
      const protein = parseFloat(meal.protein) || 0;
      const fat = parseFloat(meal.fat) || 0;

      if (cal > 0) {
        addEntry.mutate({ category: "diet_trends", metric: "calories", value: cal, unit: "kcal", notes: note, recorded_at: now });
      }
      if (protein > 0) {
        addEntry.mutate({ category: "diet_trends", metric: "protein", value: protein, unit: "g", notes: note, recorded_at: now });
      }
      if (fat > 0) {
        addEntry.mutate({ category: "diet_trends", metric: "fat", value: fat, unit: "g", notes: note, recorded_at: now });
      }
    },
    [user, addEntry]
  );

  return { syncMealToProgress };
}
