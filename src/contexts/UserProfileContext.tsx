import React, { createContext, useContext, useMemo } from "react";

export type Goal = "lose_weight" | "build_muscle" | "maintain" | "improve_health";
export type Experience = "beginner" | "tried_briefly" | "months_in" | "veteran";
export type Struggle = "sugar_cravings" | "low_energy" | "digestive" | "social_pressure";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";
export type Interest = "recipes" | "exercise" | "ketosis" | "mental_clarity";

export interface UserProfile {
  goal: Goal;
  experience: Experience;
  struggles: Struggle[];
  activityLevel: ActivityLevel;
  interests: Interest[];
  isComplete: boolean;
}

const GOAL_MAP: Goal[] = ["lose_weight", "build_muscle", "maintain", "improve_health"];
const EXP_MAP: Experience[] = ["beginner", "tried_briefly", "months_in", "veteran"];
const STRUGGLE_MAP: Struggle[] = ["sugar_cravings", "low_energy", "digestive", "social_pressure"];
const ACTIVITY_MAP: ActivityLevel[] = ["sedentary", "light", "moderate", "very_active"];
const INTEREST_MAP: Interest[] = ["recipes", "exercise", "ketosis", "mental_clarity"];

function parseProfile(): UserProfile {
  const defaults: UserProfile = {
    goal: "improve_health", experience: "beginner", struggles: [],
    activityLevel: "light", interests: [], isComplete: false,
  };
  try {
    const raw = localStorage.getItem("carnivore-onboarding-answers");
    const complete = localStorage.getItem("carnivore-onboarding-complete") === "true";
    if (!raw || !complete) return defaults;
    const answers = JSON.parse(raw);
    return {
      goal: GOAL_MAP[answers[0] as number] ?? "improve_health",
      experience: EXP_MAP[answers[1] as number] ?? "beginner",
      struggles: (answers[2] as number[])?.map((i) => STRUGGLE_MAP[i]).filter(Boolean) ?? [],
      activityLevel: ACTIVITY_MAP[answers[3] as number] ?? "light",
      interests: (answers[4] as number[])?.map((i) => INTEREST_MAP[i]).filter(Boolean) ?? [],
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
