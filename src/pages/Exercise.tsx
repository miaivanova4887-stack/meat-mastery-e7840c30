import { useState } from "react";
import { ArrowLeft, Dumbbell, Heart, Zap, Wind, Sparkles, Sun, Moon, ChevronRight, Activity, Music, Brain, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { ActivityLevel, Goal } from "@/contexts/UserProfileContext";
import { useTranslation } from "react-i18next";

const exercises = [
  { icon: Dumbbell, category: "Strength Training", desc: "The carnivore diet provides optimal protein for muscle growth. Focus on compound movements.", items: ["Deadlifts — 3x5 heavy", "Squats — 4x6", "Bench Press — 4x8", "Overhead Press — 3x8", "Barbell Rows — 4x8", "Pull-ups — 3 sets to failure"] },
  { icon: Zap, category: "High-Intensity (HIIT)", desc: "Short bursts maximize fat burning and hormonal response. Keep sessions under 20 minutes.", items: ["Sprint intervals — 30s on/60s off x 8", "Kettlebell swings — 5x20", "Battle ropes — 4x30s", "Burpees — Tabata style"] },
  { icon: Wind, category: "Low-Intensity Steady State", desc: "Walking and light movement support recovery and fat oxidation without spiking cortisol.", items: ["Brisk walking — 30-60 min daily", "Swimming — 30 min easy pace", "Cycling — 45 min moderate", "Yoga/stretching — 20 min"] },
  { icon: Heart, category: "Recovery", desc: "Recovery is where growth happens. The carnivore diet accelerates recovery through nutrient density.", items: ["Cold exposure — 2-5 min cold shower", "Foam rolling — 15 min", "Sleep 7-9 hours nightly", "Sauna — 15-20 min sessions"] },
];



// Quiz — 7 questions to cover all Buddhi apps
const TOTAL_QUESTIONS = 7;
const quizQuestions = [
  { q: "What's your energy level right now?", options: ["🔥 Fired up", "😌 Calm & steady", "😴 Low / fatigued", "⚡ Restless"] },
  { q: "What does your body need today?", options: ["💪 Strength & power", "🧘 Flexibility & stretch", "🫁 Breathwork & calm", "🛌 Deep recovery"] },
  { q: "How much time do you have?", options: ["15 min", "30 min", "45 min", "60+ min"] },
  { q: "How sore are you from yesterday?", options: ["😎 Not at all", "🤏 A little tight", "😬 Pretty sore", "🫠 Can barely move"] },
  { q: "What's your mood?", options: ["🧠 Focused & driven", "🌊 Go with the flow", "😤 Need to blow off steam", "🕊️ Seeking peace"] },
  { q: "What kind of movement appeals to you?", options: ["🏋️ Explosive & intense", "🩰 Controlled & precise", "🧘 Slow & grounding", "💃 Rhythmic & graceful"] },
  { q: "What's your main goal right now?", options: ["🔥 Burn fat & get lean", "💪 Build strength", "🧠 Mental clarity", "😌 Stress relief"] },
];

type QuizResult = { workout: string; app: string; icon: typeof Dumbbell; reason: string };

function getQuizResult(answers: number[]): QuizResult {
  const [energy, need, _time, soreness, mood, movement, goal] = answers;

  // Heavy soreness or recovery need → Restorative / Meditation
  if (soreness >= 3) return { workout: "Sleep Meditation", app: "Meditation", icon: Brain, reason: "Your body can barely move — let a guided sleep meditation activate deep recovery while carnivore nutrition rebuilds you." };
  if (soreness >= 2 && need === 3) return { workout: "Restorative Yoga", app: "Yoga", icon: Sun, reason: "Sore and needing recovery. Supported poses will gently release tension without taxing your muscles." };
  if (need === 3) return { workout: "Body Scan Meditation", app: "Meditation", icon: Brain, reason: "Your body is asking for deep rest. A body scan will release tension layer by layer." };

  // Blow off steam + explosive → HIIT
  if (mood === 2 && movement === 0) return { workout: "Full Body Burn HIIT", app: "HIIT", icon: Zap, reason: "Frustration + explosive energy = the perfect HIIT storm. Unleash it all in 25 minutes." };
  if (mood === 2) return { workout: "Tabata HIIT", app: "HIIT", icon: Zap, reason: "You need to blow off steam. Tabata's 20s max-effort intervals will empty the tank fast." };

  // Fired up + strength → Power Yoga or Power Pilates
  if (energy === 0 && need === 0 && movement === 1) return { workout: "Power Pilates", app: "Pilates", icon: Activity, reason: "Fired up and craving controlled strength — Power Pilates will challenge every stabilizer muscle." };
  if (energy === 0 && need === 0) return { workout: "Power Yoga", app: "Yoga", icon: Sun, reason: "High energy + strength craving — channel that protein-fueled power into intense hold sequences." };

  // Rhythmic & graceful → Barre
  if (movement === 3 && goal === 0) return { workout: "Cardio Barre", app: "Barre", icon: Music, reason: "Graceful movement meets fat burning. Cardio Barre sculpts and torches in equal measure." };
  if (movement === 3) return { workout: "Classic Barre", app: "Barre", icon: Music, reason: "Your body wants rhythm and grace. Ballet-inspired micro-movements will sculpt lean muscle beautifully." };

  // Controlled & precise → Pilates
  if (movement === 1 && goal === 1) return { workout: "Mat Pilates", app: "Pilates", icon: Activity, reason: "Precision meets strength. Mat Pilates builds the deep core stability that powers all your lifts." };
  if (movement === 1) return { workout: "Core Blast Pilates", app: "Pilates", icon: Activity, reason: "Your desire for control pairs perfectly with targeted core and stability work." };

  // Mental clarity or stress relief → Meditation
  if (goal === 2 && energy === 2) return { workout: "Guided Mindfulness", app: "Meditation", icon: Brain, reason: "Low energy + mental clarity goal = mindfulness is your medicine. 15 minutes to reset." };
  if (goal === 3 && mood === 3) return { workout: "Breathwork", app: "Meditation", icon: Brain, reason: "Peace-seeking + stress relief — pranayama will downregulate your entire nervous system." };

  // Seeking peace + flexibility → Yin
  if (mood === 3 && need === 1) return { workout: "Yin Yoga", app: "Yoga", icon: Sun, reason: "Peace + flexibility — long passive holds will quiet your mind and open tight tissues." };

  // High energy + flow → Vinyasa or HIIT
  if (energy === 0 && goal === 0) return { workout: "EMOM HIIT", app: "HIIT", icon: Zap, reason: "Fired up and want to get lean — EMOM intervals maximize output and fat burning." };
  if (energy === 0 || mood === 1) return { workout: "Vinyasa Flow", app: "Yoga", icon: Sun, reason: "High energy meets a go-with-the-flow mindset. Ride the wave through dynamic sequences." };

  // Low energy → gentle options
  if (energy === 2 && movement === 2) return { workout: "Yin Yoga", app: "Yoga", icon: Sun, reason: "Low energy + slow grounding = perfect Yin conditions. Let gravity do the work." };
  if (energy === 2) return { workout: "Barre Stretch", app: "Barre", icon: Music, reason: "Low energy doesn't mean no movement. Gentle ballet stretches will restore without draining you." };

  // Breathwork need
  if (need === 2) return { workout: "Breathwork", app: "Meditation", icon: Brain, reason: "Pranayama will reset your nervous system and prep your body for tomorrow." };

  // Slow & grounding → Hatha
  if (movement === 2) return { workout: "Hatha Yoga", app: "Yoga", icon: Sun, reason: "Slow, grounding postures match your desire for intentional movement." };

  // Fat burn fallback → Cardio Barre or HIIT
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

  
  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("exercise.title")}</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Personalized recommendation */}
        {profile.isComplete && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3 animate-fade-in">
            <Info size={18} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">Your plan</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {profile.goal === "lose_weight" && profile.activityLevel === "sedentary" && "Start with daily walks and low-impact HIIT. Build the habit, then increase intensity."}
                {profile.goal === "lose_weight" && profile.activityLevel === "light" && "Add 2-3 HIIT sessions per week alongside your walking. Fat will melt off on carnivore."}
                {profile.goal === "lose_weight" && (profile.activityLevel === "moderate" || profile.activityLevel === "very_active") && "Your activity level is great for fat loss. Mix strength training with HIIT for maximum results."}
                {profile.goal === "build_muscle" && "Focus on strength training 4-5x/week. Carnivore provides the protein — you provide the effort."}
                {profile.goal === "maintain" && "Keep a balanced mix of strength, cardio, and recovery. Consistency beats intensity."}
                {profile.goal === "improve_health" && profile.activityLevel === "sedentary" && "Start gentle — yoga, walking, and breathwork. Movement is medicine, especially on carnivore."}
                {profile.goal === "improve_health" && profile.activityLevel !== "sedentary" && "Pair your workouts with recovery practices. Yoga and meditation amplify carnivore's healing effects."}
              </p>
            </div>
          </div>
        )}
        {/* Quick Quiz Card */}
        <div className="bg-card border border-primary/30 rounded-lg p-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-accent" />
            <h2 className="font-display font-bold text-foreground text-sm">What Should I Do Today?</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Quick 7-question quiz to find your ideal workout</p>

          {quizStep === -1 && (
            <Button size="sm" className="gap-1.5 animate-scale-in" onClick={() => setQuizStep(0)}>
              Take the Quiz <ChevronRight size={14} />
            </Button>
          )}

          {quizStep >= 0 && quizStep < TOTAL_QUESTIONS && (
            <div className={`space-y-3 transition-all duration-250 ease-out ${transitioning ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
              <Progress value={((quizStep + 1) / TOTAL_QUESTIONS) * 100} className="h-1.5 transition-all duration-500" />
              <p className="text-sm font-medium text-foreground">{quizQuestions[quizStep].q}</p>
              <div className="grid grid-cols-2 gap-2">
                {quizQuestions[quizStep].options.map((opt, i) => (
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
                <ArrowLeft size={12} /> {quizStep === 0 ? "Cancel" : "Previous question"}
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
              <Button variant="outline" size="sm" onClick={resetQuiz}>Try Again</Button>
            </div>
          )}
        </div>



        {/* Original workout categories */}
        <div>
          <h2 className="font-display font-bold text-foreground mb-3">Training Programs</h2>
          {exercises.map(({ icon: Icon, category, desc, items }, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 mb-3 animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={20} className="text-primary" />
                <h3 className="font-display font-bold text-foreground">{category}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{desc}</p>
              <ul className="space-y-1.5">
                {items.map(item => (
                  <li key={item} className="text-xs text-secondary-foreground/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Exercise;
