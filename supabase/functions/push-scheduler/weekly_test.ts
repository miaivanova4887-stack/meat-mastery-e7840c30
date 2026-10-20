import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadWeeklyProgress } from "../_shared/loadWeeklyProgress.ts";
import { aggregateWeeklyProgress, previousWeekWindow } from "../_shared/weeklyProgress.ts";

Deno.test("weekly loader reads through the real SDK with non-sending fixtures", async () => {
  const client = createClient("https://example.supabase.co", "test-key", {
    global: { fetch: async (url) => new Response(JSON.stringify(String(url).includes("progress_goals")
      ? null : [{ category: "diet_trends", metric: "calories", value: 650, recorded_at: "2026-10-18T16:00:00Z" }]),
      { headers: { "Content-Type": "application/json" } }) },
  });
  const summary = await loadWeeklyProgress(client, "user", new Date("2026-10-19T13:00:00Z"), "America/Toronto", "en");
  assertEquals(summary.stats.meals, 1);
  assertEquals(summary.stats.checkIns, 0);
});

Deno.test("weekly meal and wellness counts use local seven-day boundaries", () => {
  const anchor = new Date("2026-10-19T13:00:00Z");
  const window = previousWeekWindow(anchor, "America/Toronto");
  assertEquals(window.start.toISOString(), "2026-10-12T04:00:00.000Z");
  const recorded_at = "2026-10-18T16:00:00Z";
  const entries = [
    { category: "diet_trends", metric: "calories", value: 650, recorded_at },
    { category: "diet_trends", metric: "protein", value: 52, recorded_at },
    { category: "diet_trends", metric: "fat", value: 48, recorded_at },
    ...["mood_score", "energy_level", "sleep_quality", "mental_clarity"].map(metric => ({ category: "mood", metric, value: 3, recorded_at })),
  ];
  assertEquals(aggregateWeeklyProgress(entries, 50, anchor, "America/Toronto", anchor), { meals: 1, checkIns: 1, proteinGoalDays: 1 });
});