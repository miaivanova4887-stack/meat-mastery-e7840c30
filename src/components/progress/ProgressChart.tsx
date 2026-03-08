import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";
import type { ProgressEntry, ProgressGoal } from "@/hooks/useProgress";

interface Props {
  entries: ProgressEntry[];
  metricKey: string;
  goal?: ProgressGoal;
  color?: string;
}

const ProgressChart = ({ entries, metricKey, goal, color = "hsl(var(--primary))" }: Props) => {
  const data = useMemo(() => {
    return entries
      .filter((e) => e.metric === metricKey)
      .map((e) => ({
        date: format(new Date(e.recorded_at), "MMM dd"),
        value: Number(e.value),
        time: format(new Date(e.recorded_at), "h:mm a"),
      }));
  }, [entries, metricKey]);

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
