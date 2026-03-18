import { ArrowLeft, ShieldCheck, Coffee, Droplets, Moon, Brain, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MotivationCTA from "@/components/MotivationCTA";
import ArticleFeedback from "@/components/ArticleFeedback";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const strategies = [
  { id: "fat", icon: Utensils, title: "Eat More Fat", desc: "Cravings often mean you're not eating enough. Add butter, tallow, or fatty cuts. Your body craves energy — give it animal fat, not sugar.", q: "Will you try eating more fat?" },
  { id: "hydrate", icon: Droplets, title: "Stay Hydrated + Electrolytes", desc: "Drink water with salt, magnesium, and potassium. Low electrolytes mimic sugar cravings. Bone broth is an excellent source.", q: "Do you keep up with electrolytes?" },
  { id: "coffee", icon: Coffee, title: "Black Coffee or Tea", desc: "Caffeine can help suppress appetite during adaptation. Keep it black — no sweeteners. This helps bridge the gap in early weeks.", q: "Does coffee help your cravings?" },
  { id: "sleep", icon: Moon, title: "Prioritize Sleep", desc: "Poor sleep spikes ghrelin (hunger hormone) and lowers leptin. Aim for 7-9 hours. This alone can eliminate most cravings.", q: "Are you getting enough sleep?" },
  { id: "withdrawal", icon: Brain, title: "Understand the Withdrawal", desc: "Sugar is addictive. Withdrawal symptoms peak at days 3-5 and fade by week 2-3. It's temporary — your brain is rewiring.", q: "Are you past the withdrawal phase?" },
  { id: "temptation", icon: ShieldCheck, title: "Remove All Temptation", desc: "Clear your kitchen of non-carnivore foods. Don't rely on willpower. Make the right choice the only choice available.", q: "Have you cleared your kitchen?" },
];

const Cravings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("cravings.title")}</h1>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-4">{t("cravings.intro")}</p>
        <div className="space-y-3">
          {strategies.map(({ id, icon: Icon, title, desc, q }, i) => (
            <div key={id} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-accent"><Icon size={18} className="text-accent-foreground" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
              <ArticleFeedback articleId={`cravings-${id}`} question={q} />
            </div>
          ))}
        </div>
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Cravings;
