import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Target, Dumbbell, TrendingUp, Shield, Brain, Check, User, Ruler, Crosshair, Heart, Flame, Leaf, Zap, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n/index";

interface StepOption {
  label: string;
  emoji: string;
  desc?: string;
}

interface OptionStep {
  type: "options";
  title: string;
  subtitle: string;
  icon: typeof Target;
  options: StepOption[];
  multiSelect?: boolean;
  allowSkip?: boolean;
  allowCustom?: boolean;
}

interface InputStep {
  type: "input";
  title: string;
  subtitle: string;
  icon: typeof Target;
  fields: { key: string; label: string; placeholder: string; unit?: string; type?: string }[];
}

type OnboardingStep = OptionStep | InputStep;

// Health target constants
const ALL_HEALTH_TARGET_KEYS = [
  "blood_pressure", "insulin_sensitivity", "chronic_inflammation", "joint_pain",
  "autoimmune", "skin_issues", "bloating", "food_sensitivities", "mental_clarity",
  "brain_fog", "mood", "sleep", "sustained_energy", "athletic_performance",
  "recovery", "muscle_mass", "hormone_balance", "thyroid", "testosterone", "fertility"
] as const;

const HEALTH_TARGET_CATEGORIES = [
  { catKey: "cat_metabolic", targets: ["blood_pressure", "insulin_sensitivity"] },
  { catKey: "cat_inflammation", targets: ["chronic_inflammation", "joint_pain", "autoimmune", "skin_issues"] },
  { catKey: "cat_gut", targets: ["bloating", "food_sensitivities"] },
  { catKey: "cat_mental", targets: ["mental_clarity", "brain_fog", "mood", "sleep"] },
  { catKey: "cat_energy", targets: ["sustained_energy", "athletic_performance", "recovery", "muscle_mass"] },
  { catKey: "cat_hormonal", targets: ["hormone_balance", "thyroid", "testosterone", "fertility"] },
];

const CATEGORY_ICONS: Record<string, typeof Heart> = {
  cat_metabolic: Heart,
  cat_inflammation: Flame,
  cat_gut: Leaf,
  cat_mental: Brain,
  cat_energy: Zap,
  cat_hormonal: Scale,
};

