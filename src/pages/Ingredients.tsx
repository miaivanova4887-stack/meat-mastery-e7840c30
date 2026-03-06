import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const categories = [
  { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "NY Strip", "Chuck Roast", "Lamb Chops", "Bison", "Venison", "Beef Short Ribs"] },
  { name: "🍗 Poultry", items: ["Chicken Thighs (skin-on)", "Chicken Wings", "Duck Breast", "Turkey Legs", "Chicken Drumsticks"] },
  { name: "🐟 Seafood", items: ["Salmon", "Sardines", "Shrimp", "Oysters", "Cod", "Mackerel", "Tuna", "Crab"] },
  { name: "🥓 Pork", items: ["Bacon", "Pork Belly", "Pork Chops", "Pork Ribs", "Sausage (no fillers)", "Ham"] },
  { name: "🫀 Organ Meats", items: ["Beef Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads"] },
  { name: "🥚 Eggs & Dairy", items: ["Eggs (pasture-raised)", "Butter", "Ghee", "Heavy Cream", "Hard Cheese", "Tallow"] },
  { name: "🦴 Bone Broth & Fats", items: ["Beef Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease"] },
];

const Ingredients = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Approved Ingredients</h1>
      </div>
      <div className="p-4 space-y-4">
        {categories.map((cat, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <h3 className="font-display font-bold text-foreground mb-3">{cat.name}</h3>
            <div className="grid grid-cols-2 gap-2">
              {cat.items.map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-secondary-foreground/80">
                  <Check size={12} className="text-primary flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Ingredients;
