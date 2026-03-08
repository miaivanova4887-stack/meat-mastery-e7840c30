import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ProgressEntry {
  id: string;
  user_id: string;
  category: string;
  metric: string;
  value: number;
  unit: string;
  notes: string;
  recorded_at: string;
  created_at: string;
}

export interface ProgressGoal {
  id: string;
  user_id: string;
  category: string;
  metric: string;
  target_value: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export type ProgressCategory = "diet_trends" | "body_measurements" | "vitals" | "mood" | "symptoms";

export const METRICS: Record<ProgressCategory, { key: string; label: string; unit: string; icon: string }[]> = {
  diet_trends: [
    { key: "calories", label: "Calories", unit: "kcal", icon: "🔥" },
    { key: "protein", label: "Protein", unit: "g", icon: "🥩" },
    { key: "fat", label: "Fat", unit: "g", icon: "🧈" },
    { key: "carbs", label: "Carbs", unit: "g", icon: "🌾" },
  ],
  body_measurements: [
    { key: "weight", label: "Weight", unit: "kg", icon: "⚖️" },
    { key: "waist", label: "Waist", unit: "cm", icon: "📐" },
    { key: "chest", label: "Chest", unit: "cm", icon: "📐" },
    { key: "hips", label: "Hips", unit: "cm", icon: "📐" },
    { key: "body_fat", label: "Body Fat", unit: "%", icon: "📏" },
  ],
  vitals: [
    { key: "bp_systolic", label: "BP Systolic", unit: "mmHg", icon: "❤️" },
    { key: "bp_diastolic", label: "BP Diastolic", unit: "mmHg", icon: "❤️" },
    { key: "heart_rate", label: "Heart Rate", unit: "bpm", icon: "💓" },
    { key: "blood_glucose", label: "Blood Glucose", unit: "mg/dL", icon: "🩸" },
    { key: "ketones", label: "Ketones", unit: "mmol/L", icon: "⚡" },
  ],
  mood: [
    { key: "mood_score", label: "Mood", unit: "0-4", icon: "😊" },
    { key: "energy_level", label: "Energy", unit: "0-4", icon: "⚡" },
    { key: "sleep_quality", label: "Sleep Quality", unit: "0-4", icon: "😴" },
    { key: "mental_clarity", label: "Mental Clarity", unit: "0-4", icon: "🧠" },
  ],
  symptoms: [
    { key: "headache", label: "Headache", unit: "0-4", icon: "🤕" },
    { key: "bloating", label: "Bloating", unit: "0-4", icon: "🫃" },
    { key: "joint_pain", label: "Joint Pain", unit: "0-4", icon: "🦴" },
    { key: "fatigue", label: "Fatigue", unit: "0-4", icon: "😵" },
    { key: "cravings", label: "Cravings", unit: "0-4", icon: "🍫" },
  ],
};

export const CATEGORY_META: Record<ProgressCategory, { label: string; icon: string }> = {
  diet_trends: { label: "Diet Trends", icon: "📊" },
  body_measurements: { label: "Body Measurements", icon: "📏" },
  vitals: { label: "Vitals", icon: "❤️" },
  mood: { label: "Mood", icon: "😊" },
  symptoms: { label: "Symptoms", icon: "🩺" },
};

export function useProgressEntries(category: ProgressCategory, days = 30) {
  const { user } = useAuth();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  return useQuery({
    queryKey: ["progress-entries", category, days, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("progress_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", category)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as ProgressEntry[];
    },
    enabled: !!user,
  });
}

export function useProgressGoals(category: ProgressCategory) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress-goals", category, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("progress_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", category);
      if (error) throw error;
      return data as ProgressGoal[];
    },
    enabled: !!user,
  });
}

export function useAddEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (entry: { category: string; metric: string; value: number; unit: string; notes?: string; recorded_at?: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("progress_entries").insert({
        user_id: user.id,
        category: entry.category,
        metric: entry.metric,
        value: entry.value,
        unit: entry.unit,
        notes: entry.notes || "",
        recorded_at: entry.recorded_at || new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress-entries"] });
      toast.success("Entry saved");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpsertGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (goal: { category: string; metric: string; target_value: number; unit: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("progress_goals").upsert(
        { user_id: user.id, category: goal.category, metric: goal.metric, target_value: goal.target_value, unit: goal.unit, updated_at: new Date().toISOString() },
        { onConflict: "user_id,category,metric" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress-goals"] });
      toast.success("Goal updated");
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("progress_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress-entries"] });
      toast.success("Entry deleted");
    },
    onError: (e) => toast.error(e.message),
  });
}
