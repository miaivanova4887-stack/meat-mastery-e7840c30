import { ArrowLeft, Target, RefreshCw, Users, BarChart3, Calendar, BookHeart, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MotivationCTA from "@/components/MotivationCTA";
import ArticleFeedback from "@/components/ArticleFeedback";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const tipKeys = [
  { id: "goals", icon: Target, link: "/progress" },
  { id: "prep", icon: Calendar, link: "/meal-plan" },
  { id: "rotate", icon: RefreshCw, link: "/ingredients" },
  { id: "community", icon: Users, link: "/community" },
  { id: "track", icon: BarChart3, link: "/progress" },
  { id: "lifestyle", icon: BookHeart, link: "/guide" },
];

const Sustain = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();
  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("sustain.title")}</h1>
      </div>
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl p-4">
        <p className="text-xs text-muted-foreground mb-4">{t("sustain.intro")}</p>
        <div className="space-y-3">
          {tipKeys.map(({ id, icon: Icon, link }, i) => (
              <div key={id} className={`bg-card border border-border rounded-lg p-4 animate-fade-in-up ${link ? "cursor-pointer hover:border-primary/40 active:scale-[0.98] transition-all" : ""}`} style={{ animationDelay: `${i * 0.05}s` }} onClick={link ? () => navigate(link) : undefined}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-accent"><Icon size={18} className="text-accent-foreground" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">{t(`sustain.items.${id}.title`)}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(`sustain.items.${id}.desc`)}</p>
                  </div>
                  {link && <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ArticleFeedback articleId={`sustain-${id}`} question={t(`sustain.items.${id}.q`)} />
                </div>
              </div>
          ))}
        </div>
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Sustain;
