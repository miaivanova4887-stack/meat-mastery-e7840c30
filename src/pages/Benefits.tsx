import { ArrowLeft, Zap, Brain, Heart, Scale, Flame, Shield, Eye, BatteryCharging, Leaf, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/contexts/UserProfileContext";
import MotivationCTA from "@/components/MotivationCTA";
import ArticleFeedback from "@/components/ArticleFeedback";
import { useTranslation } from "react-i18next";

const Benefits = () => {
  const navigate = useNavigate();
  const profile = useUserProfile();
  const { t } = useTranslation();
  const isFemale = profile.body.sex === "female";
  const isMale = profile.body.sex === "male";

  const benefits = [
    { id: "inflammation", icon: Flame, title: "Reduced Inflammation", desc: "Eliminating plant toxins and seed oils can dramatically lower systemic inflammation, helping with joint pain and autoimmune conditions.", q: "Have you noticed less inflammation?" },
    { id: "autophagy", icon: Sparkles, title: "Autophagy & Cellular Renewal", desc: "Your body activates powerful self-healing mechanisms, recycling damaged cells and regenerating new ones. Many report looking and feeling up to 10 years younger as their body repairs from the inside out.", q: "Interested in learning more about autophagy?" },
    { id: "clarity", icon: Brain, title: "Mental Clarity", desc: "Stable blood sugar and ketones fuel the brain efficiently, leading to sharper focus and reduced brain fog.", q: "Have you experienced clearer thinking?" },
    { id: "fatloss", icon: Scale, title: "Fat Loss", desc: "High protein and fat satiety naturally reduces caloric intake. Many report effortless weight loss without counting calories.", q: "Is fat loss a priority for you?" },
    { id: "gut", icon: Shield, title: "Gut Healing", desc: "Removing fiber and plant irritants allows the gut lining to heal, improving digestion and nutrient absorption.", q: "Have you noticed digestive improvements?" },
    { id: "energy", icon: BatteryCharging, title: "Sustained Energy", desc: "No sugar crashes. Fat-adapted metabolism provides steady energy throughout the day.", q: "Feeling more consistent energy?" },
    ...(isFemale ? [{ id: "hormones-f", icon: Heart, title: "Women's Hormonal Balance", desc: "Many women experience vanishing period pain, lighter and more predictable cycles, and a stable, consistent hormonal rhythm — often within the first few months.", q: "Have you noticed hormonal improvements?" }] : []),
    ...(isMale ? [
      { id: "testosterone", icon: Zap, title: "Testosterone Optimization", desc: "Red meat and animal fats provide the cholesterol and zinc essential for testosterone production. Many men report improved drive, confidence, and vitality within weeks.", q: "Feeling the testosterone boost?" },
      { id: "lean-muscle", icon: Shield, title: "Lean Muscle & Body Composition", desc: "High bioavailable protein fuels muscle protein synthesis while naturally reducing body fat. Men often notice a harder, more defined physique without strict gym protocols.", q: "Seeing body composition changes?" },
    ] : []),
    { id: "clean", icon: Leaf, title: "Eating Incredibly Clean", desc: "Zero sugars, zero preservatives, no artificial colours or flavours. Your body receives pure, whole-animal nutrition exactly as nature intended — nothing processed, nothing synthetic.", q: "Does clean eating matter to you?" },
    { id: "glow", icon: Eye, title: "Overall Glow-Up", desc: "Beyond clearing acne, eczema, and psoriasis — many experience brighter eyes, thicker hair, stronger nails, and a radiant complexion that reflects deep internal health.", q: "Noticed any skin or hair changes?" },
    { id: "no-counting", icon: Scale, title: "Forget Calorie Counting Forever", desc: "High-protein, high-fat meals naturally regulate appetite and satiety hormones. Most people effortlessly eat the right amount — no tracking apps, no food scales, no mental math.", q: "Do you enjoy not counting calories?" },
    { id: "sports", icon: Zap, title: "Higher Sports Performance", desc: "Fat-adapted athletes report improved endurance, faster recovery, and greater explosive power. Reduced inflammation means less downtime between training sessions.", q: "Are you an active athlete?" },
    { id: "stress", icon: Shield, title: "Stress Resistance", desc: "Stable blood sugar and optimized hormones build a resilient nervous system. Many report handling pressure with calm focus instead of anxiety and burnout.", q: "Feeling more resilient to stress?" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("benefits.title")}</h1>
      </div>
      <div className="p-4 space-y-3">
        {benefits.map(({ id, icon: Icon, title, desc, q }, i) => (
          <div key={id} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10"><Icon size={20} className="text-primary" /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
            <ArticleFeedback articleId={`benefits-${id}`} question={q} />
          </div>
        ))}
      </div>
      <MotivationCTA />
    </div>
  );
};

export default Benefits;
