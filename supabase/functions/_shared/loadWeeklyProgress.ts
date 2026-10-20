import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aggregateWeeklyProgress, previousWeekWindow, weeklyProgressCopy, type WeeklyEntry } from "./weeklyProgress.ts";

export async function loadWeeklyProgress(
  admin: ReturnType<typeof createClient>, userId: string, anchor: Date, timezone: string, locale: string,
) {
  const window = previousWeekWindow(anchor, timezone);
  const entries: WeeklyEntry[] = [];
  // Explicit pagination: a heavy week can exceed the API's 1,000-row cap.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("progress_entries")
      .select("category, metric, value, recorded_at, notes")
      .eq("user_id", userId).in("category", ["diet_trends", "mood"])
      .gte("recorded_at", window.start.toISOString()).lt("recorded_at", window.end.toISOString())
      .order("id").range(offset, offset + 999);
    if (error) throw error;
    entries.push(...(data ?? []) as WeeklyEntry[]);
    if (!data || data.length < 1000) break;
  }
  const { data: goal, error } = await admin.from("progress_goals").select("target_value, unit")
    .eq("user_id", userId).eq("category", "diet_trends").eq("metric", "protein").maybeSingle();
  if (error) throw error;
  const target = goal?.unit === "g" ? Number(goal.target_value) : null;
  const stats = aggregateWeeklyProgress(entries, target, anchor, timezone);
  return { stats, ...weeklyProgressCopy(stats, locale) };
}