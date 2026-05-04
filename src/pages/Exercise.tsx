import { useState } from "react";
import { ArrowLeft, Dumbbell, Heart, Zap, Wind, Sparkles, Sun, Moon, ChevronRight, Activity, Music, Brain, Info } from "lucide-react";
import YogaFlowProgram from "@/components/exercise/YogaFlowProgram";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { ActivityLevel, Goal } from "@/contexts/UserProfileContext";
import { useTranslation } from "react-i18next";

const categoryKeys = ["strength", "hiit", "liss", "recovery"] as const;
const categoryIcons = { strength: Dumbbell, hiit: Zap, liss: Wind, recovery: Heart };

const TOTAL_QUESTIONS = 7;

type QuizResult = { workout: string; app: string; icon: typeof Dumbbell; reason: string };

function getQuizResult(answers: number[]): QuizResult {
  const [energy, need, _time, soreness, mood, movement, goal] = answers;

  if (soreness >= 3) return { workout: "Sleep Meditation", app: "Meditation", icon: Brain, reason: "Your body can barely move — let a guided sleep meditation activate deep recovery while carnivore nutrition rebuilds you." };
  if (soreness >= 2 && need === 3) return { workout: "Restorative Yoga", app: "Yoga", icon: Sun, reason: "Sore and needing recovery. Supported poses will gently release tension without taxing your muscles." };
  if (need === 3) return { workout: "Body Scan Meditation", app: "Meditation", icon: Brain, reason: "Your body is asking for deep rest. A body scan will release tension layer by layer." };
  if (mood === 2 && movement === 0) return { workout: "Full Body Burn HIIT", app: "HIIT", icon: Zap, reason: "Frustration + explosive energy = the perfect HIIT storm. Unleash it all in 25 minutes." };
  if (mood === 2) return { workout: "Tabata HIIT", app: "HIIT", icon: Zap, reason: "You need to blow off steam. Tabata's 20s max-effort intervals will empty the tank fast." };
  if (energy === 0 && need === 0 && movement === 1) return { workout: "Power Pilates", app: "Pilates", icon: Activity, reason: "Fired up and craving controlled strength — Power Pilates will challenge every stabilizer muscle." };
  if (energy === 0 && need === 0) return { workout: "Power Yoga", app: "Yoga", icon: Sun, reason: "High energy + strength craving — channel that protein-fueled power into intense hold sequences." };
  if (movement === 3 && goal === 0) return { workout: "Cardio Barre", app: "Barre", icon: Music, reason: "Graceful movement meets fat burning. Cardio Barre sculpts and torches in equal measure." };
  if (movement === 3) return { workout: "Classic Barre", app: "Barre", icon: Music, reason: "Your body wants rhythm and grace. Ballet-inspired micro-movements will sculpt lean muscle beautifully." };
  if (movement === 1 && goal === 1) return { workout: "Mat Pilates", app: "Pilates", icon: Activity, reason: "Precision meets strength. Mat Pilates builds the deep core stability that powers all your lifts." };
  if (movement === 1) return { workout: "Core Blast Pilates", app: "Pilates", icon: Activity, reason: "Your desire for control pairs perfectly with targeted core and stability work." };
  if (goal === 2 && energy === 2) return { workout: "Guided Mindfulness", app: "Meditation", icon: Brain, reason: "Low energy + mental clarity goal = mindfulness is your medicine. 15 minutes to reset." };
  if (goal === 3 && mood === 3) return { workout: "Breathwork", app: "Meditation", icon: Brain, reason: "Peace-seeking + stress relief — pranayama will downregulate your entire nervous system." };
  if (mood === 3 && need === 1) return { workout: "Yin Yoga", app: "Yoga", icon: Sun, reason: "Peace + flexibility — long passive holds will quiet your mind and open tight tissues." };
  if (energy === 0 && goal === 0) return { workout: "EMOM HIIT", app: "HIIT", icon: Zap, reason: "Fired up and want to get lean — EMOM intervals maximize output and fat burning." };
  if (energy === 0 || mood === 1) return { workout: "Vinyasa Flow", app: "Yoga", icon: Sun, reason: "High energy meets a go-with-the-flow mindset. Ride the wave through dynamic sequences." };
  if (energy === 2 && movement === 2) return { workout: "Yin Yoga", app: "Yoga", icon: Sun, reason: "Low energy + slow grounding = perfect Yin conditions. Let gravity do the work." };
  if (energy === 2) return { workout: "Barre Stretch", app: "Barre", icon: Music, reason: "Low energy doesn't mean no movement. Gentle ballet stretches will restore without draining you." };
  if (need === 2) return { workout: "Breathwork", app: "Meditation", icon: Brain, reason: "Pranayama will reset your nervous system and prep your body for tomorrow." };
  if (movement === 2) return { workout: "Hatha Yoga", app: "Yoga", icon: Sun, reason: "Slow, grounding postures match your desire for intentional movement." };
  if (goal === 0) return { workout: "Cardio Barre", app: "Barre", icon: Music, reason: "A fun, rhythmic way to burn fat. High tempo barre with cardio bursts keeps things interesting." };
  return { workout: "Stretch & Lengthen Pilates", app: "Pilates", icon: Activity, reason: "A balanced session to open up your body — flexibility-focused Pilates that complements your carnivore recovery." };
}

