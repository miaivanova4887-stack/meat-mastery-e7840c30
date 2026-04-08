import { ArrowLeft, Plus, X, Trash2, ShoppingCart, ShoppingBag, Flame, Check, Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw, Camera, CalendarPlus } from "lucide-react";
import TeaserGate from "@/components/TeaserGate";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useMealPlan, DAYS, MEAL_SLOTS, SLOT_LABELS, activeSlots, type DayKey, type MealSlot, type PlannedMeal } from "@/hooks/useMealPlan";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { recipes, TIER_LABELS, type Recipe, type DietTier } from "@/data/recipes";
import { useCustomRecipes } from "@/hooks/useCustomRecipes";
import { useShoppingBag } from "@/contexts/ShoppingBagContext";
import { supabase } from "@/integrations/supabase/client";
import { MealImage } from "@/hooks/useMealImage";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useMealSync } from "@/hooks/useMealSync";
import { useSubscription } from "@/contexts/SubscriptionContext";
import heroPlan from "@/assets/hero-plan.jpg";

type AIMode = "single" | "daily" | "weekly";

/** Determine which meal slot is "now" based on time of day */
function getCurrentSlot(slots: MealSlot[]): MealSlot | null {
  const hour = new Date().getHours();
  // breakfast: 5-11, lunch: 11-15, dinner: 15-21, snack: 21-5
  if (slots.includes("breakfast") && hour >= 5 && hour < 11) return "breakfast";
  if (slots.includes("lunch") && hour >= 11 && hour < 15) return "lunch";
  if (slots.includes("dinner") && hour >= 15 && hour < 21) return "dinner";
  if (slots.includes("snack") && (hour >= 21 || hour < 5)) return "snack";
  // OMAD: dinner is always current during reasonable hours
  if (slots.length === 1) return slots[0];
  // 2 meals: lunch before 15, dinner after
  if (slots.length === 2) return hour < 15 ? slots[0] : slots[1];
  return null;
}

/** Check if activeDay is today */
function isToday(day: DayKey): boolean {
  const todayIdx = new Date().getDay();
  const idx = todayIdx === 0 ? 6 : todayIdx - 1;
  return DAYS[idx] === day;
}

