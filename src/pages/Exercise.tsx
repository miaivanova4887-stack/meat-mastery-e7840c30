import { ArrowLeft, Dumbbell, Heart, Zap, Wind } from "lucide-react";
import { useNavigate } from "react-router-dom";

const exercises = [
  { icon: Dumbbell, category: "Strength Training", desc: "The carnivore diet provides optimal protein for muscle growth. Focus on compound movements.", items: ["Deadlifts — 3x5 heavy", "Squats — 4x6", "Bench Press — 4x8", "Overhead Press — 3x8", "Barbell Rows — 4x8", "Pull-ups — 3 sets to failure"] },
  { icon: Zap, category: "High-Intensity (HIIT)", desc: "Short bursts maximize fat burning and hormonal response. Keep sessions under 20 minutes.", items: ["Sprint intervals — 30s on/60s off x 8", "Kettlebell swings — 5x20", "Battle ropes — 4x30s", "Burpees — Tabata style"] },
  { icon: Wind, category: "Low-Intensity Steady State", desc: "Walking and light movement support recovery and fat oxidation without spiking cortisol.", items: ["Brisk walking — 30-60 min daily", "Swimming — 30 min easy pace", "Cycling — 45 min moderate", "Yoga/stretching — 20 min"] },
  { icon: Heart, category: "Recovery", desc: "Recovery is where growth happens. The carnivore diet accelerates recovery through nutrient density.", items: ["Cold exposure — 2-5 min cold shower", "Foam rolling — 15 min", "Sleep 7-9 hours nightly", "Sauna — 15-20 min sessions"] },
];

const Exercise = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Recommended Exercise</h1>
      </div>
      <div className="p-4 space-y-4">
        {exercises.map(({ icon: Icon, category, desc, items }, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={20} className="text-primary" />
              <h3 className="font-display font-bold text-foreground">{category}</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{desc}</p>
            <ul className="space-y-1.5">
              {items.map(item => (
                <li key={item} className="text-xs text-secondary-foreground/80 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Exercise;
