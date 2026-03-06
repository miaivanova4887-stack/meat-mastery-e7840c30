import { ArrowLeft, Zap, Brain, Heart, Scale, Flame, Shield, Eye, BatteryCharging } from "lucide-react";
import { useNavigate } from "react-router-dom";

const benefits = [
  { icon: Flame, title: "Reduced Inflammation", desc: "Eliminating plant toxins and seed oils can dramatically lower systemic inflammation, helping with joint pain and autoimmune conditions." },
  { icon: Brain, title: "Mental Clarity", desc: "Stable blood sugar and ketones fuel the brain efficiently, leading to sharper focus and reduced brain fog." },
  { icon: Scale, title: "Fat Loss", desc: "High protein and fat satiety naturally reduces caloric intake. Many report effortless weight loss without counting calories." },
  { icon: Heart, title: "Heart Health", desc: "Improved triglyceride-to-HDL ratio and reduced insulin resistance support cardiovascular health." },
  { icon: BatteryCharging, title: "Sustained Energy", desc: "No sugar crashes. Fat-adapted metabolism provides steady energy throughout the day." },
  { icon: Shield, title: "Gut Healing", desc: "Removing fiber and plant irritants allows the gut lining to heal, improving digestion and nutrient absorption." },
  { icon: Eye, title: "Better Skin", desc: "Many report clearing of acne, eczema, and psoriasis after eliminating plant-based irritants." },
  { icon: Zap, title: "Hormone Optimization", desc: "Cholesterol and saturated fats are building blocks for testosterone, estrogen, and other critical hormones." },
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
