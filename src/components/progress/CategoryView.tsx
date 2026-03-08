import { useState } from "react";
import { Plus, Crosshair, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgressEntries, useProgressGoals, METRICS, type ProgressCategory } from "@/hooks/useProgress";
import ProgressChart from "./ProgressChart";
import AddEntryDrawer from "./AddEntryDrawer";
import SetGoalDrawer from "./SetGoalDrawer";
import { format } from "date-fns";
import { useDeleteEntry } from "@/hooks/useProgress";

const RANGE_OPTIONS = [
  { label: "1 W", days: 7 },
  { label: "1 Mo", days: 30 },
  { label: "3 Mo", days: 90 },
  { label: "6 Mo", days: 180 },
  { label: "1 Yr", days: 365 },
];

interface Props {
  category: ProgressCategory;
}

const CategoryView = ({ category }: Props) => {
  const metrics = METRICS[category];
  const [range, setRange] = useState(30);
  const [showAdd, setShowAdd] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [activeMetric, setActiveMetric] = useState(metrics[0].key);

  const { data: entries = [], isLoading } = useProgressEntries(category, range);
  const { data: goals = [] } = useProgressGoals(category);
  const deleteEntry = useDeleteEntry();

  const currentMeta = metrics.find((m) => m.key === activeMetric)!;
  const currentGoal = goals.find((g) => g.metric === activeMetric);
  const metricEntries = entries.filter((e) => e.metric === activeMetric);
  const latestValue = metricEntries.length > 0 ? Number(metricEntries[metricEntries.length - 1].value) : null;

  // Calculate daily average
  const avg = metricEntries.length > 0
    ? Math.round((metricEntries.reduce((s, e) => s + Number(e.value), 0) / metricEntries.length) * 10) / 10
    : null;

  const goalPct = currentGoal && latestValue != null
    ? Math.round((latestValue / currentGoal.target_value) * 100)
    : null;

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex gap-2">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              range === r.days
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Metric tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveMetric(m.key)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeMetric === m.key
                ? "bg-card border border-primary/30 text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily Avg</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {avg ?? "—"}<span className="text-xs text-muted-foreground ml-1">{currentMeta.unit}</span>
          </p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Goal</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {currentGoal ? currentGoal.target_value : "—"}
            <span className="text-xs text-muted-foreground ml-1">{currentMeta.unit}</span>
          </p>
          {goalPct != null && (
            <span className={`text-[10px] font-bold ${goalPct >= 100 ? "text-green-500" : "text-primary"}`}>
              {goalPct}%
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl p-4 border border-border">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
        ) : (
          <ProgressChart entries={entries} metricKey={activeMetric} goal={currentGoal} />
        )}
      </div>

      {/* Recent entries */}
      {metricEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Recent Entries</p>
          </div>
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {[...metricEntries].reverse().slice(0, 10).map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{Number(e.value)} {e.unit}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(e.recorded_at), "MMM dd, h:mm a")}</p>
                  {e.notes && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{e.notes}</p>}
                </div>
                <button onClick={() => deleteEntry.mutate(e.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button onClick={() => setShowAdd(true)} className="flex-1 gap-2">
          <Plus size={16} /> Add Entry
        </Button>
        <Button variant="outline" onClick={() => setShowGoal(true)} className="gap-2">
          <Crosshair size={16} /> Goals
        </Button>
      </div>

      <AddEntryDrawer open={showAdd} onOpenChange={setShowAdd} category={category} />
      <SetGoalDrawer open={showGoal} onOpenChange={setShowGoal} category={category} />
    </div>
  );
};

export default CategoryView;
