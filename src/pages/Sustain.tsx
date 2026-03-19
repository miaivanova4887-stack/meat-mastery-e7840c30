import { ArrowLeft, Target, RefreshCw, Users, BarChart3, Calendar, BookHeart, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MotivationCTA from "@/components/MotivationCTA";
import ArticleFeedback from "@/components/ArticleFeedback";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const tips = [
  { id: "goals", icon: Target, title: "Set Non-Scale Goals", desc: "Track energy, sleep quality, mental clarity, and strength gains — not just weight. These victories keep motivation alive long-term.", link: "/progress", q: "Do you track non-scale goals?" },
  { id: "prep", icon: Calendar, title: "Meal Prep Weekly", desc: "Cook in bulk on weekends. Pre-cooked ground beef, hard-boiled eggs, and pre-seasoned steaks make compliance effortless during busy weeks.", link: "/meal-plan", q: "Do you meal prep regularly?" },
  { id: "rotate", icon: RefreshCw, title: "Rotate Your Proteins", desc: "Avoid food fatigue by rotating beef, lamb, pork, seafood, and organ meats. Variety within carnivore keeps meals exciting.", link: "/ingredients", q: "Do you rotate your protein sources?" },
  { id: "community", icon: Users, title: "Join a Community", desc: "Connect with other carnivores online or locally. Accountability and shared experiences make the lifestyle feel natural, not restrictive.", link: "/community", q: "Are you part of a community?" },
  { id: "track", icon: BarChart3, title: "Track Your Progress", desc: "Take monthly photos, track body measurements, and log how you feel. Reviewing progress during tough weeks reignites motivation.", link: "/progress", q: "Are you tracking your progress?" },
  { id: "lifestyle", icon: BookHeart, title: "Embrace It as Lifestyle", desc: "This isn't a 30-day challenge — it's how humans ate for millennia. Shift your mindset from 'diet' to 'the way I eat.' Sustainability follows identity.", link: "/guide", q: "Have you made the mindset shift?" },
];

const Sustain = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();
  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("sustain.title")}</h1>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-4">{t("sustain.intro")}</p>
        <div className="space-y-3">
          {tips.map(({ id, icon: Icon, title, desc, link, q }, i) => (
              <div key={id} className={`bg-card border border-border rounded-lg p-4 animate-fade-in-up ${link ? "cursor-pointer hover:border-primary/40 active:scale-[0.98] transition-all" : ""}`} style={{ animationDelay: `${i * 0.05}s` }} onClick={link ? () => navigate(link) : undefined}>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-accent"><Icon size={18} className="text-accent-foreground" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                  {link && <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <ArticleFeedback articleId={`sustain-${id}`} question={q} />
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
