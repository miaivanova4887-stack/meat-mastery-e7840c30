import { ArrowLeft, Plus, X, Trash2, ShoppingCart, ChevronDown, Flame, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { useMealPlan, DAYS, MEAL_SLOTS, SLOT_LABELS, type DayKey, type MealSlot, type PlannedMeal } from "@/hooks/useMealPlan";
import { recipes, type Recipe } from "@/data/recipes";
import { useCustomRecipes } from "@/hooks/useCustomRecipes";
import { useShoppingBag } from "@/contexts/ShoppingBagContext";
import { toast } from "sonner";

const MealPlan = () => {
  const navigate = useNavigate();
  const { plan, assignMeal, removeMeal, clearDay, clearWeek, dayTotals } = useMealPlan();
  const { customRecipes } = useCustomRecipes();
  const { addItem, hasItem } = useShoppingBag();

  const [activeDay, setActiveDay] = useState<DayKey>(() => {
    const today = new Date().getDay();
    // JS: 0=Sun, 1=Mon... map to our Mon-Sun
    const idx = today === 0 ? 6 : today - 1;
    return DAYS[idx];
  });
  const [pickingSlot, setPickingSlot] = useState<MealSlot | null>(null);
  const [recipeSearch, setRecipeSearch] = useState("");

  const allRecipes = useMemo(() => [...customRecipes, ...recipes], [customRecipes]);

  const filteredRecipes = useMemo(() => {
    if (!recipeSearch) return allRecipes.slice(0, 20);
    const q = recipeSearch.toLowerCase();
    return allRecipes.filter(
      (r) => r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [allRecipes, recipeSearch]);

  const handlePick = (recipe: Recipe, slot: MealSlot) => {
    const meal: PlannedMeal = {
      recipeName: recipe.name,
      cal: recipe.cal,
      protein: recipe.protein,
      fat: recipe.fat,
      time: recipe.time,
      serving: recipe.serving,
    };
    assignMeal(activeDay, slot, meal);
    setPickingSlot(null);
    setRecipeSearch("");
    toast.success(`${recipe.name} → ${activeDay} ${slot}`);
  };

  // Generate ingredient list from the full week
  const weekIngredients = useMemo(() => {
    const ingredientSet = new Set<string>();
    for (const day of DAYS) {
      for (const slot of MEAL_SLOTS) {
        const m = plan[day][slot];
        if (!m) continue;
        // Find the recipe to get ingredients
        const recipe = allRecipes.find((r) => r.name === m.recipeName);
        if (recipe && "ingredients" in recipe && Array.isArray((recipe as any).ingredients)) {
          for (const ing of (recipe as any).ingredients) {
            if (ing.name) ingredientSet.add(ing.amount ? `${ing.amount} ${ing.name}` : ing.name);
          }
        }
        // For built-in recipes, extract from tags/name as basic ingredients
        if (recipe && !("ingredients" in recipe)) {
          ingredientSet.add(m.recipeName);
        }
      }
    }
    return Array.from(ingredientSet);
  }, [plan, allRecipes]);

  const totals = dayTotals(activeDay);

  const addAllToShoppingBag = () => {
    let added = 0;
    for (const ing of weekIngredients) {
      if (!hasItem(ing)) {
        addItem(ing);
        added++;
      }
    }
    if (added > 0) toast.success(`${added} items added to shopping bag`);
    else toast("All items already in bag");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Meal Plan</h1>
        <button
          onClick={() => { clearWeek(); toast("Week cleared"); }}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Clear Week
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Day Selector */}
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 scrollbar-hide">
          {DAYS.map((day) => {
            const dt = dayTotals(day);
            const isActive = activeDay === day;
            return (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl transition-all min-w-[52px] ${
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-xs font-bold">{day}</span>
                {dt.count > 0 && (
                  <span className={`text-[9px] mt-0.5 ${isActive ? "text-background/70" : "text-primary"}`}>
                    {dt.cal} cal
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day Summary */}
        {totals.count > 0 && (
          <div className="ios-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground">{activeDay} Totals</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Flame size={11} /> {totals.cal} cal</span>
              <span className="font-semibold text-primary">{totals.protein}g P</span>
              <span className="text-muted-foreground">{totals.fat}g F</span>
            </div>
          </div>
        )}

        {/* Meal Slots */}
        <div className="space-y-2.5">
          {MEAL_SLOTS.map((slot) => {
            const meal = plan[activeDay][slot];
            return (
              <div key={slot} className="ios-card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {SLOT_LABELS[slot]}
                  </span>
                  {meal && (
                    <button onClick={() => removeMeal(activeDay, slot)} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </button>
                  )}
                </div>

                {meal ? (
                  <div>
                    <h3 className="font-display font-bold text-foreground text-[15px]">{meal.recipeName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{meal.cal} cal</span>
                      <span className="font-semibold text-primary">{meal.protein} P</span>
                      <span>{meal.fat} F</span>
                      <span>· {meal.time}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setPickingSlot(slot)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-xs font-medium"
                  >
                    <Plus size={14} /> Add {slot}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick action: clear day */}
        {totals.count > 0 && (
          <button
            onClick={() => { clearDay(activeDay); toast(`${activeDay} cleared`); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors mx-auto"
          >
            <Trash2 size={12} /> Clear {activeDay}
          </button>
        )}

        {/* Ingredients List */}
        {weekIngredients.length > 0 && (
          <div className="ios-card p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-bold text-foreground">
                📝 Week's Ingredients
              </h2>
              <button
                onClick={addAllToShoppingBag}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold"
              >
                <ShoppingCart size={12} /> Add to Bag
              </button>
            </div>
            <div className="space-y-1.5">
              {weekIngredients.map((ing) => (
                <div key={ing} className="flex items-center justify-between py-1">
                  <span className="text-xs text-foreground">{ing}</span>
                  {hasItem(ing) ? (
                    <Check size={14} className="text-primary" />
                  ) : (
                    <button
                      onClick={() => addItem(ing)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recipe Picker Modal */}
      {pickingSlot && (
        <div className="fixed inset-0 z-50 bg-background/95 ios-blur flex flex-col">
          <div className="sticky top-0 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
            <button onClick={() => { setPickingSlot(null); setRecipeSearch(""); }} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h2 className="text-lg font-display font-bold flex-1">
              Pick {SLOT_LABELS[pickingSlot].split(" ")[1]}
            </h2>
          </div>

          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              placeholder="Search recipes…"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
            {filteredRecipes.map((r, i) => (
              <button
                key={r.name + i}
                onClick={() => handlePick(r, pickingSlot)}
                className="w-full ios-card p-3.5 text-left hover:bg-secondary/40 transition-colors"
              >
                <h3 className="font-display font-bold text-foreground text-[14px]">{r.name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{r.cal} cal</span>
                  <span className="font-semibold text-primary">{r.protein} P</span>
                  <span>{r.fat} F</span>
                  <span>· {r.time}</span>
                </div>
                <div className="flex gap-1 mt-1.5">
                  {r.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
                  ))}
                </div>
              </button>
            ))}
            {filteredRecipes.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">No recipes found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MealPlan;
