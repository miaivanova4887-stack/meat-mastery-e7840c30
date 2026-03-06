import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, ArrowLeft, ChevronRight, Target, Dumbbell, Clock, Leaf, Zap, Heart, Scale, TrendingUp, Shield, Brain, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface StepOption {
  label: string;
  emoji: string;
  desc?: string;
}

interface OnboardingStep {
  title: string;
  subtitle: string;
  icon: typeof Flame;
  options: StepOption[];
  multiSelect?: boolean;
}

const steps: OnboardingStep[] = [
  {
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

const STORAGE_KEY = "carnivore-onboarding-complete";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | number[])[]>([]);
  const [multiSelected, setMultiSelected] = useState<number[]>([]);
  const [transitioning, setTransitioning] = useState(false);

  const current = steps[step];
  const isMulti = current.multiSelect;
  const totalSteps = steps.length;
  const isLastStep = step === totalSteps - 1;

  const handleSelect = (idx: number) => {
    if (isMulti) {
      setMultiSelected((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      );
    } else {
      advance(idx);
    }
  };

  const advance = (selection: number | number[]) => {
    setTransitioning(true);
    setTimeout(() => {
      setAnswers([...answers, selection]);
      if (step < totalSteps - 1) {
        setStep(step + 1);
        setMultiSelected([]);
      } else {
        // Complete onboarding
        localStorage.setItem(STORAGE_KEY, "true");
        localStorage.setItem("carnivore-onboarding-answers", JSON.stringify([...answers, selection]));
        navigate("/", { replace: true });
      }
      setTransitioning(false);
    }, 300);
  };

  const goBack = () => {
    if (step === 0) return;
    setTransitioning(true);
    setTimeout(() => {
      setAnswers(answers.slice(0, -1));
      setStep(step - 1);
      setMultiSelected([]);
      setTransitioning(false);
    }, 250);
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
      <div className={`flex-1 flex flex-col px-6 pt-8 pb-6 transition-all duration-300 ease-out ${transitioning ? "opacity-0 translate-y-3 scale-[0.97]" : "opacity-100 translate-y-0 scale-100"}`}>
        {/* Icon + Title */}
        <div className="mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
            <Icon size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-display font-black text-foreground leading-tight">{current.title}</h1>
          <p className="text-sm text-muted-foreground mt-2">{current.subtitle}</p>
        </div>

        {/* Options */}
        <div className="space-y-3 flex-1">
          {current.options.map((opt, i) => {
            const selected = isMulti ? multiSelected.includes(i) : false;
            return (
              <button
                key={`${step}-${i}`}
                onClick={() => handleSelect(i)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left active:scale-[0.97] ${
                  selected
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-card border-border hover:border-primary/30 hover:bg-card/80"
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
        </div>

        {/* Continue button for multi-select steps */}
        {isMulti && (
          <div className="pt-6">
            <Button
              className="w-full gap-2 h-12 text-base font-semibold"
              disabled={multiSelected.length === 0}
              onClick={() => advance(multiSelected)}
            >
              {isLastStep ? "Get Started" : "Continue"}
              <ChevronRight size={18} />
            </Button>
            {multiSelected.length === 0 && (
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
