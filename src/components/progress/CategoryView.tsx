import { useState, useMemo } from "react";
import { Plus, Crosshair, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProgressEntries, useProgressGoals, METRICS, type ProgressCategory } from "@/hooks/useProgress";
import ProgressChart from "./ProgressChart";
import AddEntryDrawer from "./AddEntryDrawer";
import SetGoalDrawer from "./SetGoalDrawer";
import { format } from "date-fns";
import { useDeleteEntry } from "@/hooks/useProgress";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useTranslation } from "react-i18next";

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

const CM_TO_IN = 0.393701;

const CategoryView = ({ category }: Props) => {
  const { t } = useTranslation();
  const allMetrics = METRICS[category];
  const profile = useUserProfile();
  const sex = profile.body.sex;

  const metrics = useMemo(() => {
    if (category !== "body_measurements") return allMetrics;
    return allMetrics.filter((m) => {
      if (m.key === "hips" && sex === "male") return false;
      return true;
    });
  }, [category, allMetrics, sex]);

  const [range, setRange] = useState(30);
  const [showAdd, setShowAdd] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [activeMetric, setActiveMetric] = useState(metrics[0]?.key || "");
  const [useImperial, setUseImperial] = useState(false);

  const { data: entries = [], isLoading } = useProgressEntries(category, range);
  const { data: goals = [] } = useProgressGoals(category);
  const deleteEntry = useDeleteEntry();

  const currentMeta = metrics.find((m) => m.key === activeMetric) || metrics[0];
  const currentGoal = currentMeta ? goals.find((g) => g.metric === activeMetric) : undefined;
  const metricEntries = currentMeta ? entries.filter((e) => e.metric === activeMetric) : [];
  const latestValue = metricEntries.length > 0 ? Number(metricEntries[metricEntries.length - 1].value) : null;

  const isMeasurement = currentMeta && category === "body_measurements" && ["cm", "kg"].includes(currentMeta.unit);
  const isCm = currentMeta?.unit === "cm";
  const isKg = currentMeta?.unit === "kg";

  const convertVal = (v: number) => {
    if (!useImperial) return v;
    if (isCm) return Math.round(v * CM_TO_IN * 10) / 10;
    if (isKg) return Math.round(v * 2.20462 * 10) / 10;
    return v;
  };

  const displayUnit = () => {
    if (!currentMeta || !useImperial) return currentMeta?.unit || "";
    if (isCm) return "in";
    if (isKg) return "lb";
    return currentMeta.unit;
  };

  const avg = useMemo(() => {
    if (metricEntries.length === 0) return null;
    const dailyMap = new Map<string, number>();
    for (const e of metricEntries) {
      const d = new Date(e.recorded_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dailyMap.set(key, (dailyMap.get(key) || 0) + Number(e.value));
    }
    const dailyTotals = Array.from(dailyMap.values());
    const rawAvg = dailyTotals.reduce((s, v) => s + v, 0) / dailyTotals.length;
    return Math.round(convertVal(rawAvg) * 10) / 10;
  }, [metricEntries, useImperial]);

  const goalPct = currentGoal && latestValue != null
    ? Math.round((latestValue / currentGoal.target_value) * 100)
    : null;

  // Translate metric label
  const metricLabel = (key: string) => t(`progress.metrics.${key}`, { defaultValue: key });

  if (!currentMeta) return null;

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

      {/* Metric tabs + unit toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide flex-1">
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
              {m.icon} {metricLabel(m.key)}
            </button>
          ))}
        </div>
        {isMeasurement && (
          <button
            onClick={() => setUseImperial((p) => !p)}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-secondary text-muted-foreground hover:text-foreground border border-border transition-all"
          >
            {useImperial ? "in/lb" : "cm/kg"}
          </button>
        )}
      </div>

      {/* Summary cards with gradient */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.06]" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t("progress.dailyAvg")}</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">{avg ?? "—"}</p>
            <span className="text-xs text-muted-foreground">{displayUnit()}</span>
          </div>
        </div>
        <div className="relative overflow-hidden bg-card rounded-xl p-4 border border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--gold))] to-[hsl(var(--flame))] opacity-[0.06]" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t("progress.goal")}</p>
            <p className="text-3xl font-bold text-foreground mt-1.5">
              {currentGoal ? (useImperial ? convertVal(currentGoal.target_value) : currentGoal.target_value) : "—"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{displayUnit()}</span>
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

      {/* Chart */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">{currentMeta.icon} {metricLabel(currentMeta.key)} {t("progress.trend")}</p>
          <p className="text-[10px] text-muted-foreground">{RANGE_OPTIONS.find(r => r.days === range)?.label} {t("progress.range")}</p>
        </div>
        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">{t("progress.loading")}</div>
        ) : (
          <ProgressChart entries={entries} metricKey={activeMetric} goal={currentGoal} rangeDays={range} sumValues={category === "diet_trends"} />
        )}
      </div>

      {/* Recent entries */}
      {metricEntries.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">{t("progress.recentEntries")}</p>
          </div>
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {[...metricEntries].reverse().slice(0, 10).map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{convertVal(Number(e.value))} {displayUnit()}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(e.recorded_at), "MMM dd, h:mm a")}</p>
                  {(() => {
                    // Hide the internal [meal-sync] <id> tag from the user — keep only
                    // the human-readable recipe name that follows it (if any).
                    const clean = e.notes?.replace(/^\[meal-sync\]\s*\S+\s*/, "").trim();
                    return clean ? (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{clean}</p>
                    ) : null;
                  })()}
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
          <Plus size={16} /> {t("progress.addEntry")}
        </Button>
        <Button variant="outline" onClick={() => setShowGoal(true)} className="gap-2 h-11">
          <Crosshair size={16} /> {t("progress.goals")}
        </Button>
      </div>

      <AddEntryDrawer open={showAdd} onOpenChange={setShowAdd} category={category} />
      <SetGoalDrawer open={showGoal} onOpenChange={setShowGoal} category={category} />
    </div>
  );
};

export default CategoryView;