const Exercise = () => {
  const profile = useUserProfile();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [quizStep, setQuizStep] = useState(-1);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [transitioning, setTransitioning] = useState(false);

  const handleQuizAnswer = (answerIdx: number) => {
    setTransitioning(true);
    setTimeout(() => {
      const next = [...quizAnswers, answerIdx];
      setQuizAnswers(next);
      setQuizStep((s) => s + 1);
      setTransitioning(false);
    }, 250);
  };

  const resetQuiz = () => { setQuizStep(-1); setQuizAnswers([]); setTransitioning(false); };

  const goBack = () => {
    if (quizStep <= 0) return resetQuiz();
    setTransitioning(true);
    setTimeout(() => {
      setQuizAnswers((prev) => prev.slice(0, -1));
      setQuizStep((s) => s - 1);
      setTransitioning(false);
    }, 250);
  };

  const quizResult = quizStep === TOTAL_QUESTIONS ? getQuizResult(quizAnswers) : null;

  const quizQs = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => ({
    q: t(`exercise.quiz.q${i + 1}`),
    options: t(`exercise.quiz.q${i + 1}_opts`, { returnObjects: true }) as string[],
  }));

  const getPersonalTip = (): string | null => {
    if (!profile.isComplete) return null;
    if (profile.goal === "lose_weight" && profile.activityLevel === "sedentary") return t("exercise.personalTips.loseWeight_sedentary");
    if (profile.goal === "lose_weight" && profile.activityLevel === "light") return t("exercise.personalTips.loseWeight_light");
    if (profile.goal === "lose_weight") return t("exercise.personalTips.loseWeight_active");
    if (profile.goal === "build_muscle") return t("exercise.personalTips.buildMuscle");
    if (profile.goal === "maintain") return t("exercise.personalTips.maintain");
    if (profile.goal === "improve_health" && profile.activityLevel === "sedentary") return t("exercise.personalTips.health_sedentary");
    if (profile.goal === "improve_health") return t("exercise.personalTips.health_active");
    return null;
  };

  const personalTip = getPersonalTip();

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("exercise.title")}</h1>
      </div>

      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl p-4 space-y-6">
        {personalTip && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3 animate-fade-in">
            <Info size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">{t("exercise.yourPlan")}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{personalTip}</p>
            </div>
          </div>
        )}

        {/* Quick Quiz Card */}
        <div className="bg-card border border-primary/30 rounded-lg p-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-accent" />
            <h2 className="font-display font-bold text-foreground text-sm">{t("exercise.quizTitle")}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t("exercise.quizDesc")}</p>

          {quizStep === -1 && (
            <Button size="sm" className="gap-1.5 animate-scale-in" onClick={() => setQuizStep(0)}>
              {t("exercise.takeQuiz")} <ChevronRight size={14} />
            </Button>
          )}

          {quizStep >= 0 && quizStep < TOTAL_QUESTIONS && (
            <div className={`space-y-3 transition-all duration-250 ease-out ${transitioning ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
              <Progress value={((quizStep + 1) / TOTAL_QUESTIONS) * 100} className="h-1.5 transition-all duration-500" />
              <p className="text-sm font-medium text-foreground">{quizQs[quizStep].q}</p>
              <div className="grid grid-cols-2 gap-2">
                {quizQs[quizStep].options.map((opt, i) => (
                  <button
                    key={`${quizStep}-${opt}`}
                    onClick={() => handleQuizAnswer(i)}
                    className="text-xs bg-secondary/60 hover:bg-primary/20 border border-border hover:border-primary/40 rounded-md px-3 py-2.5 text-secondary-foreground transition-all duration-200 text-left hover:scale-105 active:scale-95"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <button onClick={goBack} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-1">
                <ArrowLeft size={12} /> {quizStep === 0 ? t("exercise.cancel") : t("exercise.previousQuestion")}
              </button>
            </div>
          )}

          {quizResult && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <quizResult.icon size={22} className="text-primary" />
                <div>
                  <span className="font-display font-bold text-foreground">{quizResult.workout}</span>
                  <span className="text-[10px] ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full">{quizResult.app}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{quizResult.reason}</p>
              <Button variant="outline" size="sm" onClick={resetQuiz}>{t("exercise.tryAgain")}</Button>
            </div>
          )}
        </div>

        {/* Training Programs */}
        <div>
          <h2 className="font-display font-bold text-foreground mb-3">{t("exercise.trainingPrograms")}</h2>
          <YogaFlowProgram />
          {categoryKeys.map((key, i) => {
            const Icon = categoryIcons[key];
            const items = t(`exercise.categories.${key}.items`, { returnObjects: true }) as string[];
            return (
              <div key={key} className="bg-card border border-border rounded-lg p-4 mb-3 animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={20} className="text-primary" />
                  <h3 className="font-display font-bold text-foreground">{t(`exercise.categories.${key}.name`)}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t(`exercise.categories.${key}.desc`)}</p>
                <ul className="space-y-1.5">
                  {items.map(item => (
                    <li key={item} className="text-xs text-secondary-foreground/80 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Exercise;
