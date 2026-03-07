import { ArrowLeft, Zap, Brain, Heart, Scale, Flame, Shield, Eye, BatteryCharging, Leaf, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const benefits = [
  { icon: Flame, title: "Reduced Inflammation", desc: "Eliminating plant toxins and seed oils can dramatically lower systemic inflammation, helping with joint pain and autoimmune conditions." },
  { icon: Sparkles, title: "Autophagy & Cellular Renewal", desc: "Your body activates powerful self-healing mechanisms, recycling damaged cells and regenerating new ones. Many report looking and feeling up to 10 years younger as their body repairs from the inside out." },
  { icon: Brain, title: "Mental Clarity", desc: "Stable blood sugar and ketones fuel the brain efficiently, leading to sharper focus and reduced brain fog." },
  { icon: Scale, title: "Fat Loss", desc: "High protein and fat satiety naturally reduces caloric intake. Many report effortless weight loss without counting calories." },
  { icon: Shield, title: "Gut Healing", desc: "Removing fiber and plant irritants allows the gut lining to heal, improving digestion and nutrient absorption." },
  { icon: BatteryCharging, title: "Sustained Energy", desc: "No sugar crashes. Fat-adapted metabolism provides steady energy throughout the day." },
  { icon: Heart, title: "Women's Hormonal Balance", desc: "Many women experience vanishing period pain, lighter and more predictable cycles, and a stable, consistent hormonal rhythm — often within the first few months." },
  { icon: Leaf, title: "Eating Incredibly Clean", desc: "Zero sugars, zero preservatives, no artificial colours or flavours. Your body receives pure, whole-animal nutrition exactly as nature intended — nothing processed, nothing synthetic." },
  { icon: Eye, title: "Overall Glow-Up", desc: "Beyond clearing acne, eczema, and psoriasis — many experience brighter eyes, thicker hair, stronger nails, and a radiant complexion that reflects deep internal health." },
  { icon: Scale, title: "Forget Calorie Counting Forever", desc: "High-protein, high-fat meals naturally regulate appetite and satiety hormones. Most people effortlessly eat the right amount — no tracking apps, no food scales, no mental math." },
  { icon: Zap, title: "Higher Sports Performance", desc: "Fat-adapted athletes report improved endurance, faster recovery, and greater explosive power. Reduced inflammation means less downtime between training sessions." },
  { icon: Shield, title: "Stress Resistance", desc: "Stable blood sugar and optimized hormones build a resilient nervous system. Many report handling pressure with calm focus instead of anxiety and burnout." },
];

const Benefits = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Potential Benefits</h1>
      </div>
      <div className="p-4 space-y-3">
        {benefits.map(({ icon: Icon, title, desc }, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10"><Icon size={20} className="text-primary" /></div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Benefits;
