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
  if (mealsPerDay <= 1) return ["dinner"];
  if (mealsPerDay === 2) return ["lunch", "dinner"];
  if (mealsPerDay === 3) return ["breakfast", "lunch", "dinner"];
  return ["breakfast", "lunch", "dinner", "snack"];
}

export type WeekPlan = Record<DayKey, DayPlan>;

const emptyDay = (): DayPlan => ({ breakfast: null, lunch: null, dinner: null, snack: null });
const emptyWeek = (): WeekPlan =>
  Object.fromEntries(DAYS.map((d) => [d, emptyDay()])) as WeekPlan;

const STORAGE_KEY = "carnivore-meal-plan";
const COMPLETED_KEY = "carnivore-meal-completed";

function load(): WeekPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWeek();
    const parsed = JSON.parse(raw);
    // Sanitize: ensure all meal values are strings
    for (const day of DAYS) {
      if (!parsed[day]) { parsed[day] = emptyDay(); continue; }
      for (const slot of MEAL_SLOTS) {
        const m = parsed[day][slot];
        if (m) {
          m.cal = String(m.cal ?? "0");
          m.protein = String(m.protein ?? "0g");
          m.fat = String(m.fat ?? "0g");
          m.time = String(m.time ?? "N/A");
          m.serving = String(m.serving ?? "1 serving");
          m.recipeName = String(m.recipeName ?? "");
        }
      }
    }
    return parsed;
  } catch {
    return emptyWeek();
  }
}

export type CompletedMeals = Record<string, boolean>; // key: "day-slot"

function loadCompleted(): CompletedMeals {
  try {
    const raw = localStorage.getItem(COMPLETED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useMealPlan() {
  const [plan, setPlan] = useState<WeekPlan>(load);
  const [completed, setCompleted] = useState<CompletedMeals>(loadCompleted);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
  }, [completed]);
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
    setCompleted({});
  }, []);

  const toggleCompleted = useCallback((day: DayKey, slot: MealSlot) => {
    const key = `${day}-${slot}`;
    setCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isCompleted = useCallback((day: DayKey, slot: MealSlot) => {
    return !!completed[`${day}-${slot}`];
  }, [completed]);

  const dayCompletionCount = useCallback((day: DayKey, slots: MealSlot[]) => {
    let total = 0, done = 0;
    for (const slot of slots) {
      if (plan[day][slot]) {
        total++;
        if (completed[`${day}-${slot}`]) done++;
      }
    }
    return { total, done };
  }, [plan, completed]);
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

  return { plan, assignMeal, removeMeal, clearDay, clearWeek, dayTotals, toggleCompleted, isCompleted, dayCompletionCount };
}
