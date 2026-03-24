import { ArrowLeft, Clock, Flame, Search, X, ChefHat, Plus, Trash2, ChevronDown, ChevronUp, Users, ShoppingBag, Heart, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo, useCallback, useEffect } from "react";
import { recipes, TIER_LABELS, CRAVING_LABELS, CUISINE_LABELS, type DietTier, type MealType, type CravingType, type CuisineType, type CustomRecipe, type Ingredient } from "@/data/recipes";
import { useTranslation } from "react-i18next";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { useCustomRecipes } from "@/hooks/useCustomRecipes";
import { useShoppingBag, parseAmount } from "@/contexts/ShoppingBagContext";
import { MealImage } from "@/hooks/useMealImage";
import { toast } from "sonner";
import { useFavorites } from "@/hooks/useFavorites";
import heroMealMale from "@/assets/hero-meal-male.jpg";
import heroMealFemale from "@/assets/hero-meal-female.jpg";

const MULTIPLIERS = [1, 2, 3, 4] as const;

function scaleNumeric(value: string | number, multiplier: number): string {
  const str = String(value ?? "0");
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  const scaled = Math.round(num * multiplier);
  const suffix = str.replace(/[\d.]+/, "").trim();
  return `${scaled}${suffix}`;
}

const tierFromProfile = (diet: string | undefined): DietTier | null => {
  if (diet === "lion") return "lion";
  if (diet === "strict") return "strict";
  if (diet === "animal_based") return "animal_based";
  return null;
};

// Snack is now in the upper craving-style menu, not in meal breakdown
const UPPER_MENU: Record<string, string> = {
  all: "🔥 All",
  snack: "🍖 Snacks",
  ...CRAVING_LABELS,
};
// Remove "all" duplicate from CRAVING_LABELS since we include it above
delete (UPPER_MENU as any)["all"];
const FINAL_MENU: Record<string, string> = { all: "🔥 All", snack: "🍖 Snacks" };
for (const [k, v] of Object.entries(CRAVING_LABELS)) {
  if (k !== "all") FINAL_MENU[k] = v;
}

