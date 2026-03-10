import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { PlannedMeal } from "@/hooks/useMealPlan";

/**
 * Auto-syncs completed meal macros to progress_entries.
 * Called when a meal is checked off in the meal plan.
 * Uses a single bulk insert to avoid race conditions.
 */
export function useMealSync() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const syncMealToProgress = useCallback(
    async (meal: PlannedMeal, wasCompleted: boolean) => {
      // Only sync when marking as completed (not when un-completing)
      if (!user || wasCompleted) return;

      const now = new Date().toISOString();
      const note = `[meal-sync] ${meal.recipeName}`;

      const cal = parseFloat(meal.cal) || 0;
      const protein = parseFloat(meal.protein) || 0;
      const fat = parseFloat(meal.fat) || 0;

      const rows: { user_id: string; category: string; metric: string; value: number; unit: string; notes: string; recorded_at: string }[] = [];

      if (cal > 0) rows.push({ user_id: user.id, category: "diet_trends", metric: "calories", value: cal, unit: "kcal", notes: note, recorded_at: now });
      if (protein > 0) rows.push({ user_id: user.id, category: "diet_trends", metric: "protein", value: protein, unit: "g", notes: note, recorded_at: now });
      if (fat > 0) rows.push({ user_id: user.id, category: "diet_trends", metric: "fat", value: fat, unit: "g", notes: note, recorded_at: now });

      if (rows.length === 0) return;

      const { error } = await supabase.from("progress_entries").insert(rows);
      if (error) {
        console.error("Meal sync failed:", error);
        toast.error("Failed to sync meal nutrition");
      } else {
        qc.invalidateQueries({ queryKey: ["progress-entries"] });
        toast.success(`${meal.recipeName} nutrition synced`);
      }
    },
    [user, qc]
  );

  return { syncMealToProgress };
}
