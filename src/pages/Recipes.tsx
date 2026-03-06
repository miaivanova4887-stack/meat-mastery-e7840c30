import { ArrowLeft, Clock, Flame, Search, X, Bot, Plus, Trash2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { recipes, TIER_LABELS, MEAL_LABELS, type DietTier, type MealType, type CustomRecipe } from "@/data/recipes";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useCustomRecipes } from "@/hooks/useCustomRecipes";

const MULTIPLIERS = [1, 2, 3, 4] as const;

function scaleNumeric(value: string, multiplier: number): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const scaled = Math.round(num * multiplier);
  // Preserve suffix like "g"
  const suffix = value.replace(/[\d.]+/, "").trim();
  return `${scaled}${suffix}`;
}

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
  const { customRecipes, deleteRecipe } = useCustomRecipes();

  const [activeTier, setActiveTier] = useState<DietTier>(defaultTier);
  const [activeMeal, setActiveMeal] = useState<MealType | "all">("all");
  const [search, setSearch] = useState("");
  const [expandedCustom, setExpandedCustom] = useState<string | null>(null);

  const allRecipes = useMemo(() => {
    const custom = customRecipes.filter((r) => r.tier.includes(activeTier));
    const builtIn = recipes.filter((r) => r.tier.includes(activeTier));
    return { custom, builtIn };
  }, [activeTier, customRecipes]);

  const filtered = useMemo(() => {
    const filter = (list: typeof recipes) =>
      list.filter((r) => {
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

    return {
      custom: filter(customRecipes) as CustomRecipe[],
      builtIn: filter(recipes),
    };
  }, [activeTier, activeMeal, search, customRecipes]);

  const totalCount = filtered.custom.length + filtered.builtIn.length;

  const mealCounts = useMemo(() => {
    const all = [...recipes, ...customRecipes].filter((r) => r.tier.includes(activeTier));
    const counts: Record<string, number> = { all: all.length };
    for (const r of all) {
      counts[r.meal] = (counts[r.meal] || 0) + 1;
    }
    return counts;
  }, [activeTier, customRecipes]);

  const RecipeCard = ({ r, i, isCustom = false }: { r: any; i: number; isCustom?: boolean }) => {
    const custom = isCustom ? (r as CustomRecipe) : null;
    const isExpanded = custom && expandedCustom === custom.id;
    const cardKey = custom?.id || r.name;
    const mult = multipliers[cardKey] || 1;

    const setMult = (m: number) => setMultipliers((prev) => ({ ...prev, [cardKey]: m }));

    const scaledCal = scaleNumeric(r.cal, mult);
    const scaledProtein = scaleNumeric(r.protein, mult);
    const scaledFat = scaleNumeric(r.fat, mult);

    return (
      <div
        key={r.name + i}
        className="ios-card p-4 animate-fade-in-up"
        style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-foreground text-[15px] leading-tight">{r.name}</h3>
              {isCustom && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/20 text-foreground font-semibold">MY</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={11} /> {r.time}</span>
              <span className="flex items-center gap-1"><Flame size={11} /> {scaledCal} cal</span>
              {r.serving && <span className="text-[11px]">· {r.serving}{mult > 1 ? ` × ${mult}` : ""}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span className="text-[11px] font-semibold text-primary">{scaledProtein} P</span>
            <span className="text-[11px] font-medium text-muted-foreground">{scaledFat} F</span>
          </div>
        </div>

        {/* Portion multiplier */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <Users size={12} className="text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground mr-0.5">Servings</span>
          {MULTIPLIERS.map((m) => (
            <button
              key={m}
              onClick={() => setMult(m)}
              className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition-all ${
                mult === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}×
            </button>
          ))}
        </div>

        <p className="text-xs text-secondary-foreground/70 mt-2.5 leading-relaxed">{r.desc}</p>

        {/* Expandable custom recipe details */}
        {custom && (
          <>
            <button
              onClick={() => setExpandedCustom(isExpanded ? null : custom.id)}
              className="flex items-center gap-1 mt-2 text-[11px] text-primary font-medium"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isExpanded ? "Less" : "Ingredients & Steps"}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-3 border-t border-border/30 pt-3">
                {custom.ingredients.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Ingredients</p>
                    <ul className="space-y-0.5">
                      {custom.ingredients.map((ing, j) => (
                        <li key={j} className="text-xs text-muted-foreground">
                          {ing.amount && <span className="font-medium text-foreground">{ing.amount}</span>} {ing.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {custom.steps.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-foreground mb-1">Steps</p>
                    <ol className="space-y-1">
                      {custom.steps.map((step, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex gap-2">
                          <span className="text-primary font-bold flex-shrink-0">{j + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <button
                  onClick={() => deleteRecipe(custom.id)}
                  className="flex items-center gap-1.5 text-[11px] text-destructive font-medium mt-1"
                >
                  <Trash2 size={12} /> Delete recipe
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {r.tags.map((t: string) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Carnivore Recipes</h1>
        <button
          onClick={() => navigate("/create-recipe")}
          className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* AI Coach Banner */}
        <button
          onClick={() => navigate("/recipe-coach")}
          className="w-full ios-card p-3.5 flex items-center gap-3 hover:bg-secondary/60 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-[13px] font-semibold text-foreground">AI Recipe Coach</p>
            <p className="text-[11px] text-muted-foreground">Get personalised meal ideas based on your goals</p>
          </div>
          <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
        </button>

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
          <span className="text-xs text-muted-foreground">{totalCount} recipes</span>

          {/* Custom recipes first */}
          {filtered.custom.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">My Recipes</p>
              {filtered.custom.map((r, i) => (
                <RecipeCard key={r.id} r={r} i={i} isCustom />
              ))}
              {filtered.builtIn.length > 0 && (
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2">All Recipes</p>
              )}
            </>
          )}

          {filtered.builtIn.map((r, i) => (
            <RecipeCard key={r.name} r={r} i={i} />
          ))}

          {totalCount === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No recipes found. Try adjusting your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recipes;