const Recipes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = useUserProfile();
  const { t } = useTranslation();
  const defaultTier = tierFromProfile((profile as any).diet) ?? "strict";
  const { customRecipes, deleteRecipe } = useCustomRecipes();
  const { addItem, hasItem, count: bagCount } = useShoppingBag();
  const { toggleFavorite, isFavorite } = useFavorites();

  const [activeTier, setActiveTier] = useState<DietTier>(defaultTier);
  const [activeFilter, setActiveFilter] = useState<string>("all"); // "all" | "snack" | CravingType
  const [activeCuisine, setActiveCuisine] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Read tag from URL search params
  useEffect(() => {
    const tagParam = searchParams.get("tag");
    if (tagParam) {
      setActiveTag(tagParam);
      setSearch(""); // clear text search when filtering by tag
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const userCuisines = profile.cuisines || [];
    const filter = (list: typeof recipes) => {
      const matches = list.filter((r) => {
        const recipeTags = Array.isArray(r.tags) ? r.tags : [];

        // Diet tier filter
        if (!r.tier.includes(activeTier)) return false;
        // Upper menu filter
        if (activeFilter === "snack") {
          if (r.meal !== "snack") return false;
        } else if (activeFilter !== "all") {
          if (!(r.cravings || []).includes(activeFilter as CravingType)) return false;
        }
        // Cuisine filter
        if (activeCuisine !== "all") {
          if (!(r.cuisine || []).includes(activeCuisine as CuisineType)) return false;
        }
        // Tag filter
        if (activeTag) {
          if (!recipeTags.some((t) => t.toLowerCase() === activeTag.toLowerCase())) return false;
        }
        // Search
        if (search) {
          const q = search.toLowerCase();
          return r.name.toLowerCase().includes(q) || recipeTags.some((t) => t.toLowerCase().includes(q)) || r.desc.toLowerCase().includes(q);
        }
        // Favorites filter
        if (showFavoritesOnly && !isFavorite(r.name)) return false;
        return true;
      });

      // Sort: cuisine-matching recipes first when no specific cuisine filter
      if (activeCuisine === "all" && userCuisines.length > 0) {
        matches.sort((a, b) => {
          const aMatch = (a.cuisine || []).some(c => userCuisines.includes(c)) ? 1 : 0;
          const bMatch = (b.cuisine || []).some(c => userCuisines.includes(c)) ? 1 : 0;
          return bMatch - aMatch;
        });
      }
      return matches;
    };

    return {
      custom: filter(customRecipes) as CustomRecipe[],
      builtIn: filter(recipes),
    };
  }, [activeTier, activeFilter, activeCuisine, search, customRecipes, profile.cuisines, showFavoritesOnly, isFavorite, activeTag]);

  const totalCount = filtered.custom.length + filtered.builtIn.length;

  const addIngredientsToCart = useCallback((ingredients: Ingredient[], mult: number) => {
    ingredients.forEach(ing => {
      const parsed = parseAmount(ing.amount);
      addItem(ing.name, parsed.quantity * mult, parsed.unit);
    });
    toast.success(`${ingredients.length} ingredients added to shopping list`, {
      action: { label: "Open list", onClick: () => navigate("/shopping-bag") },
    });
  }, [addItem, navigate]);

  const handleTagClick = (tag: string) => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (activeTag === tag) {
      setActiveTag(null);
      navigate("/recipes", { replace: true });
    } else {
      setActiveTag(tag);
      navigate(`/recipes?tag=${encodeURIComponent(tag)}`, { replace: true });
    }
  };

  const RecipeCard = ({ r, i, isCustom = false }: { r: any; i: number; isCustom?: boolean }) => {
    const custom = isCustom ? (r as CustomRecipe) : null;
    const cardKey = custom?.id || r.name;
    const isExpanded = expanded === cardKey;
    const mult = multipliers[cardKey] || 1;
    const setMult = (m: number) => setMultipliers((prev) => ({ ...prev, [cardKey]: m }));
    const recipeTags: string[] = Array.isArray(r.tags) ? r.tags : [];

    const scaledCal = scaleNumeric(r.cal, mult);
    const scaledProtein = scaleNumeric(r.protein, mult);
    const scaledFat = scaleNumeric(r.fat, mult);

    const ingredients: Ingredient[] = Array.isArray(custom?.ingredients)
      ? custom.ingredients
      : Array.isArray(r.ingredients)
        ? r.ingredients
        : [];

    return (
      <div key={r.name + i} className="ios-card overflow-hidden animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 10) * 0.03}s` }}>
        {/* Full-width hero image */}
        <MealImage recipeName={r.name} tags={recipeTags} className="w-full h-40" />

        <div className="p-5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-foreground text-base leading-tight">{r.name}</h3>
              {isCustom && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/20 text-foreground font-semibold">MY</span>}
            </div>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={13} /> {r.time}</span>
              <span className="flex items-center gap-1"><Flame size={13} /> {scaledCal} cal</span>
              {r.serving && <span className="text-xs">· {r.serving}{mult > 1 ? ` × ${mult}` : ""}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite(r.name); }}
              className="p-1.5 -m-1.5 rounded-lg transition-all active:scale-90"
            >
              <Heart
                size={18}
                className={`transition-colors ${isFavorite(r.name) ? "fill-destructive text-destructive" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
              />
            </button>
            <span className="text-xs font-semibold text-primary">{scaledProtein} P</span>
            <span className="text-xs font-medium text-muted-foreground">{scaledFat} F</span>
          </div>
        </div>

        {/* Portion multiplier */}
        <div className="flex items-center gap-2 mt-3">
          <Users size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">{t("recipes.servings")}</span>
          {MULTIPLIERS.map((m) => (
            <button key={m} onClick={() => setMult(m)}
              className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${mult === m ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
            >{m}×</button>
          ))}
        </div>

        <p className="text-sm text-secondary-foreground/70 mt-3 leading-relaxed">{r.desc}</p>

        {/* Structured cooking steps for built-in recipes (parsed from desc) */}
        {!isCustom && r.desc && (
          <div className="mt-3 space-y-1.5 border-t border-border/30 pt-3">
            <p className="text-xs font-semibold text-foreground mb-1">{t("recipes.cookingSteps")}</p>
            <ol className="space-y-1.5">
              {(r.steps && r.steps.length > 0 ? r.steps : r.desc.split(/\.\s+/).filter((s: string) => s.trim().length > 3).map((s: string) => s.trim().replace(/\.$/, '') + '.')).map((step: string, j: number) => (
                <li key={j} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary font-bold flex-shrink-0">{j + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Expand toggle for ingredients */}
        {ingredients.length > 0 && (
          <>
            <button onClick={() => setExpanded(isExpanded ? null : cardKey)}
              className="flex items-center gap-1 mt-3 text-xs text-primary font-medium min-h-[36px]"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {isExpanded ? t("recipes.hideIngredients") : t("recipes.showIngredients")}
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-3 border-t border-border/30 pt-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{t("recipes.ingredients")}</p>
                    <button
                      onClick={() => addIngredientsToCart(ingredients, mult)}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors min-h-[32px]"
                    >
                      <ShoppingBag size={13} /> {t("recipes.addAllToBag")}
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {ingredients.map((ing, j) => {
                      const inBag = hasItem(ing.name);
                      return (
                        <li key={j} className="text-sm text-muted-foreground flex items-center justify-between min-h-[32px]">
                          <span className="flex items-center gap-1.5">
                            {inBag && <Check size={13} className="text-green-500 flex-shrink-0" />}
                            {ing.amount && <span className="font-medium text-foreground">{ing.amount}</span>} {ing.name}
                          </span>
                          {inBag ? (
                            <span className="text-[10px] text-green-500 font-medium px-1.5">{t("recipes.inList")}</span>
                          ) : (
                            <button
                              onClick={() => {
                                const parsed = parseAmount(ing.amount);
                                addItem(ing.name, parsed.quantity * mult, parsed.unit);
                                toast.success(`${ing.name} added`, {
                                  action: { label: "Open list", onClick: () => navigate("/shopping-bag") },
                                });
                              }}
                              className="text-muted-foreground hover:text-primary p-1.5"
                            >
                              <Plus size={13} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {custom && custom.steps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-1">{t("recipes.steps")}</p>
                    <ol className="space-y-1.5">
                      {custom.steps.map((step, j) => (
                        <li key={j} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-primary font-bold flex-shrink-0">{j + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {custom && (
                  <button onClick={() => deleteRecipe(custom.id)}
                    className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1 min-h-[36px]"
                  >
                    <Trash2 size={14} /> Delete recipe
                  </button>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {recipeTags.map((tg: string) => (
            <button
              key={tg}
              onClick={() => handleTagClick(tg)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all active:scale-95 ${
                activeTag === tg
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
              }`}
            >
              {tg}
            </button>
          ))}
        </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">{t("recipes.title")}</h1>
        <button onClick={() => navigate("/shopping-bag")} className="relative text-primary hover:text-primary/80 mr-2">
          <ShoppingBag size={18} />
          {bagCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
              {bagCount > 9 ? "9+" : bagCount}
            </span>
          )}
        </button>
        <button onClick={() => navigate("/create-recipe")} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Plus size={16} />
        </button>
      </div>

      {/* Hero meal image */}
      <div className="relative w-full h-40 overflow-hidden">
        <img
          src={(profile as any).gender === "female" ? heroMealFemale : heroMealMale}
          alt="Carnivore meal"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <p className="text-xs text-muted-foreground font-medium">{t("recipes.fuelYourBody")}</p>
          <p className="text-lg font-display font-bold text-foreground">{t("recipes.readyToCook")}</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <button onClick={() => navigate("/recipe-coach")} className="w-full relative overflow-hidden ios-card p-4 flex items-center gap-3.5 hover:bg-secondary/60 transition-all group active:scale-[0.98]">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/60 flex items-center justify-center flex-shrink-0 shadow-md ring-1 ring-primary/20">
            <ChefHat size={22} className="text-primary-foreground drop-shadow-sm" />
          </div>
          <div className="text-left flex-1 relative z-10">
            <p className="text-sm font-bold text-foreground tracking-tight">AI Recipe Coach</p>
            <p className="text-[11px] text-muted-foreground">Get personalised meal ideas based on your goals</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <ArrowLeft size={13} className="text-primary rotate-180" />
          </div>
        </button>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search recipes, ingredients, tags…" value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value) setActiveTag(null); }}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
        </div>

        {/* Active tag filter indicator */}
        {activeTag && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tag:</span>
            <button
              onClick={() => { setActiveTag(null); navigate("/recipes", { replace: true }); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium"
            >
              {activeTag} <X size={12} />
            </button>
          </div>
        )}

        {/* Diet tier filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {(Object.keys(TIER_LABELS) as DietTier[]).map((tier) => (
            <button key={tier} onClick={() => setActiveTier(tier)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTier === tier ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >{TIER_LABELS[tier]}</button>
          ))}
        </div>

        {/* Combined filter: Favorites / All / Snacks / Cravings */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${showFavoritesOnly ? "bg-destructive/15 text-destructive border border-destructive/30" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
          >
            <Heart size={11} className={showFavoritesOnly ? "fill-destructive" : ""} />
            Favorites
          </button>
          {Object.entries(FINAL_MENU).map(([key, label]) => (
            <button key={key} onClick={() => setActiveFilter(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${activeFilter === key ? "bg-foreground text-background" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
            >{label}</button>
          ))}
        </div>

        {/* Cuisine filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {(Object.entries(CUISINE_LABELS) as [string, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setActiveCuisine(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${activeCuisine === key ? "bg-primary/20 text-primary border border-primary/40" : "bg-secondary/60 text-muted-foreground hover:text-foreground"}`}
            >{label}</button>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          <span className="text-xs text-muted-foreground">{totalCount} recipes</span>

          {filtered.custom.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">My Recipes</p>
              {filtered.custom.map((r, i) => <RecipeCard key={r.id} r={r} i={i} isCustom />)}
              {filtered.builtIn.length > 0 && <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2">All Recipes</p>}
            </>
          )}

          {filtered.builtIn.map((r, i) => <RecipeCard key={r.name} r={r} i={i} />)}

          {totalCount === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No recipes found. Try adjusting your filters.</div>}
        </div>
      </div>
    </div>
  );
};

export default Recipes;
