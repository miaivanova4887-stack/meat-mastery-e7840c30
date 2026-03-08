import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Target, Dumbbell, TrendingUp, Shield, Brain, Check, User, Ruler, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
}

interface InputStep {
  type: "input";
  title: string;
  subtitle: string;
  icon: typeof Target;
  fields: { key: string; label: string; placeholder: string; unit?: string; type?: string }[];
}

type OnboardingStep = OptionStep | InputStep;

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
    ],
  },
  {
    type: "input",
    title: "What's your target?",
    subtitle: "A goal gives you direction — leave blank if unsure",
    icon: Crosshair,
    fields: [
      { key: "goalWeight", label: "Goal weight", placeholder: "e.g. 72", unit: "kg", type: "number" },
      { key: "healthTarget", label: "Health target (optional)", placeholder: "e.g. Lower blood pressure", type: "text" },
    ],
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
    options: [
      { label: "Sugar cravings", emoji: "🍬" },
      { label: "Low energy", emoji: "😴" },
      { label: "Digestive issues", emoji: "🫤" },
      { label: "Social pressure", emoji: "👥" },
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
    subtitle: "We'll prioritise recipes from your favourite food cultures",
    icon: Target,
    multiSelect: true,
    options: [
      { label: "Indian", emoji: "🇮🇳", desc: "Tandoori, keema, spiced meats" },
      { label: "Thai", emoji: "🇹🇭", desc: "Lemongrass, grilled meats" },
      { label: "Chinese", emoji: "🇨🇳", desc: "Five-spice, stir-fry, Peking" },
      { label: "Mexican", emoji: "🇲🇽", desc: "Carne asada, carnitas, chorizo" },
    ],
  },
  {
    type: "options",
    title: "Any more cuisines?",
    subtitle: "Select all that appeal to you",
    icon: Target,
    multiSelect: true,
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
    options: [
      { label: "Meal plans & recipes", emoji: "📖" },
      { label: "Exercise routines", emoji: "🏋️" },
      { label: "Ketosis tracking", emoji: "⏱️" },
      { label: "Mental clarity tips", emoji: "🧠" },
    ],
  },
];

// Map step indices to the legacy answer array positions
// Option steps: goal(0), sex(1), experience(4), struggles(5), activity(6), mealsPerDay(7), interests(8)
const OPTION_ANSWER_KEYS = [0, 4, 5, 6, 7, 8]; // indices of option-type steps

const STORAGE_KEY = "carnivore-onboarding-complete";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | number[]>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<number[]>([]);
  const [transitioning, setTransitioning] = useState(false);

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
      } else {
        // Build the legacy answer array: [goal, experience, struggles, activity, interests]
        const legacyAnswers = [
          newAnswers[0] ?? 0,       // goal
          newAnswers[4] ?? 0,       // experience
          newAnswers[5] ?? [],      // struggles
          newAnswers[6] ?? 0,       // activity
          newAnswers[8] ?? [],      // interests
        ];
        localStorage.setItem(STORAGE_KEY, "true");
        localStorage.setItem("carnivore-onboarding-answers", JSON.stringify(legacyAnswers));

        // Save meals per day (step 7: 0=1meal, 1=2meals, 2=3meals, 3=4meals)
        const mealsPerDayVal = [1, 2, 3, 4][(newAnswers[7] as number) ?? 2] ?? 3;
        localStorage.setItem("carnivore-meals-per-day", String(mealsPerDayVal));

        // Save body stats separately
        const bodyData = {
          sex: newAnswers[1] ?? 0,
          age: inputValues.age || "",
          height: inputValues.height || "",
          weight: inputValues.weight || "",
          goalWeight: inputValues.goalWeight || "",
          healthTarget: inputValues.healthTarget || "",
        };
        localStorage.setItem("carnivore-onboarding-body", JSON.stringify(bodyData));

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
      setTransitioning(false);
    }, 250);
  };

  const handleInputChange = (key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const isInputStepValid = () => {
    if (current.type !== "input") return true;
    // At least one field should have a value (except fully optional steps like target)
    if (step === 3) return true; // target step is optional
    return current.fields.some((f) => (inputValues[f.key] || "").trim() !== "");
  };

  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
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
      <div className={`flex-1 flex flex-col px-6 pt-8 pb-6 transition-all duration-300 ease-out ${transitioning ? "opacity-0 translate-y-3 scale-[0.98]" : "opacity-100 translate-y-0 scale-100"}`}>
        {/* Icon + Title */}
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Icon size={24} strokeWidth={1.8} className="text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground leading-tight tracking-tight">{current.title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">{current.subtitle}</p>
        </div>

        {/* Options or Inputs */}
        <div className="space-y-3 flex-1">
          {current.type === "options" && current.options.map((opt, i) => {
            const selected = current.multiSelect ? multiSelected.includes(i) : false;
            return (
              <button
                key={`${step}-${i}`}
                onClick={() => handleSelect(i)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-left active:scale-[0.97] ${
                  selected
                    ? "bg-primary/8 border-primary/40 shadow-sm"
                    : "bg-card border-border/50 shadow-xs"
                }`}
                style={{ animationDelay: `${i * 0.06}s` }}
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
        </div>

        {/* Continue button for multi-select & input steps */}
        {((current.type === "options" && current.multiSelect) || current.type === "input") && (
          <div className="pt-6">
            <Button
              className="w-full gap-2 h-12 text-base font-semibold rounded-2xl"
              disabled={
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
              {isLastStep ? "Get Started" : "Continue"}
              <ChevronRight size={18} />
            </Button>
            {current.type === "options" && current.multiSelect && multiSelected.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center mt-2">Select at least one option</p>
            )}
          </div>
        )}
      </div>

      {/* Skip option */}
      <div className="px-6 pb-8 text-center">
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
