import { ArrowLeft, ShieldCheck, Coffee, Droplets, Moon, Brain, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MotivationCTA from "@/components/MotivationCTA";
import ArticleFeedback from "@/components/ArticleFeedback";
import DismissibleCard from "@/components/DismissibleCard";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const strategyKeys = [
  { id: "fat", icon: Utensils },
  { id: "hydrate", icon: Droplets },
  { id: "coffee", icon: Coffee },
  { id: "sleep", icon: Moon },
  { id: "withdrawal", icon: Brain },
  { id: "temptation", icon: ShieldCheck },
];

const Cravings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();
  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("cravings.title")}</h1>
      </div>
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl p-4">
        <p className="text-xs text-muted-foreground mb-4">{t("cravings.intro")}</p>
        <div className="space-y-3">
          {strategyKeys.map(({ id, icon: Icon }, i) => (
            <div key={id} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-accent"><Icon size={18} className="text-accent-foreground" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">{t(`cravings.items.${id}.title`)}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(`cravings.items.${id}.desc`)}</p>
                </div>
              </div>
              <ArticleFeedback articleId={`cravings-${id}`} question={t(`cravings.items.${id}.q`)} />
            </div>
          ))}
        </div>
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Cravings;
