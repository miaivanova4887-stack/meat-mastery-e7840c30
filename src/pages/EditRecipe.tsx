import { ArrowLeft, Plus, Minus, ChefHat, Camera, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { TIER_LABELS, MEAL_LABELS, type DietTier, type MealType, type Ingredient } from "@/data/recipes";
import { useCustomRecipes } from "@/hooks/useCustomRecipes";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const EditRecipe = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { customRecipes, updateRecipe, loading } = useCustomRecipes();
  const { t } = useTranslation();

  const recipe = useMemo(() => customRecipes.find((r) => r.id === id), [customRecipes, id]);

  // Auth guard
  useEffect(() => {
    if (!user) {
      toast.error("Sign in to edit recipes");
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

  // Redirect if recipe not found after loading
  useEffect(() => {
    if (!loading && !recipe) {
      toast.error("Recipe not found");
      navigate("/recipes", { replace: true });
    }
  }, [loading, recipe, navigate]);

  const [name, setName] = useState("");
  const [time, setTime] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [serving, setServing] = useState("");
  const [tiers, setTiers] = useState<DietTier[]>(["strict"]);
  const [meal, setMeal] = useState<MealType>("dinner");
  const [tags, setTags] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: "", amount: "" }]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Pre-fill form when recipe loads
  useEffect(() => {
    if (recipe && !initialized) {
      setName(recipe.name);
      setTime(recipe.time || "");
      setCal(recipe.cal || "");
      setProtein(recipe.protein || "");
      setFat(recipe.fat || "");
      setServing(recipe.serving || "");
      setTiers(recipe.tier || ["strict"]);
      setMeal((recipe.meal as MealType) || "dinner");
      setTags((recipe.tags || []).join(", "));
      setIngredients(recipe.ingredients?.length ? recipe.ingredients : [{ name: "", amount: "" }]);
      setSteps(recipe.steps?.length ? recipe.steps : [""]);
      if (recipe.image_url) setImagePreview(recipe.image_url);
      setInitialized(true);
    }
  }, [recipe, initialized]);

  const toggleTier = (tier: DietTier) => {
    setTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
  };

  const updateIngredient = (i: number, field: keyof Ingredient, value: string) => {
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing)));
  };

  const addIngredient = () => setIngredients((prev) => [...prev, { name: "", amount: "" }]);
  const removeIngredient = (i: number) => {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateStep = (i: number, value: string) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  };
  const addStep = () => setSteps((prev) => [...prev, ""]);
  const removeStep = (i: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!user || !id) return;
    if (!name.trim()) {
      toast.error("Recipe name is required");
      return;
    }
    if (tiers.length === 0) {
      toast.error("Select at least one diet tier");
      return;
    }
    const validIngredients = ingredients.filter((i) => i.name.trim());
    const validSteps = steps.filter((s) => s.trim());

    setSaving(true);
    await updateRecipe(id, {
      name: name.trim().slice(0, 100),
      time: time.trim() || "N/A",
      cal: cal.trim() || "0",
      protein: protein.trim() || "0g",
      fat: fat.trim() || "0g",
      serving: serving.trim() || "1 serving",
      desc: validSteps.length > 0 ? validSteps[0].slice(0, 200) : "Custom recipe",
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 5),
      tier: tiers,
      meal,
      ingredients: validIngredients,
      steps: validSteps,
    });
    setSaving(false);
    toast.success("Recipe updated!");
    navigate("/recipes");
  };

  const inputClass =
    "w-full bg-secondary rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30";
  const labelClass = "text-xs font-semibold text-foreground mb-1.5 block";

  if (!user || loading || !recipe) return null;

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">{t("recipes.editRecipe")} Recipe</h1>
        <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Image preview (read-only for edit) */}
        {imagePreview && (
          <div className="relative w-full h-48 rounded-xl overflow-hidden border border-border/40">
            <img src={imagePreview} alt="Recipe" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Name */}
        <div>
          <label className={labelClass}>Recipe Name *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Butter-Seared Ribeye" maxLength={100} className={inputClass} />
        </div>

        {/* Time + Macros */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Cook Time</label>
            <input type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 30 min" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Calories</label>
            <input type="text" value={cal} onChange={(e) => setCal(e.target.value)} placeholder="e.g. 650" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Protein</label>
            <input type="text" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 52g" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fat</label>
            <input type="text" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="e.g. 48g" className={inputClass} />
          </div>
        </div>

        {/* Portion Size */}
        <div>
          <label className={labelClass}>Portion Size</label>
          <input type="text" value={serving} onChange={(e) => setServing(e.target.value)} placeholder="e.g. 8 oz steak" className={inputClass} />
        </div>

        {/* Diet Tiers */}
        <div>
          <label className={labelClass}>Diet Tiers *</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(TIER_LABELS) as DietTier[]).map((tier) => (
              <button key={tier} type="button" onClick={() => toggleTier(tier)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tiers.includes(tier) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {TIER_LABELS[tier]}
              </button>
            ))}
          </div>
        </div>

        {/* Meal Type */}
        <div>
          <label className={labelClass}>Meal Type</label>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.entries(MEAL_LABELS) as [MealType | "all", string][])
              .filter(([k]) => k !== "all")
              .map(([key, label]) => (
                <button key={key} type="button" onClick={() => setMeal(key as MealType)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${meal === key ? "bg-foreground text-background" : "bg-secondary/60 text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={labelClass}>Tags</label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. Beef, Quick, Grilling" className={inputClass} />
        </div>

        {/* Ingredients */}
        <div>
          <label className={labelClass}>Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="text" value={ing.amount} onChange={(e) => updateIngredient(i, "amount", e.target.value)} placeholder="Amount" className={`${inputClass} w-24 flex-shrink-0`} />
                <input type="text" value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="Ingredient name" className={`${inputClass} flex-1`} />
                <button type="button" onClick={() => removeIngredient(i)} className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0">
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addIngredient} className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
            <Plus size={14} /> Add ingredient
          </button>
        </div>

        {/* Steps */}
        <div>
          <label className={labelClass}>Cooking Steps</label>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-2">{i + 1}</span>
                <textarea value={step} onChange={(e) => updateStep(i, e.target.value)} placeholder={`Step ${i + 1}…`} rows={2} className={`${inputClass} flex-1 resize-none`} />
                <button type="button" onClick={() => removeStep(i)} className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0 mt-2">
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
            <Plus size={14} /> Add step
          </button>
        </div>

        {/* Save Button */}
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <ChefHat size={18} /> {saving ? "Saving…" : "Update Recipe"}
        </button>
      </div>
    </div>
  );
};

export default EditRecipe;
