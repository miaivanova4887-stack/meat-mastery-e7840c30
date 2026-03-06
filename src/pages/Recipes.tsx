import { ArrowLeft, Clock, Flame, Search, X, Dumbbell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { recipes, TIER_LABELS, MEAL_LABELS, type DietTier, type MealType } from "@/data/recipes";
import { useUserProfile } from "@/contexts/UserProfileContext";

const tierFromProfile = (diet: string | undefined): DietTier | null => {
  if (diet === "lion") return "lion";
  if (diet === "strict") return "strict";
  if (diet === "animal_based") return "animal_based";
  return null;
};

const Recipes = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const defaultTier = tierFromProfile((profile as any).diet) ?? "strict";

  const [activeTier, setActiveTier] = useState<DietTier>(defaultTier);
  const [activeMeal, setActiveMeal] = useState<MealType | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (!r.tier.includes(activeTier)) return false;
      if (activeMeal !== "all" && r.meal !== activeMeal) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.desc.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeTier, activeMeal, search]);

  const mealCounts = useMemo(() => {
    const tierFiltered = recipes.filter((r) => r.tier.includes(activeTier));
    const counts: Record<string, number> = { all: tierFiltered.length };
    for (const r of tierFiltered) {
      counts[r.meal] = (counts[r.meal] || 0) + 1;
    }
    return counts;
  }, [activeTier]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Carnivore Recipes</h1>
        <span className="text-xs text-muted-foreground">{filtered.length} recipes</span>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search recipes, ingredients, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Diet Tier Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {(Object.keys(TIER_LABELS) as DietTier[]).map((tier) => (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                activeTier === tier
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {TIER_LABELS[tier]}
            </button>
          ))}
        </div>

        {/* Meal Type Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {(Object.keys(MEAL_LABELS) as (MealType | "all")[]).map((meal) => (
            <button
              key={meal}
              onClick={() => setActiveMeal(meal)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                activeMeal === meal
                  ? "bg-foreground text-background"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {MEAL_LABELS[meal]}
              {mealCounts[meal] ? ` (${mealCounts[meal]})` : ""}
            </button>
          ))}
        </div>

        {/* Recipe Cards */}
        <div className="space-y-3 pt-1">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No recipes found. Try adjusting your filters.
            </div>
          )}
          {filtered.map((r, i) => (
            <div
              key={r.name}
              className="ios-card p-4 animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-foreground text-[15px] leading-tight">{r.name}</h3>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock size={11} /> {r.time}</span>
                    <span className="flex items-center gap-1"><Flame size={11} /> {r.cal} cal</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="text-[11px] font-semibold text-primary">{r.protein} P</span>
                  <span className="text-[11px] font-medium text-muted-foreground">{r.fat} F</span>
                </div>
              </div>
              <p className="text-xs text-secondary-foreground/70 mt-2.5 leading-relaxed">{r.desc}</p>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {r.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Recipes;
