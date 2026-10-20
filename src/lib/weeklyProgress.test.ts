import { describe, expect, it } from "vitest";
import { aggregateWeeklyProgress, nextMondayMorning, previousWeekWindow, suppressServerWeekly, type WeeklyEntry } from "../../supabase/functions/_shared/weeklyProgress";

const monday = new Date("2026-10-19T13:00:00Z");
const now = new Date("2026-10-20T01:20:00Z");
const row = (category: string, metric: string, value = 1, recorded_at = "2026-10-18T16:00:00Z", notes = ""): WeeklyEntry => ({ category, metric, value, recorded_at, notes });
const stats = (entries: WeeklyEntry[], target: number | null = null) => aggregateWeeklyProgress(entries, target, monday, "America/Toronto", now);

describe("personalized Monday weekly summary", () => {
  it("counts a meal once across calories, protein, fat and carbs", () => {
    expect(stats([row("diet_trends", "calories", 650), row("diet_trends", "protein", 50), row("diet_trends", "fat", 45), row("diet_trends", "carbs", 5)]).meals).toBe(1);
  });
  it("counts four wellness ratings at a shared timestamp as one check-in", () => {
    expect(stats(["mood_score", "energy_level", "sleep_quality", "mental_clarity"].map(m => row("mood", m, 0))).checkIns).toBe(1);
  });
  it("counts separate meals and check-ins separately", () => {
    expect(stats([row("diet_trends", "calories", 650), row("diet_trends", "calories", 240, "2026-10-18T19:00:00Z"), row("mood", "mood_score"), row("mood", "energy_level", 2, "2026-10-18T19:00:00Z")])).toEqual({ meals: 2, checkIns: 2, proteinGoalDays: null });
  });
  it("uses the previous Monday to Monday local midnight window", () => {
    const window = previousWeekWindow(monday, "America/Toronto");
    expect(window.start.toISOString()).toBe("2026-10-12T04:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-10-19T04:00:00.000Z");
    expect(stats([row("diet_trends", "calories", 1, window.start.toISOString()), row("diet_trends", "calories", 1, window.end.toISOString())]).meals).toBe(1);
  });
  it("handles the 169-hour week across daylight saving ending", () => {
    const w = previousWeekWindow(new Date("2026-11-02T14:00:00Z"), "America/Toronto");
    expect((w.end.getTime() - w.start.getTime()) / 3600000).toBe(169);
  });
  it("does not shift the reporting week when delivery is delayed to Tuesday", () => {
    expect(stats([row("diet_trends", "calories", 650)]).meals).toBe(1);
  });
  it("excludes sample, invalid, out-of-window and future records", () => {
    expect(stats([row("diet_trends", "calories", 100, undefined, " Sample "), row("diet_trends", "calories", 100, "bad"), row("diet_trends", "calories", 100, "2026-10-21T16:00:00Z")]).meals).toBe(0);
    expect(aggregateWeeklyProgress([row("mood", "mood_score", 1, "2026-10-18T16:00:00Z")], null, monday, "America/Toronto", new Date("2026-10-17T00:00:00Z")).checkIns).toBe(0);
  });
  it("does not count isolated protein or fat readings as meals", () => {
    expect(stats([row("diet_trends", "protein", 50), row("diet_trends", "fat", 40)]).meals).toBe(0);
  });
  it("sums protein by local day and counts goal days only from recorded data", () => {
    expect(stats([row("diet_trends", "protein", 60), row("diet_trends", "protein", 40, "2026-10-18T19:00:00Z"), row("diet_trends", "protein", 90, "2026-10-17T19:00:00Z")], 100).proteinGoalDays).toBe(1);
  });
  it("does not claim goal progress without a valid target or protein readings", () => {
    expect(stats([row("diet_trends", "protein", 100)], 0).proteinGoalDays).toBeNull();
    expect(stats([row("diet_trends", "calories", 650)], 100).proteinGoalDays).toBeNull();
  });
  it("schedules Monday 9 AM locally before and after DST", () => {
    expect(nextMondayMorning(new Date("2026-10-20T01:20:00Z"), "America/Toronto").toISOString()).toBe("2026-10-26T13:00:00.000Z");
    expect(nextMondayMorning(new Date("2026-11-01T16:00:00Z"), "America/Toronto").toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });
  it("suppresses only the successfully scheduled matching weekly occurrence", () => {
    expect(suppressServerWeekly(monday.toISOString(), monday, "weekly_summary")).toBe(true);
    expect(suppressServerWeekly(null, monday, "weekly_summary")).toBe(false);
    expect(suppressServerWeekly("2026-10-12T13:00:00Z", monday, "weekly_summary")).toBe(false);
    expect(suppressServerWeekly(monday.toISOString(), monday, "daily_meal_reminder")).toBe(false);
  });
});