import { ArrowLeft, Plus, Minus, ChefHat, Camera, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { TIER_LABELS, MEAL_LABELS, type DietTier, type MealType, type Ingredient, type CustomRecipe } from "@/data/recipes";
import { useCustomRecipes } from "@/hooks/useCustomRecipes";
import { useAuth } from "@/contexts/AuthContext";

const CreateRecipe = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addRecipe } = useCustomRecipes();

  // Auth guard
  useEffect(() => {
    if (!user) {
      toast.error("Sign in to create recipes");
      navigate("/auth", { replace: true });
    }
  }, [user, navigate]);

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

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
    if (!user) {
      toast.error("Sign in to create recipes");
      navigate("/auth");
      return;
    }
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

    const recipe: CustomRecipe = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 100),
      time: time.trim() || "N/A",
      cal: cal.trim() || "0",
      protein: protein.trim() || "0g",
      fat: fat.trim() || "0g",
      serving: serving.trim() || "1 serving",
      desc: validSteps.length > 0 ? validSteps[0].slice(0, 200) : "Custom recipe",
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5),
      tier: tiers,
      meal,
      cravings: [],
      ingredients: validIngredients,
      steps: validSteps,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };

    setSaving(true);
    const result = await addRecipe(recipe, imageFile);
    setSaving(false);

    if (result?.error) {
      toast.error("Failed to save recipe");
      return;
    }

    toast.success("Recipe saved!");
    navigate("/recipes");
  };

  const inputClass =
    "w-full bg-secondary rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30";
  const labelClass = "text-xs font-semibold text-foreground mb-1.5 block";

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 pb-3 flex items-center gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Create Recipe</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Image Upload */}
        <div>
          <label className={labelClass}>Recipe Photo</label>
          {imagePreview ? (
            <div className="relative w-full h-48 rounded-xl overflow-hidden border border-border/40">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 text-foreground flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/40 transition-colors">
              <Camera size={28} className="text-muted-foreground mb-1.5" />
              <span className="text-xs text-muted-foreground font-medium">Add Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Name */}
        <div>
          <label className={labelClass}>Recipe Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Butter-Seared Ribeye"
            maxLength={100}
            className={inputClass}
          />
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
          <input type="text" value={serving} onChange={(e) => setServing(e.target.value)} placeholder="e.g. 8 oz steak, 2 patties, 3 eggs" className={inputClass} />
        </div>

        {/* Diet Tiers */}
        <div>
          <label className={labelClass}>Diet Tiers *</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(TIER_LABELS) as DietTier[]).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => toggleTier(tier)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  tiers.includes(tier)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
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
                <button
                  key={key}
                  type="button"
                  onClick={() => setMeal(key as MealType)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                    meal === key
                      ? "bg-foreground text-background"
                      : "bg-secondary/60 text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className={labelClass}>Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. Beef, Quick, Grilling (comma separated)"
            className={inputClass}
          />
        </div>

        {/* Ingredients */}
        <div>
          <label className={labelClass}>Ingredients</label>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={ing.amount}
                  onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                  placeholder="Amount"
                  className={`${inputClass} w-24 flex-shrink-0`}
                />
                <input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, "name", e.target.value)}
                  placeholder="Ingredient name"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0"
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium"
          >
            <Plus size={14} /> Add ingredient
          </button>
        </div>

        {/* Steps */}
        <div>
          <label className={labelClass}>Cooking Steps</label>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-2">
                  {i + 1}
                </span>
                <textarea
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}…`}
                  rows={2}
                  className={`${inputClass} flex-1 resize-none`}
                />
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0 mt-2"
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addStep}
            className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium"
          >
            <Plus size={14} /> Add step
          </button>
        </div>

        {/* Save Button (bottom) */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          <ChefHat size={18} /> {saving ? "Saving…" : "Save Recipe"}
        </button>
      </div>
    </div>
  );
};

export default CreateRecipe;
