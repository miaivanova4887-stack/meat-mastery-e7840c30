import { describe, it, expect } from "vitest";
import { getProgressGoalComparison } from "./progressGoal";

const now = new Date(2026, 9, 10, 15, 0, 0);
const at = (d: number, h: number) => new Date(2026, 9, d, h, 0, 0).toISOString();

describe("getProgressGoalComparison", () => {
  it("sums today's diet entries including zeros", () => {
    const r = getProgressGoalComparison(
      [{ value: 80, recorded_at: at(10, 8) }, { value: 0, recorded_at: at(10, 12) }, { value: 70, recorded_at: at(10, 14) }],
      "diet_trends", 150, now,
    );
    expect(r).toEqual({ value: 150, percentage: 100 });
  });

  it("keeps a lone zero entry as 0%", () => {
    expect(getProgressGoalComparison([{ value: 0, recorded_at: at(10, 9) }], "diet_trends", 20, now))
      .toEqual({ value: 0, percentage: 0 });
  });

  it("excludes yesterday and tomorrow", () => {
    const r = getProgressGoalComparison(
      [{ value: 500, recorded_at: at(9, 23) }, { value: 50, recorded_at: at(10, 10) }, { value: 500, recorded_at: at(11, 0) }],
      "diet_trends", 100, now,
    );
    expect(r).toEqual({ value: 50, percentage: 50 });
  });

  it("returns nulls when nothing logged today", () => {
    expect(getProgressGoalComparison([{ value: 50, recorded_at: at(9, 10) }], "diet_trends", 100, now))
      .toEqual({ value: null, percentage: null });
  });

  it("uses latest reading for body measurements", () => {
    const r = getProgressGoalComparison(
      [{ value: 82, recorded_at: at(8, 8) }, { value: 80, recorded_at: at(9, 8) }],
      "body_measurements", 80, now,
    );
    expect(r).toEqual({ value: 80, percentage: 100 });
  });

  it("ignores invalid dates and non-numeric values", () => {
    const r = getProgressGoalComparison(
      [{ value: "abc", recorded_at: at(10, 8) }, { value: 40, recorded_at: "nope" }, { value: 30, recorded_at: at(10, 9) }],
      "diet_trends", 60, now,
    );
    expect(r).toEqual({ value: 30, percentage: 50 });
  });

  it.each([0, -5, NaN, Infinity, undefined, null])("suppresses percentage for target %s", (t) => {
    const r = getProgressGoalComparison([{ value: 30, recorded_at: at(10, 9) }], "diet_trends", t as number, now);
    expect(r).toEqual({ value: 30, percentage: null });
  });
});
