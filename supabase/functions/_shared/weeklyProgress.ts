// Pure calendar/aggregation logic shared by Android and the scheduled sender.
export interface WeeklyEntry {
  category: string;
  metric: string;
  value: number | string;
  recorded_at: string;
  notes?: string | null;
}

function parts(date: Date, timezone: string) {
  const values: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date)) {
    if (p.type !== "literal") values[p.type] = Number(p.value);
  }
  return values;
}

function wallClockUtc(year: number, month: number, day: number, hour: number, timezone: string) {
  const wall = Date.UTC(year, month - 1, day, hour);
  let instant = wall;
  for (let i = 0; i < 4; i++) {
    const p = parts(new Date(instant), timezone);
    const delta = wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += delta;
    if (delta === 0) break;
  }
  return new Date(instant);
}

export function previousWeekWindow(anchor: Date, timezone: string) {
  const p = parts(anchor, timezone);
  const calendar = new Date(Date.UTC(p.year, p.month - 1, p.day));
  calendar.setUTCDate(calendar.getUTCDate() - (calendar.getUTCDay() + 6) % 7);
  const end = wallClockUtc(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(), 0, timezone);
  calendar.setUTCDate(calendar.getUTCDate() - 7);
  const start = wallClockUtc(calendar.getUTCFullYear(), calendar.getUTCMonth() + 1, calendar.getUTCDate(), 0, timezone);
  return { start, end };
}

export function nextMondayMorning(now: Date, timezone: string) {
  const p = parts(now, timezone);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day));
  day.setUTCDate(day.getUTCDate() + (8 - day.getUTCDay()) % 7);
  let next = wallClockUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 9, timezone);
  if (next <= now) {
    day.setUTCDate(day.getUTCDate() + 7);
    next = wallClockUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 9, timezone);
  }
  return next;
}

export interface WeeklyStats { meals: number; checkIns: number; proteinGoalDays: number | null }

export function aggregateWeeklyProgress(
  entries: WeeklyEntry[], target: number | null, anchor: Date, timezone: string, now = new Date(),
): WeeklyStats {
  const { start, end } = previousWeekWindow(anchor, timezone);
  const meals = new Set<string>();
  const checkIns = new Set<string>();
  const proteinByDay = new Map<string, number>();
  const wellness = new Set(["mood_score", "energy_level", "sleep_quality", "mental_clarity"]);
  for (const e of entries) {
    const time = new Date(e.recorded_at).getTime();
    const value = Number(e.value);
    if (!Number.isFinite(time) || !Number.isFinite(value) || time < start.getTime() ||
      time >= end.getTime() || time > now.getTime() || e.notes?.trim().toLowerCase() === "sample") continue;
    // One calorie row per meal; all nutrients in a food log share a timestamp.
    // Manual protein/fat readings alone are not evidence of a logged meal.
    if (e.category === "diet_trends" && e.metric === "calories" && value > 0) meals.add(`${time}`);
    if (e.category === "mood" && wellness.has(e.metric)) checkIns.add(`${time}`);
    if (e.category === "diet_trends" && e.metric === "protein" && value >= 0) {
      const p = parts(new Date(time), timezone);
      const day = `${p.year}-${p.month}-${p.day}`;
      proteinByDay.set(day, (proteinByDay.get(day) ?? 0) + value);
    }
  }
  const hasGoal = target !== null && Number.isFinite(target) && target > 0;
  return {
    meals: meals.size, checkIns: checkIns.size,
    proteinGoalDays: hasGoal && proteinByDay.size ? [...proteinByDay.values()].filter(v => v >= target).length : null,
  };
}

export function weeklyProgressCopy(stats: WeeklyStats, locale: string) {
  const fr = locale.toLowerCase().startsWith("fr");
  const title = fr ? "Votre semaine en résumé" : "Your week in review";
  if (!stats.meals && !stats.checkIns) return { title, body: fr
    ? "Une nouvelle semaine commence. Notez un repas ou faites un bilan de bien-être pour reprendre le suivi."
    : "A fresh week starts today. Log a meal or a wellness check-in to get back into your rhythm." };
  let body = fr
    ? `La semaine dernière : ${stats.meals} repas et ${stats.checkIns} bilan${stats.checkIns === 1 ? "" : "s"} de bien-être enregistrés.`
    : `Last week you logged ${stats.meals} meal${stats.meals === 1 ? "" : "s"} and ${stats.checkIns} check-in${stats.checkIns === 1 ? "" : "s"}.`;
  if (stats.proteinGoalDays !== null && stats.proteinGoalDays > 0) body += fr
    ? ` Objectif de protéines atteint ${stats.proteinGoalDays} jour${stats.proteinGoalDays === 1 ? "" : "s"}.`
    : ` You met your protein goal on ${stats.proteinGoalDays} day${stats.proteinGoalDays === 1 ? "" : "s"}.`;
  body += fr ? " Continuez comme ça !" : " Keep up the great work!";
  return { title, body };
}

export function suppressServerWeekly(localOccurrence: string | null | undefined, occurrence: Date, preference: string) {
  return preference === "weekly_summary" && !!localOccurrence &&
    new Date(localOccurrence).getTime() === occurrence.getTime();
}