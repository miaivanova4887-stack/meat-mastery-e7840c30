import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
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
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        No data yet. Add your first entry!
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          {goal && (
            <ReferenceLine
              y={goal.target_value}
              stroke="hsl(var(--destructive))"
              strokeDasharray="5 5"
              label={{ value: "Goal", fill: "hsl(var(--destructive))", fontSize: 10 }}
            />
          )}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 4, fill: color }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProgressChart;
