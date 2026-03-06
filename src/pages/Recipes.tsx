import { ArrowLeft, Clock, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

const recipes = [
  { name: "Reverse-Seared Ribeye", time: "45 min", cal: "650", desc: "Oven at 250°F until 115°F internal, then sear in cast iron with butter and garlic. Rest 5 minutes.", tags: ["Beef", "Beginner"] },
  { name: "Smash Burgers", time: "15 min", cal: "480", desc: "Season ground beef with salt. Form balls, smash on screaming hot griddle. Cook 2 min per side. Stack with cheese.", tags: ["Beef", "Quick"] },
  { name: "Bacon-Wrapped Chicken Thighs", time: "35 min", cal: "520", desc: "Wrap skin-on thighs with bacon. Bake at 400°F for 30 min until crispy. Season with salt and pepper.", tags: ["Poultry", "Easy"] },
  { name: "Bone Broth", time: "24 hrs", cal: "80", desc: "Roast marrow bones at 400°F, then simmer with water, salt, and apple cider vinegar for 24 hours. Strain.", tags: ["Healing", "Staple"] },
  { name: "Butter-Basted Salmon", time: "20 min", cal: "440", desc: "Sear skin-side down 4 min. Flip, add butter and baste. Finish in 350°F oven for 8 min.", tags: ["Seafood", "Omega-3"] },
  { name: "Carnivore Egg Muffins", time: "25 min", cal: "320", desc: "Whisk 6 eggs with crumbled bacon and shredded cheese. Pour into muffin tin. Bake 375°F for 18 min.", tags: ["Eggs", "Meal Prep"] },
  { name: "Slow-Cooked Beef Short Ribs", time: "6 hrs", cal: "720", desc: "Season with salt. Sear in dutch oven, add beef broth. Cook at 275°F for 5-6 hours until fall-off-bone.", tags: ["Beef", "Weekend"] },
  { name: "Pan-Seared Liver & Bacon", time: "15 min", cal: "380", desc: "Slice liver thin. Cook bacon first, then sear liver 2 min per side in bacon fat. Don't overcook.", tags: ["Organ Meat", "Nutrient Dense"] },
];

const Recipes = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Carnivore Recipes</h1>
      </div>
      <div className="p-4 space-y-3">
        {recipes.map((r, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <h3 className="font-display font-bold text-foreground">{r.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock size={12} /> {r.time}</span>
              <span className="flex items-center gap-1"><Flame size={12} /> {r.cal} cal</span>
            </div>
            <p className="text-xs text-secondary-foreground/70 mt-2 leading-relaxed">{r.desc}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {r.tags.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recipes;
