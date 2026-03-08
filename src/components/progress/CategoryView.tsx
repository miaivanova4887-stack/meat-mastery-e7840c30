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
  const [activeMetric, setActiveMetric] = useState(metrics[0]?.key || "");

  const { data: entries = [], isLoading } = useProgressEntries(category, range);
  const { data: goals = [] } = useProgressGoals(category);
  const deleteEntry = useDeleteEntry();

  const currentMeta = metrics.find((m) => m.key === activeMetric) || metrics[0];
  if (!currentMeta) return null;
  const currentGoal = goals.find((g) => g.metric === activeMetric);
  const metricEntries = entries.filter((e) => e.metric === activeMetric);
  const latestValue = metricEntries.length > 0 ? Number(metricEntries[metricEntries.length - 1].value) : null;

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
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Metric tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveMetric(m.key)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeMetric === m.key
                ? "bg-card border border-primary/30 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* Summary cards with gradient */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.06]" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Daily Avg</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">
              {avg ?? "—"}
            </p>
            <span className="text-xs text-muted-foreground">{currentMeta.unit}</span>
          </div>
        </div>
        <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--flame))] opacity-[0.06]" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Goal</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">
              {currentGoal ? currentGoal.target_value : "—"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{currentMeta.unit}</span>
              {goalPct != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  goalPct >= 100 ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                }`}>
                  {goalPct}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart - larger */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">{currentMeta.icon} {currentMeta.label} Trend</p>
          <p className="text-[10px] text-muted-foreground">{RANGE_OPTIONS.find(r => r.days === range)?.label} range</p>
        </div>
        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
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
        <Button onClick={() => setShowAdd(true)} className="flex-1 gap-2 h-11 shadow-md shadow-primary/10">
          <Plus size={16} /> Add Entry
        </Button>
        <Button variant="outline" onClick={() => setShowGoal(true)} className="gap-2 h-11">
          <Crosshair size={16} /> Goals
        </Button>
      </div>

      <AddEntryDrawer open={showAdd} onOpenChange={setShowAdd} category={category} />
      <SetGoalDrawer open={showGoal} onOpenChange={setShowGoal} category={category} />
    </div>
  );
};

export default CategoryView;
