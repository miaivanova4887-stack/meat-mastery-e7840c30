import { useState, useCallback, useEffect } from "react";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface PlannedMeal {
  recipeName: string;
  cal: string;
  protein: string;
  fat: string;
  time: string;
  serving: string;
}

export type DayPlan = Record<MealSlot, PlannedMeal | null>;

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayKey = typeof DAYS[number];

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
  snack: "🍖 Snack",
};

/** Returns which slots are active for a given meals-per-day count */
export function activeSlots(mealsPerDay: number): MealSlot[] {
  if (mealsPerDay <= 2) return ["lunch", "dinner"];
  if (mealsPerDay === 3) return ["breakfast", "lunch", "dinner"];
  return ["breakfast", "lunch", "dinner", "snack"];
}

export type WeekPlan = Record<DayKey, DayPlan>;

const emptyDay = (): DayPlan => ({ breakfast: null, lunch: null, dinner: null, snack: null });
const emptyWeek = (): WeekPlan =>
  Object.fromEntries(DAYS.map((d) => [d, emptyDay()])) as WeekPlan;

const STORAGE_KEY = "carnivore-meal-plan";

function load(): WeekPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : emptyWeek();
  } catch {
    return emptyWeek();
  }
}

export function useMealPlan() {
  const [plan, setPlan] = useState<WeekPlan>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  const assignMeal = useCallback((day: DayKey, slot: MealSlot, meal: PlannedMeal) => {
    setPlan((prev) => ({ ...prev, [day]: { ...prev[day], [slot]: meal } }));
  }, []);

  const removeMeal = useCallback((day: DayKey, slot: MealSlot) => {
    setPlan((prev) => ({ ...prev, [day]: { ...prev[day], [slot]: null } }));
  }, []);

  const clearDay = useCallback((day: DayKey) => {
    setPlan((prev) => ({ ...prev, [day]: emptyDay() }));
  }, []);

  const clearWeek = useCallback(() => {
    setPlan(emptyWeek());
  }, []);

  // Compute daily & weekly totals
  const dayTotals = useCallback((day: DayKey) => {
    const d = plan[day];
    let cal = 0, protein = 0, fat = 0, count = 0;
    for (const slot of MEAL_SLOTS) {
      const m = d[slot];
      if (m) {
        cal += parseFloat(m.cal) || 0;
        protein += parseFloat(m.protein) || 0;
        fat += parseFloat(m.fat) || 0;
        count++;
      }
    }
    return { cal, protein, fat, count };
  }, [plan]);

  return { plan, assignMeal, removeMeal, clearDay, clearWeek, dayTotals };
}
