import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ChevronRight, RotateCcw, Phone } from "lucide-react";
import heroMale from "@/assets/hero-athletic.jpg";
import heroFemale from "@/assets/hero-athletic-female.jpg";
import iconBenefits from "@/assets/icon-benefits.png";
import iconRecipes from "@/assets/icon-recipes.png";
import iconTimer from "@/assets/icon-timer.png";
import iconIngredients from "@/assets/icon-ingredients.png";
import iconExercise from "@/assets/icon-exercise.png";
import iconCravings from "@/assets/icon-cravings.png";
import iconStories from "@/assets/icon-stories.png";
import iconSustain from "@/assets/icon-sustain.png";
import iconSustainFemale from "@/assets/icon-sustain-female.png";
import iconMyths from "@/assets/icon-myths.png";
import iconGuide from "@/assets/icon-guide-modern.png";
import iconGettingStarted from "@/assets/icon-getting-started.png";
import iconBudget from "@/assets/icon-budget.png";
import iconAthletic from "@/assets/icon-athletic.png";
import iconAthleticFemale from "@/assets/icon-athletic-female.png";
import ThemeToggle from "@/components/ThemeToggle";
import { isOnboardingComplete } from "./Onboarding";
import { useUserProfile } from "@/contexts/UserProfileContext";
import type { Goal } from "@/contexts/UserProfileContext";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

// Replace with your actual Calendly link
const CALENDLY_URL = "https://calendly.com";

const getFeatures = (isFemale: boolean) => [
  { icon: iconBenefits, label: "Benefits", path: "/benefits", tags: [] as string[] },
  { icon: iconRecipes, label: "Recipes", path: "/recipes", tags: ["recipes"] },
  { icon: iconTimer, label: "Ketosis Timer", path: "/timer", tags: ["ketosis"] },
  { icon: iconIngredients, label: "Ingredients", path: "/ingredients", tags: ["recipes"] },
  { icon: iconExercise, label: "Exercise", path: "/exercise", tags: ["exercise"] },
  { icon: iconCravings, label: "Cravings", path: "/cravings", tags: [] },
  // { icon: iconStories, label: "Success Stories", path: "/stories", tags: [] },
  { icon: isFemale ? iconSustainFemale : iconSustain, label: "Sustain Results", path: "/sustain", tags: [] },
  { icon: iconMyths, label: "Myths Busted", path: "/myths", tags: [] as string[] },
  { icon: iconGuide, label: "Complete Guide", path: "/guide", tags: [] as string[] },
  { icon: iconGettingStarted, label: "First 30 Days", path: "/getting-started", tags: [] as string[] },
  { icon: iconBudget, label: "Eat on a Budget", path: "/budget", tags: [] as string[] },
  { icon: isFemale ? iconAthleticFemale : iconAthletic, label: "Athletic Fuel", path: "/athletic", tags: ["exercise"] },
];

const greetings: Record<Goal, string> = {
  lose_weight: "Let's burn fat today",
  build_muscle: "Time to build strength",
  maintain: "Stay consistent, stay strong",
  improve_health: "Your healing journey continues",
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
  const [showResetDrawer, setShowResetDrawer] = useState(false);

  if (!isOnboardingComplete()) {
    return <Navigate to="/onboarding" replace />;
  }

  const isFemale = profile.body.sex === "female";
  const heroImage = isFemale ? heroFemale : heroMale;

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

  const tip = profile.struggles.includes("sugar_cravings")
    ? "Craving sweets? Try bone broth or fatty cuts — they crush sugar cravings fast."
    : profile.struggles.includes("low_energy")
    ? "Low energy? Make sure you're eating enough fat — it's your new fuel source."
    : profile.struggles.includes("digestive")
    ? "Digestive adjustment is normal. Stick with fattier cuts and give your gut time."
    : profile.struggles.includes("social_pressure")
    ? "Facing pushback? Check out Success Stories from people who've been there."
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative h-[55vh] overflow-hidden">
        <img src={heroImage} alt="Athletic motivation" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-black/30" />
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2 animate-fade-in">
            {greeting}
          </p>
          <h1 className="text-4xl font-display font-black text-foreground leading-[1.05] tracking-tight">
            Health is<br />Wealth.
          </h1>
          <p className="text-muted-foreground mt-2 text-[13px] max-w-[280px] leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4 -mt-2 relative z-10">
        {/* Personalized tip */}
        {tip && (
          <div className="ios-card px-4 py-3 animate-fade-in flex items-start gap-2.5">
            <span className="text-primary text-base mt-0.5">💡</span>
            <p className="text-xs text-foreground/80 leading-relaxed">{tip}</p>
          </div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(({ icon, label, path, tags }) => {
            const highlighted = tags.some((t) => profile.interests.includes(t as any));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`ios-card overflow-hidden text-left transition-all active:scale-[0.97] group ${
                  highlighted ? "ring-1 ring-primary/20" : ""
                }`}
              >
                <div className="relative h-24 w-full">
                  <img src={icon} alt={label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                </div>
                <div className="px-3 pb-3 pt-1 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-foreground block">{label}</span>
                    {highlighted && (
                      <span className="text-[10px] text-primary mt-0.5 font-semibold block">Recommended for you</span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Quote */}
        <div className="ios-card p-5">
          <p className="text-[13px] italic text-foreground/60 leading-relaxed">
            "{quote.text}"
          </p>
          <span className="text-[11px] text-muted-foreground mt-2 block font-medium">— {quote.author}</span>
        </div>

        {/* Motivation CTA — Calendly */}
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full ios-card p-4 flex items-center gap-3 active:scale-[0.98] transition-all block"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone size={18} className="text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-[13px] font-bold text-foreground">Need extra motivation?</p>
            <p className="text-[11px] text-muted-foreground">Talk to seasoned carnivores — book a free call.</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </a>

        {/* Update preferences */}
        <button
          onClick={() => setShowResetDrawer(true)}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <RotateCcw size={13} />
          Update your preferences
        </button>
      </div>

      {/* Slide-up Drawer for preferences reset */}
      <Drawer open={showResetDrawer} onOpenChange={setShowResetDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Reset your preferences?</DrawerTitle>
            <DrawerDescription>
              This will restart the onboarding quiz. Your personalized content will update based on your new answers.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">Cancel</Button>
            </DrawerClose>
            <Button
              className="flex-1"
              onClick={() => {
                localStorage.removeItem("carnivore-onboarding-complete");
                localStorage.removeItem("carnivore-onboarding-answers");
                localStorage.removeItem("carnivore-onboarding-body");
                navigate("/onboarding");
              }}
            >
              Reset & Redo
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Index;
