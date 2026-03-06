import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";

export type Goal = "lose_weight" | "build_muscle" | "maintain" | "improve_health";
export type Experience = "beginner" | "tried_briefly" | "months_in" | "veteran";
export type Struggle = "sugar_cravings" | "low_energy" | "digestive" | "social_pressure";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";
export type Interest = "recipes" | "exercise" | "ketosis" | "mental_clarity";
export type Sex = "male" | "female" | "unspecified";

export interface BodyStats {
  sex: Sex;
  age: number | null;
  height: number | null;
  weight: number | null;
  goalWeight: number | null;
  healthTarget: string;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  fat: number;
}

export interface UserProfile {
  goal: Goal;
  experience: Experience;
  struggles: Struggle[];
  activityLevel: ActivityLevel;
  interests: Interest[];
  body: BodyStats;
  mealsPerDay: number;
  nutritionTargets: NutritionTargets;
  isComplete: boolean;
}

const GOAL_MAP: Goal[] = ["lose_weight", "build_muscle", "maintain", "improve_health"];
const EXP_MAP: Experience[] = ["beginner", "tried_briefly", "months_in", "veteran"];
const STRUGGLE_MAP: Struggle[] = ["sugar_cravings", "low_energy", "digestive", "social_pressure"];
const ACTIVITY_MAP: ActivityLevel[] = ["sedentary", "light", "moderate", "very_active"];
const INTEREST_MAP: Interest[] = ["recipes", "exercise", "ketosis", "mental_clarity"];
const SEX_MAP: Sex[] = ["male", "female", "unspecified"];

function parseNum(val: unknown): number | null {
  const n = Number(val);
  return val && !isNaN(n) && n > 0 ? n : null;
}

function computeTargets(goal: Goal, activity: ActivityLevel, body: BodyStats): NutritionTargets {
  // Base BMR estimate (Mifflin-St Jeor simplified)
  const weight = body.weight ?? 80;
  const age = body.age ?? 30;
  const isMale = body.sex !== "female";
  const bmr = isMale
    ? 10 * weight + 6.25 * (body.height ?? 175) - 5 * age + 5
    : 10 * weight + 6.25 * (body.height ?? 165) - 5 * age - 161;

  const activityMultiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725,
  };
  let tdee = bmr * activityMultiplier[activity];

  // Goal adjustment
  if (goal === "lose_weight") tdee *= 0.8;
  else if (goal === "build_muscle") tdee *= 1.1;

  const calories = Math.round(tdee);
  // Carnivore: ~35% protein, ~65% fat (by calories)
  const proteinCal = calories * 0.35;
  const fatCal = calories * 0.65;
  return { calories, protein: Math.round(proteinCal / 4), fat: Math.round(fatCal / 9) };
}

function parseProfile(): UserProfile {
  const storedMeals = parseInt(localStorage.getItem("carnivore-meals-per-day") || "3") || 3;
  const defaultBody: BodyStats = { sex: "unspecified", age: null, height: null, weight: null, goalWeight: null, healthTarget: "" };
  const defaults: UserProfile = {
    goal: "improve_health", experience: "beginner", struggles: [],
    activityLevel: "light", interests: [], body: defaultBody, mealsPerDay: storedMeals,
    nutritionTargets: { calories: 2000, protein: 175, fat: 145 }, isComplete: false,
  };
  try {
    const raw = localStorage.getItem("carnivore-onboarding-answers");
    const complete = localStorage.getItem("carnivore-onboarding-complete") === "true";
    if (!raw || !complete) return defaults;
    const answers = JSON.parse(raw);

    // Parse body stats
    let body = defaultBody;
    try {
      const bodyRaw = localStorage.getItem("carnivore-onboarding-body");
      if (bodyRaw) {
        const b = JSON.parse(bodyRaw);
        body = {
          sex: SEX_MAP[b.sex as number] ?? "unspecified",
          age: parseNum(b.age),
          height: parseNum(b.height),
          weight: parseNum(b.weight),
          goalWeight: parseNum(b.goalWeight),
          healthTarget: typeof b.healthTarget === "string" ? b.healthTarget.slice(0, 200) : "",
        };
      }
    } catch { /* ignore */ }

    const goal = GOAL_MAP[answers[0] as number] ?? "improve_health";
    const activityLevel = ACTIVITY_MAP[answers[3] as number] ?? "light";
    const mealsPerDay = parseInt(localStorage.getItem("carnivore-meals-per-day") || "3") || 3;

    return {
      goal,
      experience: EXP_MAP[answers[1] as number] ?? "beginner",
      struggles: (answers[2] as number[])?.map((i) => STRUGGLE_MAP[i]).filter(Boolean) ?? [],
      activityLevel,
      interests: (answers[4] as number[])?.map((i) => INTEREST_MAP[i]).filter(Boolean) ?? [],
      body,
      mealsPerDay,
      nutritionTargets: computeTargets(goal, activityLevel, body),
      isComplete: true,
    };
  } catch {
    return defaults;
  }
}

const UserProfileContext = createContext<UserProfile | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(() => parseProfile());

  useEffect(() => {
    const handleStorage = () => setProfile(parseProfile());
    window.addEventListener("storage", handleStorage);
    window.addEventListener("profile-update", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("profile-update", handleStorage);
    };
  }, []);

  return (
    <UserProfileContext.Provider value={profile}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error("useUserProfile must be used within UserProfileProvider");
  return ctx;
};