const steps: OnboardingStep[] = [
  {
    type: "options",
    title: "What's your primary goal?",
    subtitle: "We'll tailor your carnivore journey to match",
    icon: Target,
    options: [
      { label: "Lose weight", emoji: "🔥", desc: "Shed fat and feel lighter" },
      { label: "Build muscle", emoji: "💪", desc: "Gain lean mass and strength" },
      { label: "Maintain weight", emoji: "⚖️", desc: "Stay where you are, feel better" },
      { label: "Improve health", emoji: "❤️", desc: "Focus on healing and vitality" },
    ],
  },
  {
    type: "options",
    title: "What's your sex?",
    subtitle: "This helps us personalize nutrition recommendations",
    icon: User,
    options: [
      { label: "Male", emoji: "♂️" },
      { label: "Female", emoji: "♀️" },
      { label: "Prefer not to say", emoji: "🤐" },
    ],
  },
  {
    type: "input",
    title: "Tell us about yourself",
    subtitle: "Used to personalize calorie and macro suggestions",
    icon: Ruler,
    fields: [
      { key: "age", label: "Age", placeholder: "e.g. 30", unit: "years", type: "number" },
      { key: "height", label: "Height", placeholder: "e.g. 175", unit: "cm", type: "number" },
      { key: "weight", label: "Current weight", placeholder: "e.g. 80", unit: "kg", type: "number" },
      { key: "goalWeight", label: "Goal weight", placeholder: "e.g. 72", unit: "kg", type: "number" },
    ],
  },
  {
    // Step 4 (index 3) — health targets multi-select only
    type: "input",
    title: "What's your target?",
    subtitle: "Select everything that applies — we'll personalize your plan around it",
    icon: Crosshair,
    fields: [],
  },
  {
    type: "options",
    title: "What's your experience level?",
    subtitle: "No wrong answers — we all start somewhere",
    icon: TrendingUp,
    options: [
      { label: "Curious beginner", emoji: "🌱", desc: "Just learning about carnivore" },
      { label: "Tried it briefly", emoji: "🔄", desc: "Done a few days or weeks" },
      { label: "Several months in", emoji: "🥩", desc: "Committed and seeing results" },
      { label: "Veteran carnivore", emoji: "🦁", desc: "1+ years of meat-based eating" },
    ],
  },
  {
    type: "options",
    title: "Any current struggles?",
    subtitle: "Select all that apply — we'll help with these",
    icon: Shield,
    multiSelect: true,
    allowSkip: true,
    options: [
      { label: "Sugar cravings", emoji: "🍬" },
      { label: "Low energy", emoji: "😴" },
      { label: "Digestive issues", emoji: "🫤" },
      { label: "Social pressure", emoji: "👥" },
      { label: "New recipe ideas", emoji: "💡", desc: "Need exciting meal inspiration" },
      { label: "Discipline", emoji: "🎯", desc: "Cooking, planning & staying consistent" },
    ],
  },
  {
    type: "options",
    title: "How active are you?",
    subtitle: "This helps us recommend the right exercise plan",
    icon: Dumbbell,
    options: [
      { label: "Sedentary", emoji: "🪑", desc: "Little to no exercise" },
      { label: "Lightly active", emoji: "🚶", desc: "Walking, light movement" },
      { label: "Moderately active", emoji: "🏃", desc: "3-4 workouts per week" },
      { label: "Very active", emoji: "🏋️", desc: "5+ intense sessions weekly" },
    ],
  },
  {
    type: "options",
    title: "How many meals do you eat per day?",
    subtitle: "We'll structure your meal plan around this",
    icon: Target,
    options: [
      { label: "1 meal (OMAD)", emoji: "1️⃣", desc: "One meal a day" },
      { label: "2 meals", emoji: "2️⃣", desc: "e.g. Lunch + Dinner" },
      { label: "3 meals", emoji: "3️⃣", desc: "Breakfast, Lunch, Dinner" },
      { label: "4 meals", emoji: "4️⃣", desc: "3 meals + a snack" },
    ],
  },
  {
    type: "options",
    title: "What cuisines inspire you?",
    subtitle: "Select any that appeal — or skip to the next page",
    icon: Target,
    multiSelect: true,
    allowSkip: true,
    options: [
      { label: "American", emoji: "🇺🇸", desc: "BBQ, burgers, smoked brisket" },
      { label: "European", emoji: "🇪🇺", desc: "Steak frites, roasts, charcuterie" },
      { label: "Indian", emoji: "🇮🇳", desc: "Tandoori, keema, spiced meats" },
      { label: "Mexican", emoji: "🇲🇽", desc: "Carne asada, carnitas, chorizo" },
    ],
  },
  {
    type: "options",
    title: "Any more cuisines?",
    subtitle: "Select any that appeal — or skip ahead",
    icon: Target,
    multiSelect: true,
    allowSkip: true,
    allowCustom: true,
    options: [
      { label: "Korean", emoji: "🇰🇷", desc: "Bulgogi, galbi, samgyeopsal" },
      { label: "Japanese", emoji: "🇯🇵", desc: "Wagyu, sashimi, yakitori" },
      { label: "African", emoji: "🌍", desc: "Suya, boerewors, kitfo" },
      { label: "Middle Eastern", emoji: "🕌", desc: "Shawarma, kofta, kebabs" },
    ],
  },
  {
    type: "options",
    title: "What interests you most?",
    subtitle: "Select all you'd like to explore",
    icon: Brain,
    multiSelect: true,
    allowSkip: true,
    options: [
      { label: "Motivation", emoji: "🔥", desc: "Stay inspired and accountable" },
      { label: "Progress tracking", emoji: "📊", desc: "Monitor body & health metrics" },
      { label: "Meal plans & recipes", emoji: "📖" },
      { label: "Exercise routines", emoji: "🏋️" },
      { label: "Ketosis tracking", emoji: "⏱️" },
      { label: "Mental clarity tips", emoji: "🧠", desc: "Focus, brain fog, cognition" },
    ],
  },
];

