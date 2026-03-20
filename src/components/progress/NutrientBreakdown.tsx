import { useMemo } from "react";
import { useProgressEntries } from "@/hooks/useProgress";


const NutrientBreakdown = () => {
  const { data: entries = [] } = useProgressEntries("diet_trends", 1);

  const today = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayEntries = entries.filter((e) => {
      const d = new Date(e.recorded_at);
      const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return localDate === todayStr;
    });

    const cal = todayEntries.filter((e) => e.metric === "calories").reduce((s, e) => s + Number(e.value), 0);
    const protein = todayEntries.filter((e) => e.metric === "protein").reduce((s, e) => s + Number(e.value), 0);
    const fat = todayEntries.filter((e) => e.metric === "fat").reduce((s, e) => s + Number(e.value), 0);
    const meals = todayEntries.filter((e) => e.metric === "calories" && e.notes?.includes("[meal-sync]")).length;

    return { cal, protein, fat, meals };
  }, [entries]);

  const macros = [
    { label: "Calories", value: today.cal, unit: "kcal", color: "from-[hsl(var(--flame))] to-[hsl(var(--gold))]", icon: "🔥" },
    { label: "Protein", value: today.protein, unit: "g", color: "from-[hsl(var(--primary))] to-[hsl(var(--ember))]", icon: "🥩" },
    { label: "Fat", value: today.fat, unit: "g", color: "from-[hsl(var(--gold))] to-[hsl(var(--flame))]", icon: "🧈" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Today's Nutrition</h3>
        {today.meals > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            {today.meals} meal{today.meals > 1 ? "s" : ""} synced
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {macros.map((m) => (
          <div
            key={m.label}
            className="relative overflow-hidden rounded-xl p-3 border border-border bg-card"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${m.color} opacity-[0.06]`} />
            <div className="relative">
              <span className="text-lg">{m.icon}</span>
              <p className="text-xl font-bold text-foreground mt-1">
                {m.value > 0 ? Math.round(m.value) : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {m.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NutrientBreakdown;
