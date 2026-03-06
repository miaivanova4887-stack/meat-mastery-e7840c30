import { ArrowLeft, ShieldCheck, Coffee, Droplets, Moon, Brain, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";

const strategies = [
  { icon: Utensils, title: "Eat More Fat", desc: "Cravings often mean you're not eating enough. Add butter, tallow, or fatty cuts. Your body craves energy — give it animal fat, not sugar." },
  { icon: Droplets, title: "Stay Hydrated + Electrolytes", desc: "Drink water with salt, magnesium, and potassium. Low electrolytes mimic sugar cravings. Bone broth is an excellent source." },
  { icon: Coffee, title: "Black Coffee or Tea", desc: "Caffeine can help suppress appetite during adaptation. Keep it black — no sweeteners. This helps bridge the gap in early weeks." },
  { icon: Moon, title: "Prioritize Sleep", desc: "Poor sleep spikes ghrelin (hunger hormone) and lowers leptin. Aim for 7-9 hours. This alone can eliminate most cravings." },
  { icon: Brain, title: "Understand the Withdrawal", desc: "Sugar is addictive. Withdrawal symptoms peak at days 3-5 and fade by week 2-3. It's temporary — your brain is rewiring." },
  { icon: ShieldCheck, title: "Remove All Temptation", desc: "Clear your kitchen of non-carnivore foods. Don't rely on willpower. Make the right choice the only choice available." },
];

const Cravings = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Combat Cravings</h1>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-4">Cravings are your body detoxing from sugar and carbs. Here's how to push through:</p>
        <div className="space-y-3">
          {strategies.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-accent/10"><Icon size={18} className="text-accent" /></div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Cravings;
