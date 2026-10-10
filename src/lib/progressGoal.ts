export interface GoalComparableEntry {
  value: number | string | null | undefined;
  recorded_at: string;
}

export interface GoalComparison {
  value: number | null;
  percentage: number | null;
}

const toNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pct = (value: number | null, target: unknown): number | null => {
  const t = toNum(target);
  if (value === null || t === null || t <= 0) return null;
  return Math.round((value / t) * 100);
};

/**
 * diet_trends → sum of today's entries (local midnight to next midnight).
 * Other categories → latest recorded reading.
 */
export function getProgressGoalComparison(
  entries: GoalComparableEntry[],
  category: string,
  target: number | null | undefined,
  now: Date = new Date(),
): GoalComparison {
  const valid = entries
    .map((e) => ({ v: toNum(e.value), t: new Date(e.recorded_at).getTime() }))
    .filter((e): e is { v: number; t: number } => e.v !== null && Number.isFinite(e.t));

  if (category === "diet_trends") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const today = valid.filter((e) => e.t >= start && e.t < end);
    if (today.length === 0) return { value: null, percentage: null };
    const total = Math.round(today.reduce((s, e) => s + e.v, 0) * 10) / 10;
    return { value: total, percentage: pct(total, target) };
  }

  if (valid.length === 0) return { value: null, percentage: null };
  const latest = valid.reduce((a, b) => (b.t >= a.t ? b : a));
  return { value: latest.v, percentage: pct(latest.v, target) };
}
