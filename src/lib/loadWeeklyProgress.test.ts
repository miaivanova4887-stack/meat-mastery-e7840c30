import { describe, it, expect, vi } from "vitest";
import { loadWeeklyProgress } from "../../supabase/functions/_shared/loadWeeklyProgress";

function fakeAdmin(entries: unknown[], goal: unknown = null, fail = false) {
  const ranges: number[] = [];
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "gte", "lt", "order"]) chain[method] = () => chain;
    chain.range = async (start: number, end: number) => {
      ranges.push(start);
      return { data: entries.slice(start, end + 1), error: fail ? new Error("read failed") : null };
    };
    chain.maybeSingle = async () => ({ data: table === "progress_goals" ? goal : null, error: null });
    return chain;
  });
  return { admin: { from } as unknown as Parameters<typeof loadWeeklyProgress>[0], ranges };
}

describe("weekly account data loader", () => {
  it("paginates beyond 1000 rows and returns exact meal/check-in counts", async () => {
    const entries = Array.from({ length: 1001 }, (_, i) => ({ category: "diet_trends", metric: "calories", value: 100, recorded_at: new Date(Date.parse("2026-10-18T16:00:00Z") + i * 1000).toISOString() }));
    entries.push({ category: "mood", metric: "mood_score", value: 3, recorded_at: "2026-10-18T16:00:00Z" });
    const { admin, ranges } = fakeAdmin(entries);
    const result = await loadWeeklyProgress(admin, "user", new Date("2026-10-19T13:00:00Z"), "America/Toronto", "fr");
    expect(result.stats.meals).toBe(1001);
    expect(result.stats.checkIns).toBe(1);
    expect(ranges).toEqual([0, 1000]);
  });
  it("propagates data errors instead of inventing zero activity", async () => {
    const { admin } = fakeAdmin([], null, true);
    await expect(loadWeeklyProgress(admin, "user", new Date("2026-10-19T13:00:00Z"), "UTC", "en")).rejects.toThrow("read failed");
  });
  it("does not compare a protein goal in unsupported units", async () => {
    const { admin } = fakeAdmin([{ category: "diet_trends", metric: "protein", value: 100, recorded_at: "2026-10-18T16:00:00Z" }], { target_value: 100, unit: "oz" });
    expect((await loadWeeklyProgress(admin, "user", new Date("2026-10-19T13:00:00Z"), "UTC", "en")).stats.proteinGoalDays).toBeNull();
  });
});