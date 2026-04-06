import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Target, Dumbbell, TrendingUp, Shield, Brain, Check, User, Ruler, Crosshair, Heart, Flame, Leaf, Zap, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Refined monochrome icon map per category (lucide icons)
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
        const userAttributes: Record<string, any> = {};
        ALL_HEALTH_TARGET_KEYS.forEach((k) => {
          userAttributes[`health_target_${k}`] = healthTargets.includes(k);
        });

        // Include custom cuisines in user_attributes
        const storedCustomCuisines = localStorage.getItem("carnivore-custom-cuisines");
        if (storedCustomCuisines) {
          try {
            const customCuisines = JSON.parse(storedCustomCuisines);
            if (Array.isArray(customCuisines) && customCuisines.length > 0) {
              userAttributes["custom_cuisines"] = customCuisines;
            }
          } catch {}
        }

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
    import("sonner").then(({ toast }) => toast.success(`"${customCuisine.trim()}" added!`));
  };

  const isStep4 = step === 3;

  // Progress dots
  const progressPercent = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Premium top bar */}
      <div
        className="px-5 pt-4 pb-3 flex items-center gap-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 16px) + 8px)" }}
      >
        {step > 0 ? (
          <button
            onClick={goBack}
            className="text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
        ) : (
          <div className="w-[18px]" />
        )}

        {/* Refined progress track */}
        <div className="flex-1 h-[3px] bg-border/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="text-[10px] font-medium text-muted-foreground tracking-wider tabular-nums">
          {step + 1}/{totalSteps}
        </span>
      </div>

      {/* Content */}
      <div
        className={`flex-1 flex flex-col px-6 pt-4 pb-4 transition-all duration-300 ease-out ${
          transitioning
            ? "opacity-0 translate-y-2 scale-[0.99]"
            : "opacity-100 translate-y-0 scale-100"
        }`}
      >
        {/* Editorial header */}
        <div className="mb-8">
          <h1 className="text-[26px] font-extrabold text-foreground leading-[1.15] tracking-[-0.02em]">
            {current.title}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed font-light tracking-normal">
            {isStep4 && healthTargetLabels.get("subtitle")
              ? healthTargetLabels.get("subtitle")
              : current.subtitle}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {current.type === "options" &&
            current.options.map((opt, i) => {
              const selected = current.multiSelect ? multiSelected.includes(i) : false;
              return (
                <button
                  key={`${step}-${i}`}
                  onClick={() => handleSelect(i)}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`w-full flex items-center gap-3.5 h-[52px] px-4 rounded-xl border transition-all duration-200 text-left active:scale-[0.98]
                    ${selected ? "onboarding-card-selected" : "onboarding-card-idle"}
                  `}
                >
                  {/* Medallion icon */}
                  <div
                    className={`onboarding-medallion ${selected ? "onboarding-medallion-active" : ""}`}
                  >
                    <span className="text-[15px] leading-none">{opt.emoji}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-[14px] font-medium block leading-tight ${
                        selected ? "text-foreground" : "text-foreground"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.desc && (
                      <span className="text-[11px] text-muted-foreground font-light mt-0.5 block leading-snug">
                        {opt.desc}
                      </span>
                    )}
                  </div>

                  {/* Check ring */}
                  <div
                    className={`onboarding-check ${selected ? "onboarding-check-active" : ""}`}
                  >
                    {selected && <Check size={10} strokeWidth={2.5} className="text-primary-foreground" />}
                  </div>
                </button>
              );
            })}

          {/* Input fields */}
          {current.type === "input" &&
            current.fields.map((field, i) => (
              <div
                key={field.key}
                className="space-y-1.5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {field.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={field.type || "text"}
                    inputMode={field.type === "number" ? "numeric" : undefined}
                    placeholder={field.placeholder}
                    value={inputValues[field.key] || ""}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    className="flex-1 h-12 rounded-xl border border-border/40 bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
                    maxLength={field.type === "number" ? 6 : 200}
                  />
                  {field.unit && (
                    <span className="text-[11px] font-medium text-muted-foreground w-10 uppercase tracking-wider">
                      {field.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}

          {/* Health targets — editorial category groups */}
          {isStep4 && healthTargetLabels.size > 0 && (
            <div className="space-y-6">
              {HEALTH_TARGET_CATEGORIES.map((cat, catIdx) => {
                const CatIcon = CATEGORY_ICONS[cat.catKey] || Heart;
                const hasAnySelected = cat.targets.some((t) => healthTargets.includes(t));

                return (
                  <div
                    key={cat.catKey}
                    style={{ animationDelay: `${catIdx * 80}ms` }}
                    className="animate-[onb-stagger_0.35s_ease-out_both]"
                  >
                    {/* Editorial category header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                          hasAnySelected
                            ? "bg-primary/12 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <CatIcon size={14} strokeWidth={1.5} />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {healthTargetLabels.get(cat.catKey) || cat.catKey}
                      </span>
                    </div>

                    {/* Accent rule */}
                    <div
                      className={`h-[1px] mb-3 transition-all duration-500 ${
                        hasAnySelected
                          ? "onboarding-category-line"
                          : "bg-border/20"
                      }`}
                    />

                    {/* Pill-style target chips for small categories, tiles for larger */}
                    {cat.targets.length <= 2 ? (
                      /* Compact pill row for 2-item categories */
                      <div className="flex gap-2">
                        {cat.targets.map((targetKey) => {
                          const selected = healthTargets.includes(targetKey);
                          return (
                            <button
                              key={targetKey}
                              type="button"
                              onClick={() => toggleHealthTarget(targetKey)}
                              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl border transition-all duration-200 active:scale-[0.97] ${
                                selected
                                  ? "onboarding-pill-selected"
                                  : "onboarding-pill-idle"
                              }`}
                            >
                              {selected && (
                                <Check size={12} strokeWidth={2.5} className="flex-shrink-0" />
                              )}
                              <span
                                className={`text-[12.5px] font-medium leading-tight ${
                                  selected ? "" : "text-foreground"
                                }`}
                              >
                                {healthTargetLabels.get(targetKey) || targetKey}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Segmented tile list for 3-4 item categories */
                      <div className="rounded-xl border border-border/30 overflow-hidden divide-y divide-border/20">
                        {cat.targets.map((targetKey, tIdx) => {
                          const selected = healthTargets.includes(targetKey);
                          return (
                            <button
                              key={targetKey}
                              type="button"
                              onClick={() => toggleHealthTarget(targetKey)}
                              className={`w-full flex items-center gap-3 py-3 px-4 transition-all duration-200 active:scale-[0.98] ${
                                selected
                                  ? "bg-primary/[0.05]"
                                  : "bg-card hover:bg-muted/30"
                              }`}
                            >
                              <span
                                className={`flex-1 text-[13px] font-medium text-left ${
                                  selected ? "text-foreground" : "text-foreground/80"
                                }`}
                              >
                                {healthTargetLabels.get(targetKey) || targetKey}
                              </span>
                              <div
                                className={`onboarding-check ${
                                  selected ? "onboarding-check-active" : ""
                                }`}
                              >
                                {selected && (
                                  <Check size={10} strokeWidth={2.5} className="text-primary-foreground" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
                className="flex-1 h-10 rounded-xl border border-border/40 bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
                maxLength={40}
              />
              <button
                onClick={handleAddCustomCuisine}
                disabled={!customCuisine.trim()}
                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 transition-opacity"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Continue button for multi-select & input steps */}
        {((current.type === "options" && current.multiSelect) || current.type === "input") && (
          <div className="pt-5">
            <Button
              className="w-full gap-2 h-[52px] text-[15px] font-semibold rounded-xl tracking-wide transition-all duration-300"
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
              <ChevronRight size={16} strokeWidth={2} />
            </Button>
          </div>
        )}
      </div>

      {/* Skip */}
      <div
        className="px-6 pb-6 text-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 24px) + 8px)" }}
      >
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "true");
            navigate("/", { replace: true });
          }}
          className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-300 tracking-wide"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export const isOnboardingComplete = () => localStorage.getItem(STORAGE_KEY) === "true";

export default Onboarding;