const STORAGE_KEY = "carnivore-onboarding-complete";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | number[]>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<number[]>([]);
  const [customCuisine, setCustomCuisine] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // Health targets state (step 3)
  const [healthTargets, setHealthTargets] = useState<string[]>([]);
  const [healthTargetLabels, setHealthTargetLabels] = useState<Map<string, string>>(new Map());

  // Fetch health target labels from content_blocks
  useEffect(() => {
    const locale = i18n.language?.startsWith("fr") ? "fr" : "en";
    (supabase as any)
      .from("content_blocks")
      .select("key, value")
      .eq("page", "onboarding")
      .eq("section", "health_targets")
      .eq("locale", locale)
      .then(({ data }: { data: { key: string; value: string }[] | null }) => {
        if (data) {
          const map = new Map<string, string>();
          data.forEach((row) => map.set(row.key, row.value));
          setHealthTargetLabels(map);
        }
      });
  }, []);

  const toggleHealthTarget = (key: string) => {
    setHealthTargets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const current = steps[step];
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  const handleSelect = (idx: number) => {
    if (current.type === "options" && current.multiSelect) {
      setMultiSelected((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      advance(idx);
    }
  };

  const advance = (selection?: number | number[]) => {
    setTransitioning(true);
    setTimeout(() => {
      const newAnswers = { ...answers };
      if (selection !== undefined) {
        newAnswers[step] = selection;
      }
      setAnswers(newAnswers);

      if (step < totalSteps - 1) {
        setStep(step + 1);
        setMultiSelected([]);
        setCustomCuisine("");
      } else {
        const legacyAnswers = [
          newAnswers[0] ?? 0,
          newAnswers[4] ?? 0,
          newAnswers[5] ?? [],
          newAnswers[6] ?? 0,
          newAnswers[10] ?? [],
        ];
        localStorage.setItem(STORAGE_KEY, "true");
        localStorage.setItem("carnivore-onboarding-answers", JSON.stringify(legacyAnswers));

        const mealsPerDayVal = [1, 2, 3, 4][(newAnswers[7] as number) ?? 2] ?? 3;
        localStorage.setItem("carnivore-meals-per-day", String(mealsPerDayVal));

        const bodyData = {
          sex: newAnswers[1] ?? 0,
          age: inputValues.age || "",
          height: inputValues.height || "",
          weight: inputValues.weight || "",
          goalWeight: inputValues.goalWeight || "",
          healthTarget: "",
        };
        localStorage.setItem("carnivore-onboarding-body", JSON.stringify(bodyData));

        // Save health targets
        localStorage.setItem("carnivore-health-targets", JSON.stringify(healthTargets));

        // Build CDP user_attributes
        const userAttributes: Record<string, boolean> = {};
        ALL_HEALTH_TARGET_KEYS.forEach((k) => {
          userAttributes[`health_target_${k}`] = healthTargets.includes(k);
        });

        // Save to profile if authenticated
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            (supabase as any)
              .from("profiles")
              .update({
                health_targets: healthTargets,
                user_attributes: userAttributes,
              })
              .eq("id", user.id)
              .then(() => {});
          }
        });

        const CUISINE_MAP_1 = ["american", "european", "indian", "mexican"];
        const CUISINE_MAP_2 = ["korean", "japanese", "african", "middle_eastern"];
        const selectedCuisines: string[] = [];
        ((newAnswers[8] as number[]) || []).forEach(i => { if (CUISINE_MAP_1[i]) selectedCuisines.push(CUISINE_MAP_1[i]); });
        ((newAnswers[9] as number[]) || []).forEach(i => { if (CUISINE_MAP_2[i]) selectedCuisines.push(CUISINE_MAP_2[i]); });
        // Save custom cuisines
        const storedCustom = localStorage.getItem("carnivore-custom-cuisines");
        if (storedCustom) {
          try { selectedCuisines.push(...JSON.parse(storedCustom)); } catch {}
        }
        localStorage.setItem("carnivore-cuisines", JSON.stringify(selectedCuisines));

        window.dispatchEvent(new Event("profile-update"));
        navigate("/", { replace: true });
      }
      setTransitioning(false);
    }, 300);
  };

  const goBack = () => {
    if (step === 0) return;
    setTransitioning(true);
    setTimeout(() => {
      const newAnswers = { ...answers };
      delete newAnswers[step];
      setAnswers(newAnswers);
      setStep(step - 1);
      setMultiSelected([]);
      setCustomCuisine("");
      setTransitioning(false);
    }, 250);
  };

  const handleInputChange = (key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const isInputStepValid = () => {
    if (current.type !== "input") return true;
    if (step === 3) return true;
    return current.fields.some((f) => (inputValues[f.key] || "").trim() !== "");
  };

  const canSkip = current.type === "options" && current.multiSelect && (current as OptionStep).allowSkip;
  const showCustomInput = current.type === "options" && (current as OptionStep).allowCustom;

  const handleAddCustomCuisine = () => {
    if (!customCuisine.trim()) return;
    const existing = JSON.parse(localStorage.getItem("carnivore-custom-cuisines") || "[]");
    existing.push(customCuisine.trim().toLowerCase());
    localStorage.setItem("carnivore-custom-cuisines", JSON.stringify(existing));
    setCustomCuisine("");
    // Show confirmation
    import("sonner").then(({ toast }) => toast.success(`"${customCuisine.trim()}" added!`));
  };

  const Icon = current.icon;
  const isStep4 = step === 3;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 16px) + 8px)" }}
      >
        {step > 0 ? (
          <button onClick={goBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div className="w-5" />
        )}
        <Progress value={((step + 1) / totalSteps) * 100} className="h-1.5 flex-1 transition-all duration-500" />
        <span className="text-[10px] text-muted-foreground w-10 text-right">{step + 1}/{totalSteps}</span>
      </div>

      {/* Content */}
      <div className={`flex-1 flex flex-col px-6 pt-6 pb-4 transition-all duration-300 ease-out ${transitioning ? "opacity-0 translate-y-3 scale-[0.98]" : "opacity-100 translate-y-0 scale-100"}`}>
        {/* Icon + Title */}
        <div className="mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Icon size={24} strokeWidth={1.8} className="text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground leading-tight tracking-tight">{current.title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {isStep4 && healthTargetLabels.get("subtitle")
              ? healthTargetLabels.get("subtitle")
              : current.subtitle}
          </p>
        </div>

        {/* Options or Inputs */}
        <div className="space-y-2.5 flex-1 overflow-y-auto">
          {current.type === "options" && current.options.map((opt, i) => {
            const selected = current.multiSelect ? multiSelected.includes(i) : false;
            return (
              <button
                key={`${step}-${i}`}
                onClick={() => handleSelect(i)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-2xl border transition-all duration-200 text-left active:scale-[0.97] ${
                  selected
                    ? "bg-primary/8 border-primary/40 shadow-sm"
                    : "bg-card border-border/50 shadow-xs"
                }`}
              >
                <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground block">{opt.label}</span>
                  {opt.desc && <span className="text-[11px] text-muted-foreground">{opt.desc}</span>}
                </div>
                {selected && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}

          {current.type === "input" && current.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type={field.type || "text"}
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  placeholder={field.placeholder}
                  value={inputValues[field.key] || ""}
                  onChange={(e) => handleInputChange(field.key, e.target.value)}
                  className="flex-1 h-12 rounded-2xl border border-border/50 bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all shadow-xs"
                  maxLength={field.type === "number" ? 6 : 200}
                />
                {field.unit && (
                  <span className="text-sm text-muted-foreground w-10">{field.unit}</span>
                )}
              </div>
            </div>
          ))}

          {/* Health targets multi-select on Step 4 */}
          {isStep4 && healthTargetLabels.size > 0 && (
            <div className="mt-4 space-y-4">
              {HEALTH_TARGET_CATEGORIES.map((cat) => (
                <div key={cat.catKey}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {healthTargetLabels.get(cat.catKey) || cat.catKey}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cat.targets.map((targetKey) => {
                      const selected = healthTargets.includes(targetKey);
                      return (
                        <button
                          key={targetKey}
                          type="button"
                          onClick={() => toggleHealthTarget(targetKey)}
                          className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-200 active:scale-[0.97] ${
                            selected
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-card border-border/50 text-foreground"
                          }`}
                        >
                          {healthTargetLabels.get(targetKey) || targetKey}
                          {selected && (
                            <Check size={12} className="inline ml-1.5 -mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Custom cuisine input */}
          {showCustomInput && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Add your own cuisine…"
                value={customCuisine}
                onChange={(e) => setCustomCuisine(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomCuisine()}
                className="flex-1 h-10 rounded-xl border border-border/50 bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                maxLength={40}
              />
              <button
                onClick={handleAddCustomCuisine}
                disabled={!customCuisine.trim()}
                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Continue button for multi-select & input steps */}
        {((current.type === "options" && current.multiSelect) || current.type === "input") && (
          <div className="pt-4">
            <Button
              className="w-full gap-2 h-12 text-base font-semibold rounded-2xl"
              disabled={
                !canSkip &&
                (current.type === "options" && current.multiSelect && multiSelected.length === 0) ||
                (current.type === "input" && !isInputStepValid())
              }
              onClick={() => {
                if (current.type === "options" && current.multiSelect) {
                  advance(multiSelected);
                } else {
                  advance();
                }
              }}
            >
              {isLastStep ? "Get Started" : multiSelected.length === 0 && canSkip ? "Skip" : "Continue"}
              <ChevronRight size={18} />
            </Button>
          </div>
        )}
      </div>

      {/* Skip option */}
      <div className="px-6 pb-6 text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 24px) + 8px)" }}
      >
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "true");
            navigate("/", { replace: true });
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export const isOnboardingComplete = () => localStorage.getItem(STORAGE_KEY) === "true";

export default Onboarding;