const MealPlan = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { plan, assignMeal, removeMeal, clearDay, clearWeek, dayTotals, toggleCompleted, isCompleted, dayCompletionCount } = useMealPlan();
  const { customRecipes, addRecipe } = useCustomRecipes();
  const { addItem, hasItem, count: bagCount } = useShoppingBag();
  const profile = useUserProfile();
  const { syncMealToProgress } = useMealSync();
  const { hasAccess } = useSubscription();
  const canSnap = hasAccess("pro");
  const userSlots = useMemo(() => activeSlots(profile.mealsPerDay), [profile.mealsPerDay]);
  const { nutritionTargets } = profile;

  const [activeDay, setActiveDay] = useState<DayKey>(() => {
    const today = new Date().getDay();
    const idx = today === 0 ? 6 : today - 1;
    return DAYS[idx];
  });
  const [pickingSlot, setPickingSlot] = useState<MealSlot | null>(null);
  const [recipeSearch, setRecipeSearch] = useState("");

  // AI generation state
  const [showAI, setShowAI] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>("daily");
  const [aiTier, setAiTier] = useState<DietTier>("strict");
  const [aiPrefs, setAiPrefs] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Quick add recipe state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickSlot, setQuickSlot] = useState<MealSlot>("dinner");
  const [quickName, setQuickName] = useState("");
  const [quickCal, setQuickCal] = useState("");
  const [quickProtein, setQuickProtein] = useState("");
  const [quickFat, setQuickFat] = useState("");
  const [quickTime, setQuickTime] = useState("");
  const [quickServing, setQuickServing] = useState("");
  const [quickIngredients, setQuickIngredients] = useState([{ name: "", amount: "" }]);

  // Shopping list expanded
  const [shoppingExpanded, setShoppingExpanded] = useState(false);

  // Swipe state per slot
  const [swipedSlot, setSwipedSlot] = useState<MealSlot | null>(null);

  // Photo recognition state
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoSlot, setPhotoSlot] = useState<MealSlot | null>(null);

  // Current meal slot
  const currentSlot = useMemo(() => isToday(activeDay) ? getCurrentSlot(userSlots) : null, [activeDay, userSlots]);

  const allRecipes = useMemo(() => [...customRecipes, ...recipes], [customRecipes]);

  // Visual placement mode — recipe passed via route state from Recipes page
  const [assignRecipe, setAssignRecipe] = useState<PlannedMeal | null>(null);
  useEffect(() => {
    const state = location.state as { assignRecipe?: { name: string; cal: string; protein: string; fat: string; time: string; serving: string } } | null;
    if (state?.assignRecipe) {
      const r = state.assignRecipe;
      setAssignRecipe({
        recipeName: r.name,
        cal: r.cal,
        protein: r.protein,
        fat: r.fat,
        time: r.time,
        serving: r.serving,
      });
      // Clear the state so refreshing doesn't re-enter placement mode
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  const handlePlacementPick = useCallback((slot: MealSlot) => {
    if (!assignRecipe) return;
    assignMeal(activeDay, slot, assignRecipe);
    toast.success(`${assignRecipe.recipeName} → ${SLOT_LABELS[slot].replace(/^.*?\s/, "")} on ${activeDay}`);
    setAssignRecipe(null);
  }, [assignRecipe, activeDay, assignMeal]);

  // Recipe detail drawer
  const [detailMeal, setDetailMeal] = useState<{ day: DayKey; slot: MealSlot; meal: PlannedMeal } | null>(null);
  const detailRecipe = useMemo(() => {
    if (!detailMeal) return null;
    return allRecipes.find((r) => r.name === detailMeal.meal.recipeName) || null;
  }, [detailMeal, allRecipes]);

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

  // AI generation
  const generateAI = useCallback(async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meal-plan-ai", {
        body: {
          mode: aiMode,
          dietTier: aiTier,
          preferences: aiPrefs || undefined,
          mealsPerDay: profile.mealsPerDay,
          nutritionTargets,
          goal: profile.goal,
          cuisines: profile.cuisines?.length ? profile.cuisines : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const result = data.plan;

      const toMeal = (m: any): PlannedMeal => ({
        recipeName: String(m.recipeName || ""),
        cal: String(m.cal || "0"),
        protein: String(m.protein || "0g"),
        fat: String(m.fat || "0g"),
        time: String(m.time || "N/A"),
        serving: String(m.serving || "1 serving"),
      });

      if (aiMode === "single" && result?.meals?.[0]) {
        const m = result.meals[0];
        assignMeal(activeDay, m.slot || "dinner", toMeal(m));
        saveAIMealAsRecipe(m);
        toast.success(`AI recipe added to ${activeDay}!`);
      } else if (aiMode === "daily" && result?.meals) {
        for (const m of result.meals) {
          const slot = m.slot as MealSlot;
          if (MEAL_SLOTS.includes(slot)) {
            assignMeal(activeDay, slot, toMeal(m));
            saveAIMealAsRecipe(m);
          }
        }
        toast.success(`Daily plan generated for ${activeDay}!`);
      } else if (aiMode === "weekly" && result?.days) {
        for (const day of DAYS) {
          const dayData = result.days[day];
          if (dayData?.meals) {
            for (const m of dayData.meals) {
              const slot = m.slot as MealSlot;
              if (MEAL_SLOTS.includes(slot)) {
                assignMeal(day, slot, toMeal(m));
                saveAIMealAsRecipe(m);
              }
            }
          }
        }
        toast.success("Full week generated!");
      }

      setShowAI(false);
    } catch (e: any) {
      console.error("AI gen error:", e);
      toast.error(e?.message || "Failed to generate. Try again.");
    } finally {
      setAiLoading(false);
    }
  }, [aiMode, aiTier, aiPrefs, activeDay, assignMeal, profile, nutritionTargets]);

  const saveAIMealAsRecipe = (m: any) => {
    // Don't save if it already exists
    if (allRecipes.some((r) => r.name === m.recipeName)) return;
    addRecipe({
      id: crypto.randomUUID(),
      name: String(m.recipeName || "AI Recipe"),
      cal: String(m.cal || "0"),
      protein: String(m.protein || "0g"),
      fat: String(m.fat || "0g"),
      time: String(m.time || "N/A"),
      serving: String(m.serving || "1 serving"),
      desc: String(m.steps?.[0] || "AI-generated recipe"),
      tags: ["AI"],
      tier: [aiTier],
      meal: (m.slot as any) || "dinner",
      cravings: [],
      ingredients: m.ingredients || [],
      steps: m.steps || [],
      createdAt: new Date().toISOString(),
      isCustom: true,
    });
  };

  // Quick add custom recipe to plan
  const handleQuickAdd = () => {
    if (!quickName.trim()) { toast.error("Name required"); return; }
    const validIngs = quickIngredients.filter((i) => i.name.trim());

    const meal: PlannedMeal = {
      recipeName: quickName.trim(),
      cal: quickCal || "0",
      protein: quickProtein || "0g",
      fat: quickFat || "0g",
      time: quickTime || "N/A",
      serving: quickServing || "1 serving",
    };
    assignMeal(activeDay, quickSlot, meal);

    // Also save as custom recipe
    addRecipe({
      id: crypto.randomUUID(),
      name: quickName.trim(),
      cal: quickCal || "0",
      protein: quickProtein || "0g",
      fat: quickFat || "0g",
      time: quickTime || "N/A",
      serving: quickServing || "1 serving",
      desc: "Custom recipe",
      tags: ["Custom"],
      tier: ["strict"],
      meal: quickSlot === "snack" ? "snack" : quickSlot as any,
      cravings: [],
      ingredients: validIngs,
      steps: [],
      createdAt: new Date().toISOString(),
      isCustom: true,
    });

    toast.success(`${quickName} added to ${activeDay} ${quickSlot}`);
    setShowQuickAdd(false);
    setQuickName(""); setQuickCal(""); setQuickProtein(""); setQuickFat("");
    setQuickTime(""); setQuickServing("");
    setQuickIngredients([{ name: "", amount: "" }]);
  };

  // Photo food recognition
  const handlePhotoRecognize = useCallback(async (file: File, slot: MealSlot) => {
    setPhotoLoading(true);
    setPhotoSlot(slot);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:image/...;base64,
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("recognize-food", {
        body: { imageBase64: base64, dietTier: profile.goal },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const r = data.result;
      const meal: PlannedMeal = {
        recipeName: String(r.recipeName || ""),
        cal: String(r.cal || "0"),
        protein: String(r.protein || "0g"),
        fat: String(r.fat || "0g"),
        time: String(r.time || "N/A"),
        serving: String(r.serving || "1 serving"),
      };
      assignMeal(activeDay, slot, meal);

      // Save as custom recipe
      if (!allRecipes.some((rec) => rec.name === r.recipeName)) {
        addRecipe({
          id: crypto.randomUUID(),
          name: String(r.recipeName || "Photo Recipe"),
          cal: String(r.cal || "0"),
          protein: String(r.protein || "0g"),
          fat: String(r.fat || "0g"),
          time: String(r.time || "N/A"),
          serving: String(r.serving || "1 serving"),
          desc: String(r.description || "Recognized from photo"),
          tags: ["📸 Photo"],
          tier: ["strict"],
          meal: slot === "snack" ? "snack" : slot as any,
          cravings: [],
          ingredients: r.ingredients || [],
          steps: [],
          createdAt: new Date().toISOString(),
          isCustom: true,
        });
      }

      toast.success(`Recognized: ${r.recipeName} (${r.confidence} confidence)`);
    } catch (e: any) {
      console.error("Photo recognition error:", e);
      toast.error(e?.message || "Failed to recognize food");
    } finally {
      setPhotoLoading(false);
      setPhotoSlot(null);
    }
  }, [activeDay, assignMeal, addRecipe, allRecipes, profile.goal]);

  // Enhanced ingredient list with quantities
  const weekIngredients = useMemo(() => {
    const ingMap = new Map<string, { amount: string; count: number }>();
    for (const day of DAYS) {
      for (const slot of MEAL_SLOTS) {
        const m = plan[day][slot];
        if (!m) continue;
        const recipe = allRecipes.find((r) => r.name === m.recipeName);
        if (recipe && "ingredients" in recipe && Array.isArray((recipe as any).ingredients)) {
          for (const ing of (recipe as any).ingredients) {
            if (!ing.name) continue;
            const key = ing.name.toLowerCase();
            const existing = ingMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              ingMap.set(key, { amount: ing.amount || "", count: 1 });
            }
          }
        } else {
          // For built-in recipes without ingredients
          const key = m.recipeName.toLowerCase();
          if (!ingMap.has(key)) {
            ingMap.set(key, { amount: m.serving, count: 1 });
          } else {
            ingMap.get(key)!.count++;
          }
        }
      }
    }
    return Array.from(ingMap.entries()).map(([name, { amount, count }]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      amount,
      count,
      display: count > 1 ? `${amount ? amount + " " : ""}${name.charAt(0).toUpperCase() + name.slice(1)} (×${count})` : `${amount ? amount + " " : ""}${name.charAt(0).toUpperCase() + name.slice(1)}`,
    }));
  }, [plan, allRecipes]);

  const totals = dayTotals(activeDay);

  const addAllToShoppingBag = () => {
    let added = 0;
    for (const ing of weekIngredients) {
      if (!hasItem(ing.display)) {
        addItem(ing.display);
        added++;
      }
    }
    if (added > 0) toast.success(`${added} items added to shopping list`);
    else toast("All items already in shopping list");
  };

  const inputClass = "w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3 page-header" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">{t("mealPlan.title")}</h1>
        <button onClick={() => navigate("/shopping-bag")} className="relative text-primary hover:text-primary/80 mr-1">
          <ShoppingBag size={18} />
          {bagCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {bagCount > 9 ? "9+" : bagCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { clearWeek(); toast(t("mealPlan.weekCleared")); }}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          {t("mealPlan.clearWeek")}
        </button>
      </div>

      {/* Hero meal image */}
      <div className="relative w-full h-40 overflow-hidden">
        <img
          src={heroPlan}
          alt="Meal planning"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 mini-hero-overlay" />
        <div className="absolute bottom-3 left-4">
          <p className="text-xs text-muted-foreground font-medium">{t("mealPlan.planAhead")}</p>
          <p className="text-lg font-display font-bold text-foreground">{t("mealPlan.yourWeeklyFuel")}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Placement mode banner */}
        {assignRecipe && (
          <div className="ios-card p-3.5 flex items-center gap-3 border-2 border-primary/40 bg-primary/5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <CalendarPlus size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">Placing: {assignRecipe.recipeName}</p>
              <p className="text-[11px] text-muted-foreground">Tap a meal slot below to place it</p>
            </div>
            <button
              onClick={() => setAssignRecipe(null)}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
            >
              Cancel
            </button>
          </div>
        )}
        {/* AI Generator Banner */}
        <TeaserGate requiredTier="elite" featureName="AI Meal Planner">
          <button
            onClick={() => setShowAI(true)}
            className="w-full ios-card p-3.5 flex items-center gap-3 hover:bg-secondary/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-[13px] font-semibold text-foreground">{t("mealPlan.aiPlanner")}</p>
              <p className="text-[11px] text-muted-foreground">{t("mealPlan.aiPlannerDesc")}</p>
            </div>
            <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
          </button>
        </TeaserGate>

        {/* Day Selector */}
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day) => {
            const dt = dayTotals(day);
            const isActive = activeDay === day;
            const isTodayDay = isToday(day);
            const comp = dayCompletionCount(day, userSlots);
            return (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`flex flex-col items-center px-1 py-2 rounded-xl transition-all relative ${
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {isTodayDay && (
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
                <span className="text-xs font-bold">{day}</span>
                {dt.count > 0 && (
                  <span className={`text-[9px] mt-0.5 ${isActive ? "text-background/70" : "text-primary"}`}>
                    {comp.done}/{comp.total} ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Day Summary with targets */}
        <div className="ios-card p-3.5">
          <div className="mb-2">
            <span className="text-[11px] text-muted-foreground mb-1.5 block">
              Meals planned for {activeDay}
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    localStorage.setItem("carnivore-meals-per-day", String(n));
                    window.dispatchEvent(new Event("profile-update"));
                  }}
                  className={`flex-1 py-1.5 text-[11px] font-semibold transition-all rounded-xl ${
                    profile.mealsPerDay === n
                      ? "bg-foreground text-background"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n} {n === 1 ? "meal" : "meals"}
                </button>
              ))}
            </div>
          </div>
          {totals.count > 0 && (
            <div className="space-y-2">
              {/* Calories */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-16 shrink-0">
                  <Flame size={12} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">Cal</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${Math.min(100, (totals.cal / nutritionTargets.calories) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-medium text-foreground w-20 text-right">{totals.cal}/{nutritionTargets.calories}</span>
              </div>
              {/* Protein */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-16 shrink-0">
                  <span className="text-[11px] font-bold text-primary">P</span>
                  <span className="text-[11px] text-muted-foreground">Protein</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (totals.protein / nutritionTargets.protein) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-primary w-20 text-right">{totals.protein}g/{nutritionTargets.protein}g</span>
              </div>
              {/* Fat */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-16 shrink-0">
                  <span className="text-[11px] font-bold text-muted-foreground">F</span>
                  <span className="text-[11px] text-muted-foreground">Fat</span>
                </div>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/40 transition-all" style={{ width: `${Math.min(100, (totals.fat / nutritionTargets.fat) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground w-20 text-right">{totals.fat}g/{nutritionTargets.fat}g</span>
              </div>
            </div>
          )}
        </div>

        {/* Meal Slots */}
        <div className="space-y-2.5">
          {userSlots.map((slot) => {
            const meal = plan[activeDay][slot];
            const isSwiped = swipedSlot === slot;
            const isNow = currentSlot === slot;
            return (
              <div key={slot} className={`relative overflow-hidden rounded-2xl ${isNow ? "ring-2 ring-primary/40" : ""}`}>
                {/* Swipe-revealed actions */}
                {meal && (
                  <div className="absolute inset-y-0 right-0 flex items-stretch z-0">
                    <button
                      onClick={() => { setSwipedSlot(null); setPickingSlot(slot); setRecipeSearch(""); }}
                      className="w-16 flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground text-[10px] font-semibold"
                    >
                      <RefreshCw size={16} />
                      Change
                    </button>
                    <button
                      onClick={() => { setSwipedSlot(null); removeMeal(activeDay, slot); toast(`Removed from ${activeDay} ${slot}`); }}
                      className="w-16 flex flex-col items-center justify-center gap-1 bg-destructive text-destructive-foreground text-[10px] font-semibold"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}

                {/* Main card - slides left on swipe */}
                <div
                  className={`ios-card overflow-hidden relative z-10 bg-card transition-transform duration-200 ease-out ${isSwiped && meal ? "-translate-x-32" : "translate-x-0"}`}
                  onTouchStart={(e) => {
                    if (!meal) return;
                    const el = e.currentTarget as any;
                    el._touchStartX = e.touches[0].clientX;
                    el._touchStartY = e.touches[0].clientY;
                    el._swiping = false;
                  }}
                  onTouchMove={(e) => {
                    if (!meal) return;
                    const el = e.currentTarget as any;
                    if (el._touchStartX == null) return;
                    const dx = e.touches[0].clientX - el._touchStartX;
                    const dy = e.touches[0].clientY - el._touchStartY;
                    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
                      el._swiping = true;
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (!meal) return;
                    const el = e.currentTarget as any;
                    if (el._touchStartX == null) return;
                    const dx = e.changedTouches[0].clientX - el._touchStartX;
                    const wasSwiping = el._swiping;
                    el._touchStartX = null;
                    el._swiping = false;
                    if (wasSwiping) {
                      if (dx < -50) setSwipedSlot(slot);
                      else if (dx > 30) setSwipedSlot(null);
                    }
                  }}
                  onClick={() => {
                    if (assignRecipe && meal) {
                      // In placement mode, tapping occupied slot replaces it
                      handlePlacementPick(slot);
                    } else if (meal && !swipedSlot) {
                      setDetailMeal({ day: activeDay, slot, meal });
                    } else if (swipedSlot) {
                      setSwipedSlot(null);
                    }
                  }}
                >
                  {meal && (
                    <MealImage recipeName={meal.recipeName} className="w-full h-32" />
                  )}

                  <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {SLOT_LABELS[slot]}
                      </span>
                      {isNow && (
                        <span className="text-[9px] font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-full animate-pulse">
                          NOW
                        </span>
                      )}
                    </div>
                    {meal && (
                      <span className="text-[9px] text-muted-foreground/60">← swipe</span>
                    )}
                  </div>

                  {meal ? (
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const wasCompleted = isCompleted(activeDay, slot);
                          toggleCompleted(activeDay, slot);
                          if (meal) syncMealToProgress(meal, wasCompleted);
                        }}
                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isCompleted(activeDay, slot)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border/60 text-transparent hover:border-primary/40"
                        }`}
                      >
                        <Check size={12} />
                      </button>
                      <div className={`flex-1 ${isCompleted(activeDay, slot) ? "opacity-60" : ""}`}>
                        <h3 className={`font-display font-bold text-[15px] ${isCompleted(activeDay, slot) ? "text-primary" : "text-foreground"}`}>
                          {isCompleted(activeDay, slot) && <Check size={13} className="inline mr-1 -mt-0.5" />}
                          {meal.recipeName}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{meal.cal} cal</span>
                          <span className="font-semibold text-primary">{meal.protein} P</span>
                          <span>{meal.fat} F</span>
                          <span>· {meal.time}</span>
                        </div>
                      </div>
                      <label
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canSnap) {
                            e.preventDefault();
                            toast("Snap & Log is a Pro feature", { action: { label: "Upgrade", onClick: () => navigate("/pricing") } });
                          }
                        }}
                        className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors cursor-pointer ${!canSnap ? "opacity-40" : ""} ${photoLoading && photoSlot === slot ? "opacity-50 pointer-events-none" : ""}`}
                        title="Re-snap photo"
                      >
                        {photoLoading && photoSlot === slot ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                        {canSnap && (
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoRecognize(file, slot);
                              e.target.value = "";
                            }}
                          />
                        )}
                      </label>
                    </div>
                  ) : assignRecipe ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePlacementPick(slot); }}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-primary/50 text-primary bg-primary/5 hover:bg-primary/10 transition-all text-sm font-semibold animate-pulse"
                    >
                      <CalendarPlus size={16} /> + Add here
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPickingSlot(slot); }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-xs font-medium"
                      >
                        <Plus size={14} /> Pick Recipe
                      </button>
                      <label
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canSnap) {
                            e.preventDefault();
                            toast("Snap & Log is a Pro feature", { action: { label: "Upgrade", onClick: () => navigate("/pricing") } });
                          }
                        }}
                        className={`px-3 py-3 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-xs font-medium cursor-pointer flex items-center justify-center ${!canSnap ? "opacity-40" : ""} ${photoLoading && photoSlot === slot ? "opacity-50 pointer-events-none" : ""}`}
                        title="Snap food photo"
                      >
                        {photoLoading && photoSlot === slot ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                        {canSnap && (
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePhotoRecognize(file, slot);
                              e.target.value = "";
                            }}
                          />
                        )}
                      </label>
                      <button
                        onClick={(e) => { e.stopPropagation(); setQuickSlot(slot); setShowQuickAdd(true); }}
                        className="px-3 py-3 rounded-xl border-2 border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors text-xs font-medium"
                        title="Add custom"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Clear day */}
        {totals.count > 0 && (
          <button
            onClick={() => { clearDay(activeDay); toast(`${activeDay} cleared`); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors mx-auto"
          >
            <Trash2 size={12} /> Clear {activeDay}
          </button>
        )}

        {/* Shopping List with quantities */}
        {weekIngredients.length > 0 && (
          <div className="ios-card p-4 mt-4">
            <button
              onClick={() => setShoppingExpanded(!shoppingExpanded)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-sm font-display font-bold text-foreground">
                🛒 Shopping List ({weekIngredients.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); addAllToShoppingBag(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold"
                >
                  <ShoppingCart size={12} /> Add All
                </button>
                {shoppingExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </div>
            </button>
            {shoppingExpanded && (
              <div className="mt-3 space-y-1.5 border-t border-border/30 pt-3">
                {weekIngredients.map((ing) => (
                  <div key={ing.display} className="flex items-center justify-between py-1">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-foreground">{ing.name}</span>
                      {ing.amount && <span className="text-[10px] text-muted-foreground ml-1.5">({ing.amount}{ing.count > 1 ? ` ×${ing.count}` : ""})</span>}
                      {!ing.amount && ing.count > 1 && <span className="text-[10px] text-muted-foreground ml-1.5">(×{ing.count})</span>}
                    </div>
                    {hasItem(ing.display) ? (
                      <Check size={14} className="text-primary flex-shrink-0" />
                    ) : (
                      <button
                        onClick={() => addItem(ing.display)}
                        className="text-muted-foreground hover:text-primary flex-shrink-0"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipe Picker Modal */}
      {pickingSlot && (
        <div className="fixed inset-0 z-50 bg-background/95 ios-blur flex flex-col">
          <div className="sticky top-0 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 py-3 flex items-center gap-3">
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
              className={inputClass}
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

      {/* AI Generator Modal */}
      {showAI && (
        <div className="fixed inset-0 z-50 bg-background/95 ios-blur flex flex-col">
          <div className="sticky top-0 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 py-3 flex items-center gap-3">
            <button onClick={() => setShowAI(false)} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h2 className="text-lg font-display font-bold flex-1">
              <Sparkles size={16} className="inline mr-1.5 text-primary" />
              AI Meal Planner
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-4">
            {/* Mode */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Generate</label>
              <div className="flex gap-2">
                {([
                  { key: "single", label: "🍽️ Single Recipe" },
                  { key: "daily", label: "📋 Full Day" },
                  { key: "weekly", label: "📅 Full Week" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setAiMode(key)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      aiMode === key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Diet tier */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Diet Tier</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(TIER_LABELS) as DietTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setAiTier(tier)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      aiTier === tier ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {TIER_LABELS[tier]}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferences */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Preferences (optional)</label>
              <textarea
                value={aiPrefs}
                onChange={(e) => setAiPrefs(e.target.value)}
                placeholder="e.g. high protein, sweet treats, quick meals, seafood focus, under 30 min..."
                className={`${inputClass} resize-none`}
                rows={3}
              />
            </div>

            {/* Info */}
            <div className="ios-card p-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {aiMode === "single" && `AI will generate 1 recipe and add it to ${activeDay}'s plan.`}
                {aiMode === "daily" && `AI will fill ${profile.mealsPerDay} meal slots for ${activeDay} targeting ${nutritionTargets.calories} cal.`}
                {aiMode === "weekly" && `AI will generate ${profile.mealsPerDay} meals/day for all 7 days targeting ${nutritionTargets.calories} cal/day.`}
                {" "}Personalized to your goal: {String(profile.goal).replace("_", " ")}.
              </p>
            </div>

            {/* Generate button */}
            <button
              onClick={generateAI}
              disabled={aiLoading}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating{aiMode === "weekly" ? " (may take ~15s)" : ""}…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate {aiMode === "single" ? "Recipe" : aiMode === "daily" ? "Day Plan" : "Week Plan"}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Recipe Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 bg-background/95 ios-blur flex flex-col">
          <div className="sticky top-0 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 py-3 flex items-center gap-3">
            <button onClick={() => setShowQuickAdd(false)} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h2 className="text-lg font-display font-bold flex-1">Add Your Own Recipe</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Recipe Name *</label>
              <input value={quickName} onChange={(e) => setQuickName(e.target.value)} placeholder="e.g. My Ribeye Special" className={inputClass} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Calories</label>
                <input value={quickCal} onChange={(e) => setQuickCal(e.target.value)} placeholder="500" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Cook Time</label>
                <input value={quickTime} onChange={(e) => setQuickTime(e.target.value)} placeholder="20 min" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Protein</label>
                <input value={quickProtein} onChange={(e) => setQuickProtein(e.target.value)} placeholder="40g" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Fat</label>
                <input value={quickFat} onChange={(e) => setQuickFat(e.target.value)} placeholder="30g" className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Serving</label>
              <input value={quickServing} onChange={(e) => setQuickServing(e.target.value)} placeholder="1 serving" className={inputClass} />
            </div>

            {/* Ingredients with amounts */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Ingredients</label>
              {quickIngredients.map((ing, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input
                    value={ing.amount}
                    onChange={(e) => {
                      const arr = [...quickIngredients];
                      arr[i] = { ...arr[i], amount: e.target.value };
                      setQuickIngredients(arr);
                    }}
                    placeholder="8 oz"
                    className={`${inputClass} w-24`}
                  />
                  <input
                    value={ing.name}
                    onChange={(e) => {
                      const arr = [...quickIngredients];
                      arr[i] = { ...arr[i], name: e.target.value };
                      setQuickIngredients(arr);
                    }}
                    placeholder="Ribeye steak"
                    className={`${inputClass} flex-1`}
                  />
                  {quickIngredients.length > 1 && (
                    <button onClick={() => setQuickIngredients(quickIngredients.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setQuickIngredients([...quickIngredients, { name: "", amount: "" }])}
                className="text-xs text-primary font-medium flex items-center gap-1 mt-1"
              >
                <Plus size={12} /> Add ingredient
              </button>
            </div>

            <button
              onClick={handleQuickAdd}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all active:scale-[0.97]"
            >
              Add to {activeDay} · {SLOT_LABELS[quickSlot]}
            </button>
          </div>
        </div>
      )}

      {/* Recipe Detail Bottom Sheet */}
      <Drawer open={!!detailMeal} onOpenChange={(open) => { if (!open) setDetailMeal(null); }}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-xl">{detailMeal?.meal.recipeName}</DrawerTitle>
            <DrawerDescription>
              {detailMeal?.day} · {detailMeal?.slot ? SLOT_LABELS[detailMeal.slot] : ""}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto space-y-4">
            {/* Macros */}
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1"><Flame size={14} className="text-primary" /> {detailMeal?.meal.cal} cal</span>
              <span className="font-semibold text-primary">{detailMeal?.meal.protein} P</span>
              <span className="text-muted-foreground">{detailMeal?.meal.fat} F</span>
              <span className="text-muted-foreground">· {detailMeal?.meal.time}</span>
            </div>
            <div className="text-xs text-muted-foreground">Serving: {detailMeal?.meal.serving}</div>

            {/* Description */}
            {detailRecipe?.desc && (
              <p className="text-sm text-foreground leading-relaxed">{detailRecipe.desc}</p>
            )}

            {/* Ingredients */}
            {detailRecipe && "ingredients" in detailRecipe && Array.isArray((detailRecipe as any).ingredients) && (detailRecipe as any).ingredients.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ingredients</h3>
                <ul className="space-y-1.5">
                  {(detailRecipe as any).ingredients.map((ing: any, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {ing.amount && <span className="font-medium">{ing.amount}</span>}
                      <span>{ing.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Steps */}
            {detailRecipe && "steps" in detailRecipe && Array.isArray((detailRecipe as any).steps) && (detailRecipe as any).steps.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Instructions</h3>
                <ol className="space-y-2">
                  {(detailRecipe as any).steps.map((step: string, i: number) => (
                    <li key={i} className="flex gap-3 text-sm text-foreground">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tags */}
            {detailRecipe?.tags && detailRecipe.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {detailRecipe.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
              <button
                onClick={() => {
                  if (detailMeal) {
                    setDetailMeal(null);
                    setPickingSlot(detailMeal.slot);
                    setRecipeSearch("");
                  }
                }}
                className="flex-1 py-3 rounded-2xl bg-secondary text-foreground font-semibold text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Change
              </button>
              <button
                onClick={() => {
                  if (detailMeal) {
                    removeMeal(detailMeal.day, detailMeal.slot);
                    toast(`Removed from ${detailMeal.day} ${detailMeal.slot}`);
                    setDetailMeal(null);
                  }
                }}
                className="py-3 px-6 rounded-2xl bg-destructive/10 text-destructive font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default MealPlan;
