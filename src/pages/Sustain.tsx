import { ArrowLeft, Target, RefreshCw, Users, BarChart3, Calendar, BookHeart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MotivationCTA from "@/components/MotivationCTA";

const tips = [
  { icon: Target, title: "Set Non-Scale Goals", desc: "Track energy, sleep quality, mental clarity, and strength gains — not just weight. These victories keep motivation alive long-term." },
  { icon: Calendar, title: "Meal Prep Weekly", desc: "Cook in bulk on weekends. Pre-cooked ground beef, hard-boiled eggs, and pre-seasoned steaks make compliance effortless during busy weeks." },
  { icon: RefreshCw, title: "Rotate Your Proteins", desc: "Avoid food fatigue by rotating beef, lamb, pork, seafood, and organ meats. Variety within carnivore keeps meals exciting." },
  { icon: Users, title: "Join a Community", desc: "Connect with other carnivores online or locally. Accountability and shared experiences make the lifestyle feel natural, not restrictive." },
  { icon: BarChart3, title: "Track Your Progress", desc: "Take monthly photos, track body measurements, and log how you feel. Reviewing progress during tough weeks reignites motivation." },
  { icon: BookHeart, title: "Embrace It as Lifestyle", desc: "This isn't a 30-day challenge — it's how humans ate for millennia. Shift your mindset from 'diet' to 'the way I eat.' Sustainability follows identity." },
];

const Sustain = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Sustain Results</h1>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-4">Long-term success requires more than willpower. Build systems that make carnivore your default.</p>
        <div className="space-y-3">
          {tips.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-gold/10"><Icon size={18} className="text-gold" /></div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
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
