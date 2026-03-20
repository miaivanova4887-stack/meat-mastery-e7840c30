import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format, startOfWeek, startOfMonth, addDays, addWeeks, addMonths } from "date-fns";
import type { ProgressEntry, ProgressGoal } from "@/hooks/useProgress";

interface Props {
  entries: ProgressEntry[];
  metricKey: string;
  goal?: ProgressGoal;
  color?: string;
  rangeDays?: number;
  /** If true, values in each bucket are summed (e.g. daily calories). Otherwise averaged. */
  sumValues?: boolean;
}

type AggMode = "daily" | "weekly" | "monthly";

function getAggMode(days: number): AggMode {
  if (days <= 7) return "daily";
  if (days <= 30) return "weekly";
  return "monthly";
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bucketKey(date: Date, mode: AggMode): string {
  if (mode === "daily") return toLocalDateStr(date);
  if (mode === "weekly") return toLocalDateStr(startOfWeek(date, { weekStartsOn: 1 }));
  return format(startOfMonth(date), "yyyy-MM");
}

function parseDateKey(key: string): Date {
  const parts = key.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2] || 1);
}

function bucketLabel(key: string, mode: AggMode): string {
  const d = parseDateKey(key);
  if (mode === "monthly") return format(d, "MMM yy");
  return format(d, "MMM dd");
}

/** Generate all bucket keys from rangeStart to today so the chart always extends to the current date */
function generateAllBucketKeys(rangeDays: number, mode: AggMode, hasData: boolean): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to local midnight

  // If no data exists, only show buckets from today minus a small window
  const effectiveDays = hasData ? rangeDays : Math.min(rangeDays, 7);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - effectiveDays);
  const keys: string[] = [];
  let cursor = new Date(start);

  while (cursor <= today) {
    keys.push(bucketKey(cursor, mode));
    if (mode === "daily") cursor = addDays(cursor, 1);
    else if (mode === "weekly") cursor = addWeeks(cursor, 1);
    else cursor = addMonths(cursor, 1);
  }
  // Ensure today's bucket is included
  const todayKey = bucketKey(today, mode);
  if (!keys.includes(todayKey)) keys.push(todayKey);
  return [...new Set(keys)].sort();
}

const ProgressChart = ({ entries, metricKey, goal, color = "hsl(var(--primary))", rangeDays = 30, sumValues = false }: Props) => {
  const data = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - rangeDays);

    // Only include entries within the range
    const filtered = entries.filter((e) => {
      if (e.metric !== metricKey) return false;
      const entryDate = new Date(e.recorded_at);
      return entryDate >= rangeStart && entryDate <= new Date();
    });

    const mode = getAggMode(rangeDays);

    // Build buckets from data
    const buckets = new Map<string, number[]>();
    for (const e of filtered) {
      const key = bucketKey(new Date(e.recorded_at), mode);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(Number(e.value));
    }

    // Generate all keys — only extend full range if there's actual data
    const hasData = filtered.length > 0;
    const allKeys = generateAllBucketKeys(rangeDays, mode, hasData);

    return allKeys.map((key) => {
      const values = buckets.get(key);
      let value: number | null = null;
      if (values && values.length > 0) {
        const total = values.reduce((s, v) => s + v, 0);
        value = Math.round((sumValues ? total : total / values.length) * 10) / 10;
      }
      return {
        date: bucketLabel(key, mode),
        value,
      };
    });
  }, [entries, metricKey, rangeDays, sumValues]);

  if (data.length === 0) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-muted-foreground">
        <span className="text-3xl mb-2">📈</span>
        <p className="text-sm font-medium">No data yet</p>
        <p className="text-xs">Add your first entry to see trends</p>
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px",
              boxShadow: "0 8px 30px -10px hsl(var(--foreground) / 0.1)",
            }}
          />
          {goal && (
            <ReferenceLine
              y={goal.target_value}
              stroke="hsl(var(--gold))"
              strokeDasharray="6 4"
              strokeWidth={2}
              label={{ value: `Goal: ${goal.target_value}`, fill: "hsl(var(--gold))", fontSize: 10, position: "insideTopRight" }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#gradient-${metricKey})`}
            dot={{ r: 4, fill: color, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProgressChart;
