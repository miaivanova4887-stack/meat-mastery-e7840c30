import { ArrowLeft, Zap, Brain, Heart, Scale, Flame, Shield, Eye, BatteryCharging, Leaf, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/contexts/UserProfileContext";
import MotivationCTA from "@/components/MotivationCTA";
import ArticleFeedback from "@/components/ArticleFeedback";
import { useTranslation } from "react-i18next";

const benefitKeys = [
  { id: "inflammation", icon: Flame },
  { id: "autophagy", icon: Sparkles },
  { id: "clarity", icon: Brain },
  { id: "fatloss", icon: Scale },
  { id: "gut", icon: Shield },
  { id: "energy", icon: BatteryCharging },
];

const femaleBenefits = [{ id: "hormones_f", icon: Heart }];
const maleBenefits = [
  { id: "testosterone", icon: Zap },
  { id: "lean_muscle", icon: Shield },
];
const commonTail = [
  { id: "clean", icon: Leaf },
  { id: "glow", icon: Eye },
  { id: "no_counting", icon: Scale },
  { id: "sports", icon: Zap },
  { id: "stress", icon: Shield },
];

const Benefits = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const { t } = useTranslation();
  const isFemale = profile.body.sex === "female";
  const isMale = profile.body.sex === "male";

  const keys = [
    ...benefitKeys,
    ...(isFemale ? femaleBenefits : []),
    ...(isMale ? maleBenefits : []),
    ...commonTail,
  ];

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("benefits.title")}</h1>
      </div>
      <div className="p-4 space-y-3">
        {keys.map(({ id, icon: Icon }, i) => (
          <div key={id} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10"><Icon size={20} className="text-primary" /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">{t(`benefits.items.${id}.title`)}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(`benefits.items.${id}.desc`)}</p>
              </div>
            </div>
            <ArticleFeedback articleId={`benefits-${id}`} question={t(`benefits.items.${id}.q`)} />
          </div>
        ))}
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Benefits;
