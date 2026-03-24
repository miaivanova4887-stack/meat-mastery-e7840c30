import { HealthDashboard } from '@/components/HealthDashboard';
import MotivationCTA from '@/components/MotivationCTA';
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ChevronRight, RotateCcw } from "lucide-react";
import CarnivoreXLogo from "@/components/CarnivoreXLogo";
import { useTranslation } from "react-i18next";
import heroMale from "@/assets/hero-athletic.jpg";
import heroFemale from "@/assets/hero-athletic-female.jpg";
import iconBenefits from "@/assets/icon-benefits.png";
import iconRecipes from "@/assets/icon-recipes.png";
import iconTimer from "@/assets/icon-timer.png";
import iconIngredients from "@/assets/icon-ingredients.png";
import iconExercise from "@/assets/icon-exercise.png";
import iconCravings from "@/assets/icon-cravings.png";
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

const featureLabelKeys: Record<string, string> = {
  "/benefits": "home.features.benefits",
  "/recipes": "home.features.recipes",
  "/timer": "home.features.ketosisTimer",
  "/ingredients": "home.features.ingredients",
  "/exercise": "home.features.exercise",
  "/cravings": "home.features.cravings",
  "/sustain": "home.features.sustainResults",
  "/myths": "home.features.mythsBusted",
  "/guide": "home.features.completeGuide",
  "/getting-started": "home.features.first30Days",
  "/budget": "home.features.eatOnBudget",
  "/athletic": "home.features.athleticFuel",
};

const getFeatures = (isFemale: boolean) => [
  { icon: iconBenefits, path: "/benefits", tags: [] as string[] },
  { icon: iconRecipes, path: "/recipes", tags: ["recipes"] },
  { icon: iconTimer, path: "/timer", tags: ["ketosis"] },
  { icon: iconIngredients, path: "/ingredients", tags: ["recipes"] },
  { icon: iconExercise, path: "/exercise", tags: ["exercise"] },
  { icon: iconCravings, path: "/cravings", tags: [] },
  { icon: isFemale ? iconSustainFemale : iconSustain, path: "/sustain", tags: [] },
  { icon: iconMyths, path: "/myths", tags: [] as string[] },
  { icon: iconGuide, path: "/guide", tags: [] as string[] },
  { icon: iconGettingStarted, path: "/getting-started", tags: [] as string[] },
  { icon: iconBudget, path: "/budget", tags: [] as string[] },
  { icon: isFemale ? iconAthleticFemale : iconAthletic, path: "/athletic", tags: ["exercise"] },
];

const Index = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const [showResetDrawer, setShowResetDrawer] = useState(false);
  const { t } = useTranslation();

  if (!isOnboardingComplete()) {
    return <Navigate to="/onboarding" replace />;
  }

  const isFemale = profile.body.sex === "female";
  const heroImage = isFemale ? heroFemale : heroMale;

  const sorted = [...getFeatures(isFemale)].sort((a, b) => {
    const aMatch = a.tags.some((tg) => profile.interests.includes(tg as any));
    const bMatch = b.tags.some((tg) => profile.interests.includes(tg as any));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });

  const greeting = t(`home.greetings.${profile.goal}`);
  const subtitle = t(`home.subtitles.${profile.goal}`);
  const quoteText = t(`quotes.${profile.goal}.text`);
  const quoteAuthor = t(`quotes.${profile.goal}.author`);

  const tip = profile.struggles.includes("sugar_cravings")
    ? t("home.tips.sugar_cravings")
    : profile.struggles.includes("low_energy")
    ? t("home.tips.low_energy")
    : profile.struggles.includes("digestive")
    ? t("home.tips.digestive")
    : profile.struggles.includes("social_pressure")
    ? t("home.tips.social_pressure")
    : null;

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      {/* Hero */}
      <div className="relative h-[58vh] overflow-hidden">
        <img src={heroImage} alt="Athletic motivation" className="absolute inset-0 w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/40" />
        {/* Accent glow behind hero */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-32 rounded-full blur-[80px] opacity-20"
          style={{ background: "linear-gradient(90deg, hsl(var(--flame)), hsl(var(--gold)))" }}
        />
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 8px)", paddingLeft: "16px", paddingRight: "16px" }}
        >
          <CarnivoreXLogo size="sm" className="animate-fade-in" />
          <ThemeToggle />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 pb-8">
          <div className="flex items-center gap-2 mb-2 animate-fade-in">
            <div className="w-5 h-[1.5px] rounded-full bg-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
              {t("home.healingJourney")}
            </p>
          </div>
          <h1 className="text-[2.2rem] font-black text-foreground leading-[1.02] tracking-[-0.02em]">
            {t("home.healthIsWealth")}<br />
            <span className="text-gradient-flame">{t("home.healthIsWealth2")}</span>
          </h1>
          <p className="text-muted-foreground mt-2.5 text-[13px] max-w-[280px] leading-relaxed font-light">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4 -mt-2 relative z-10">
        {tip && (
          <div className="ios-card px-4 py-3 animate-fade-in flex items-start gap-2.5">
            <span className="text-primary text-base mt-0.5">💡</span>
            <p className="text-xs text-foreground/80 leading-relaxed">{tip}</p>
          </div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-2 gap-3">
          {sorted.map(({ icon, path, tags }) => {
            const highlighted = tags.some((tg) => profile.interests.includes(tg as any));
            const label = t(featureLabelKeys[path] || path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`ios-card overflow-hidden text-left transition-all active:scale-[0.97] group ${
                  highlighted ? "ring-1 ring-primary/30" : ""
                }`}
              >
                <div className="relative h-24 w-full">
                  <img src={icon} alt={label} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                  {highlighted && (
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
                  )}
                </div>
                <div className="px-3 pb-3 pt-1.5 flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-semibold text-foreground block leading-tight">{label}</span>
                    {highlighted && (
                      <span className="text-[9px] text-primary mt-0.5 font-semibold uppercase tracking-wider block">{t("home.recommendedForYou")}</span>
                    )}
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground/60 shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Quote */}
        <div className="ios-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
          <p className="text-[13px] italic text-foreground/60 leading-relaxed pl-3">
            "{quoteText}"
          </p>
          <span className="text-[10px] text-muted-foreground mt-2 block font-medium uppercase tracking-wider pl-3">— {quoteAuthor}</span>
        </div>
        {/* Health Data */}
        <HealthDashboard />
        {/* Motivation CTA — navigates to goal-relevant page */}
        <MotivationCTA />

        {/* Update preferences */}
        <button
          onClick={() => setShowResetDrawer(true)}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          <RotateCcw size={13} />
          {t("home.updatePreferences")}
        </button>
      </div>

      {/* Drawer */}
      <Drawer open={showResetDrawer} onOpenChange={setShowResetDrawer}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{t("home.resetTitle")}</DrawerTitle>
            <DrawerDescription>{t("home.resetDesc")}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-row gap-3">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">{t("home.cancel")}</Button>
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
              {t("home.resetRedo")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Index;
