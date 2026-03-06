import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Flame, BookOpen, Timer, Dumbbell, Heart, Shield, Zap, Apple, RotateCcw } from "lucide-react";
import heroImage from "@/assets/hero-steak.jpg";
import ThemeToggle from "@/components/ThemeToggle";
import { isOnboardingComplete } from "./Onboarding";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { Goal } from "@/contexts/UserProfileContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const allFeatures = [
  { icon: Zap, label: "Benefits", path: "/benefits", color: "text-gold", tags: [] as string[] },
  { icon: BookOpen, label: "Recipes", path: "/recipes", color: "text-primary", tags: ["recipes"] },
  { icon: Timer, label: "Ketosis Timer", path: "/timer", color: "text-flame", tags: ["ketosis"] },
  { icon: Apple, label: "Ingredients", path: "/ingredients", color: "text-ember", tags: ["recipes"] },
  { icon: Dumbbell, label: "Exercise", path: "/exercise", color: "text-primary", tags: ["exercise"] },
  { icon: Shield, label: "Cravings", path: "/cravings", color: "text-gold", tags: [] },
  { icon: Heart, label: "Success Stories", path: "/stories", color: "text-accent", tags: [] },
  { icon: Flame, label: "Sustain Results", path: "/sustain", color: "text-flame", tags: [] },
];

const greetings: Record<Goal, string> = {
  lose_weight: "Let's burn fat today 🔥",
  build_muscle: "Time to build strength 💪",
  maintain: "Stay consistent, stay strong ⚖️",
  improve_health: "Your healing journey continues ❤️",
};

const subtitles: Record<Goal, string> = {
  lose_weight: "High-protein, zero-carb fuel for maximum fat loss.",
  build_muscle: "Fuel your gains with nature's most anabolic diet.",
  maintain: "Steady nutrition for sustained performance.",
  improve_health: "Let food be your medicine — meat heals.",
};

const quotes: Record<Goal, { text: string; author: string }> = {
  lose_weight: { text: "Fat adaptation is the metabolic superpower that makes carnivore the ultimate weight loss tool.", author: "Dr. Ken Berry" },
  build_muscle: { text: "Animal protein is the most bioavailable source of amino acids for muscle growth. Period.", author: "Dr. Shawn Baker" },
  maintain: { text: "The carnivore diet is the elimination diet that helps you discover what your body truly needs.", author: "Dr. Shawn Baker" },
  improve_health: { text: "When you remove the things that harm you and eat the things that heal you, the body knows what to do.", author: "Dr. Paul Saladino" },
};

const Index = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const [showResetDialog, setShowResetDialog] = useState(false);

  if (!isOnboardingComplete()) {
    return <Navigate to="/onboarding" replace />;
  }

  // Sort features: user interests first, then the rest
  const sorted = [...allFeatures].sort((a, b) => {
    const aMatch = a.tags.some((t) => profile.interests.includes(t as any));
    const bMatch = b.tags.some((t) => profile.interests.includes(t as any));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });

  const greeting = greetings[profile.goal];
  const subtitle = subtitles[profile.goal];
  const quote = quotes[profile.goal];

  // Personalized tips based on struggles
  const tip = profile.struggles.includes("sugar_cravings")
    ? "💡 Craving sweets? Try bone broth or fatty cuts — they crush sugar cravings fast."
    : profile.struggles.includes("low_energy")
    ? "💡 Low energy? Make sure you're eating enough fat — it's your new fuel source."
    : profile.struggles.includes("digestive")
    ? "💡 Digestive adjustment is normal. Stick with fattier cuts and give your gut time."
    : profile.struggles.includes("social_pressure")
    ? "💡 Facing pushback? Check out Success Stories from people who've been there."
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative h-[50vh] overflow-hidden">
        <img src={heroImage} alt="Seared steak on flame" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-8">
          <p className="text-sm text-primary font-semibold mb-1 animate-fade-in">{greeting}</p>
          <h1 className="text-3xl font-display font-bold text-foreground leading-tight tracking-tight">
            Carnivore<br />Lifestyle
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm max-w-xs">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Personalized tip */}
      {tip && (
        <div className="px-4 -mt-2 mb-3 relative z-10">
          <div className="ios-card px-4 py-3 animate-fade-in">
            <p className="text-xs text-foreground leading-relaxed">{tip}</p>
          </div>
        </div>
      )}

      {/* Feature Grid — sorted by interests */}
      <div className="px-4 -mt-2 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(({ icon: Icon, label, path, color, tags }, i) => {
            const highlighted = tags.some((t) => profile.interests.includes(t as any));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`ios-card p-4 text-left transition-all active:scale-[0.97] group ${
                  highlighted ? "ring-1 ring-primary/20" : ""
                }`}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <Icon size={22} strokeWidth={1.8} className={`${color} mb-2 group-hover:scale-110 transition-transform`} />
                <span className="text-sm font-semibold text-foreground">{label}</span>
                {highlighted && <span className="block text-[10px] text-primary mt-0.5">For you</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Redo onboarding */}
      <div className="px-4 mt-4">
        <button
          onClick={() => setShowResetDialog(true)}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-3"
        >
          <RotateCcw size={14} />
          Update your preferences
        </button>
      </div>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your preferences?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your current profile and restart the onboarding quiz. Your personalized content will update based on your new answers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                localStorage.removeItem("carnivore-onboarding-complete");
                localStorage.removeItem("carnivore-onboarding-answers");
                localStorage.removeItem("carnivore-onboarding-body");
                navigate("/onboarding");
              }}
            >
              Reset & Redo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quote — personalized */}
      <div className="px-4 mt-3">
        <div className="ios-card p-5">
          <p className="text-sm italic text-foreground/80 leading-relaxed">
            "{quote.text}"
          </p>
          <span className="text-xs text-muted-foreground mt-2 block">— {quote.author}</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
