import { useState } from "react";
import { ArrowLeft, Dumbbell, Heart, Zap, Wind, Sparkles, Sun, Moon, Flame, TreePine, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const exercises = [
  { icon: Dumbbell, category: "Strength Training", desc: "The carnivore diet provides optimal protein for muscle growth. Focus on compound movements.", items: ["Deadlifts — 3x5 heavy", "Squats — 4x6", "Bench Press — 4x8", "Overhead Press — 3x8", "Barbell Rows — 4x8", "Pull-ups — 3 sets to failure"] },
  { icon: Zap, category: "High-Intensity (HIIT)", desc: "Short bursts maximize fat burning and hormonal response. Keep sessions under 20 minutes.", items: ["Sprint intervals — 30s on/60s off x 8", "Kettlebell swings — 5x20", "Battle ropes — 4x30s", "Burpees — Tabata style"] },
  { icon: Wind, category: "Low-Intensity Steady State", desc: "Walking and light movement support recovery and fat oxidation without spiking cortisol.", items: ["Brisk walking — 30-60 min daily", "Swimming — 30 min easy pace", "Cycling — 45 min moderate", "Yoga/stretching — 20 min"] },
  { icon: Heart, category: "Recovery", desc: "Recovery is where growth happens. The carnivore diet accelerates recovery through nutrient density.", items: ["Cold exposure — 2-5 min cold shower", "Foam rolling — 15 min", "Sleep 7-9 hours nightly", "Sauna — 15-20 min sessions"] },
];

const yogaStyles = [
  { icon: Sun, name: "Vinyasa Flow", level: "All Levels", duration: "30-60 min", desc: "Dynamic sequences linking breath to movement. Builds heat and improves cardiovascular endurance — perfect post-carnivore energy.", color: "text-accent" },
  { icon: Flame, name: "Power Yoga", level: "Intermediate+", duration: "45-60 min", desc: "Strength-focused sequences with longer holds. Complements heavy lifting days and builds functional muscle endurance.", color: "text-destructive" },
  { icon: Moon, name: "Yin Yoga", level: "All Levels", duration: "45-75 min", desc: "Deep passive stretches held 3-5 minutes. Targets fascia and connective tissue — ideal on rest days.", color: "text-primary" },
  { icon: TreePine, name: "Hatha", level: "Beginner-Friendly", duration: "45-60 min", desc: "Classic postures with steady pacing. Great for building foundational flexibility and body awareness.", color: "text-secondary-foreground" },
  { icon: Sparkles, name: "Restorative", level: "All Levels", duration: "60-90 min", desc: "Supported poses with props for total relaxation. Activates parasympathetic nervous system to optimize recovery.", color: "text-muted-foreground" },
  { icon: Wind, name: "Breathwork & Mobility", level: "All Levels", duration: "15-30 min", desc: "Pranayama techniques paired with joint mobility drills. A carnivore-friendly warm-up or cooldown.", color: "text-smoke" },
];

// Quiz data
const quizQuestions = [
  { q: "What's your energy level right now?", options: ["🔥 Fired up", "😌 Calm & steady", "😴 Low / fatigued", "⚡ Restless"] },
  { q: "What does your body need today?", options: ["💪 Strength", "🧘 Flexibility", "🫁 Breathwork", "🛌 Recovery"] },
  { q: "How much time do you have?", options: ["15 min", "30 min", "45 min", "60+ min"] },
  { q: "How sore are you from yesterday?", options: ["😎 Not at all", "🤏 A little tight", "😬 Pretty sore", "🫠 Can barely move"] },
  { q: "What's your mood?", options: ["🧠 Focused & driven", "🌊 Go with the flow", "😤 Need to blow off steam", "🕊️ Seeking peace"] },
];

type QuizResult = { workout: string; icon: typeof Dumbbell; reason: string };

function getQuizResult(answers: number[]): QuizResult {
  const [energy, need, _time, soreness, mood] = answers;
  // Heavy soreness or recovery need → restorative
  if (soreness >= 2 || need === 3) return { workout: "Restorative Yoga", icon: Sparkles, reason: "Your body is calling for deep recovery. Supported poses + carnivore nutrition will rebuild you faster." };
  // Fired up + strength + driven → power
  if (energy === 0 && need === 0) return { workout: "Power Yoga + Strength", icon: Flame, reason: "You're fired up and craving strength — channel that protein-fueled energy into power sequences." };
  // Need to blow off steam → HIIT
  if (mood === 2) return { workout: "HIIT Sprint Session", icon: Zap, reason: "You've got steam to release. Short intense bursts will clear your head and torch energy." };
  // Seeking peace + flexibility → Yin
  if (mood === 3 && need === 1) return { workout: "Yin Yoga", icon: Moon, reason: "Peace + flexibility — long passive holds will quiet your mind and open tight tissues." };
  // High energy + flow mood → Vinyasa
  if (energy === 0 || mood === 1) return { workout: "Vinyasa Flow", icon: Sun, reason: "High energy meets go-with-the-flow mindset. Ride the wave through dynamic sequences." };
  // Low energy → Yin
  if (energy === 2) return { workout: "Yin Yoga", icon: Moon, reason: "Low energy days are ideal for deep passive stretches. Let gravity do the work." };
  // Breathwork need
  if (need === 2) return { workout: "Breathwork & Mobility", icon: Wind, reason: "Pranayama will reset your nervous system and prep your joints for tomorrow." };
  // Focused + flexibility → Hatha
  if (mood === 0) return { workout: "Hatha Yoga", icon: TreePine, reason: "Your focused mindset pairs perfectly with deliberate, steady-paced postures." };
  return { workout: "Hatha Yoga", icon: TreePine, reason: "A grounded Hatha session matches your current state — steady and intentional." };
}

const Exercise = () => {
  const navigate = useNavigate();
  const [quizStep, setQuizStep] = useState(-1); // -1 = not started, 0-2 = questions, 3 = result
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  const handleQuizAnswer = (answerIdx: number) => {
    const next = [...quizAnswers, answerIdx];
    setQuizAnswers(next);
    setQuizStep((s) => s + 1);
  };

  const resetQuiz = () => { setQuizStep(-1); setQuizAnswers([]); };

  const quizResult = quizStep === 3 ? getQuizResult(quizAnswers) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Exercise & Movement</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Quick Quiz Card */}
        <div className="bg-card border border-primary/30 rounded-lg p-4 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-accent" />
            <h2 className="font-display font-bold text-foreground text-sm">What Should I Do Today?</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Quick 3-question quiz to find your ideal workout</p>

          {quizStep === -1 && (
            <Button size="sm" className="gap-1.5" onClick={() => setQuizStep(0)}>
              Take the Quiz <ChevronRight size={14} />
            </Button>
          )}

          {quizStep >= 0 && quizStep < 3 && (
            <div className="space-y-3 animate-fade-in-up">
              <Progress value={((quizStep + 1) / 3) * 100} className="h-1.5" />
              <p className="text-sm font-medium text-foreground">{quizQuestions[quizStep].q}</p>
              <div className="grid grid-cols-2 gap-2">
                {quizQuestions[quizStep].options.map((opt, i) => (
                  <button
                    key={opt}
                    onClick={() => handleQuizAnswer(i)}
                    className="text-xs bg-secondary/60 hover:bg-primary/20 border border-border hover:border-primary/40 rounded-md px-3 py-2.5 text-secondary-foreground transition-colors text-left"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {quizResult && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <quizResult.icon size={22} className="text-primary" />
                <span className="font-display font-bold text-foreground">{quizResult.workout}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{quizResult.reason}</p>
              <Button variant="outline" size="sm" onClick={resetQuiz}>Try Again</Button>
            </div>
          )}
        </div>

        {/* Yoga Styles Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sun size={18} className="text-accent" />
            <h2 className="font-display font-bold text-foreground">Yoga & Mobility</h2>
            <span className="text-[10px] text-muted-foreground ml-auto italic">inspired by Yoga Buddi Co.</span>
          </div>
          <div className="space-y-3">
            {yogaStyles.map(({ icon: Icon, name, level, duration, desc, color }, i) => (
              <div key={name} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className={color} />
                    <h3 className="font-display font-bold text-foreground text-sm">{name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-full">{level}</span>
                    <span className="text-[10px] bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-full">{duration}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
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
