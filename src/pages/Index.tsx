import { useNavigate } from "react-router-dom";
import { Flame, BookOpen, Timer, Dumbbell, Heart, Shield, Zap, Apple } from "lucide-react";
import heroImage from "@/assets/hero-steak.jpg";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  { icon: Zap, label: "Benefits", path: "/benefits", color: "text-gold" },
  { icon: BookOpen, label: "Recipes", path: "/recipes", color: "text-primary" },
  { icon: Timer, label: "Ketosis Timer", path: "/timer", color: "text-flame" },
  { icon: Apple, label: "Ingredients", path: "/ingredients", color: "text-ember" },
  { icon: Dumbbell, label: "Exercise", path: "/exercise", color: "text-primary" },
  { icon: Shield, label: "Cravings", path: "/cravings", color: "text-gold" },
  { icon: Heart, label: "Success Stories", path: "/stories", color: "text-accent" },
  { icon: Flame, label: "Sustain Results", path: "/sustain", color: "text-flame" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative h-[55vh] overflow-hidden">
        <img src={heroImage} alt="Seared steak on flame" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h1 className="text-4xl font-display font-black text-gradient-flame leading-tight">
            CARNIVORE<br />LIFESTYLE
          </h1>
          <p className="text-muted-foreground mt-2 text-sm font-light max-w-xs">
            Your complete guide to thriving on an animal-based diet.
          </p>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, label, path, color }, i) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="bg-card border border-border rounded-lg p-4 text-left hover:border-primary/40 transition-all active:scale-[0.97] group"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <Icon size={24} className={`${color} mb-2 group-hover:scale-110 transition-transform`} />
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Motivation */}
      <div className="px-4 mt-6">
        <div className="bg-gradient-card rounded-lg p-5 border border-primary/20 glow-flame">
          <p className="text-sm font-display italic text-bone/90 leading-relaxed">
            "The carnivore diet is the elimination diet that helps you discover what your body truly needs."
          </p>
          <span className="text-xs text-muted-foreground mt-2 block">— Dr. Shawn Baker</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
