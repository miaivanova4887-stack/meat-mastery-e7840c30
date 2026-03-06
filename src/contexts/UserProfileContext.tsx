import React, { createContext, useContext, useMemo } from "react";

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

export interface UserProfile {
  goal: Goal;
  experience: Experience;
  struggles: Struggle[];
  activityLevel: ActivityLevel;
  interests: Interest[];
  body: BodyStats;
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

function parseProfile(): UserProfile {
  const defaultBody: BodyStats = { sex: "unspecified", age: null, height: null, weight: null, goalWeight: null, healthTarget: "" };
  const defaults: UserProfile = {
    goal: "improve_health", experience: "beginner", struggles: [],
    activityLevel: "light", interests: [], body: defaultBody, isComplete: false,
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

    return {
      goal: GOAL_MAP[answers[0] as number] ?? "improve_health",
      experience: EXP_MAP[answers[1] as number] ?? "beginner",
      struggles: (answers[2] as number[])?.map((i) => STRUGGLE_MAP[i]).filter(Boolean) ?? [],
      activityLevel: ACTIVITY_MAP[answers[3] as number] ?? "light",
      interests: (answers[4] as number[])?.map((i) => INTEREST_MAP[i]).filter(Boolean) ?? [],
      body,
      isComplete: true,
    };
  } catch {
    return defaults;
  }
}

const UserProfileContext = createContext<UserProfile | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const profile = useMemo(() => parseProfile(), []);
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
