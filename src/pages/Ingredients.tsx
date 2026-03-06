import { ArrowLeft, Check, Crown, Shield, Leaf } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const diets = [
  {
    id: "lion",
    label: "🦁 Lion",
    icon: Crown,
    desc: "Meats only. No dairy, eggs, or fish.",
    categories: [
      { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "NY Strip", "Chuck Roast", "Lamb Chops", "Bison", "Venison", "Beef Short Ribs"] },
      { name: "🍗 Poultry", items: ["Chicken Thighs (skin-on)", "Chicken Wings", "Duck Breast", "Turkey Legs", "Chicken Drumsticks"] },
      { name: "🥓 Pork", items: ["Bacon (no sugar)", "Pork Belly", "Pork Chops", "Pork Ribs", "Sausage (no fillers)", "Ham (unprocessed)"] },
      { name: "🫀 Organ Meats", items: ["Beef Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads"] },
      { name: "🦴 Fats & Broth", items: ["Beef Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease"] },
    ],
  },
  {
    id: "strict",
    label: "🥩 Strict",
    icon: Shield,
    desc: "Meats, eggs, dairy, and seafood.",
    categories: [
      { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "NY Strip", "Chuck Roast", "Lamb Chops", "Bison", "Venison", "Beef Short Ribs"] },
      { name: "🍗 Poultry", items: ["Chicken Thighs (skin-on)", "Chicken Wings", "Duck Breast", "Turkey Legs", "Chicken Drumsticks"] },
      { name: "🐟 Seafood", items: ["Salmon", "Sardines", "Shrimp", "Oysters", "Cod", "Mackerel", "Tuna", "Crab"] },
      { name: "🥓 Pork", items: ["Bacon", "Pork Belly", "Pork Chops", "Pork Ribs", "Sausage (no fillers)", "Ham"] },
      { name: "🫀 Organ Meats", items: ["Beef Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads"] },
      { name: "🥚 Eggs & Dairy", items: ["Eggs (pasture-raised)", "Butter", "Ghee", "Heavy Cream", "Hard Cheese", "Tallow"] },
      { name: "🦴 Fats & Broth", items: ["Beef Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease"] },
    ],
  },
  {
    id: "animal",
    label: "🌿 Animal Based",
    icon: Leaf,
    desc: "Meats, eggs, dairy, fruits, veggies, honey.",
    categories: [
      { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "NY Strip", "Chuck Roast", "Lamb Chops", "Bison", "Venison", "Beef Short Ribs"] },
      { name: "🍗 Poultry", items: ["Chicken Thighs (skin-on)", "Chicken Wings", "Duck Breast", "Turkey Legs", "Chicken Drumsticks"] },
      { name: "🐟 Seafood", items: ["Salmon", "Sardines", "Shrimp", "Oysters", "Cod", "Mackerel", "Tuna", "Crab"] },
      { name: "🥓 Pork", items: ["Bacon", "Pork Belly", "Pork Chops", "Pork Ribs", "Sausage (no fillers)", "Ham"] },
      { name: "🫀 Organ Meats", items: ["Beef Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads"] },
      { name: "🥚 Eggs & Dairy", items: ["Eggs (pasture-raised)", "Butter", "Ghee", "Heavy Cream", "Hard Cheese", "Tallow", "Raw Milk"] },
      { name: "🍯 Honey & Fruits", items: ["Raw Honey", "Berries", "Avocado", "Bananas", "Dates", "Mangoes", "Watermelon"] },
      { name: "🥬 Vegetables", items: ["Sweet Potatoes", "Squash", "Carrots", "Cucumbers", "White Rice (tolerated)"] },
      { name: "🦴 Fats & Broth", items: ["Beef Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease"] },
    ],
  },
];

const Ingredients = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">Approved Ingredients</h1>
      </div>

      <Tabs defaultValue="lion" className="w-full">
        <div className="sticky top-[53px] z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 py-2">
          <TabsList className="w-full grid grid-cols-3">
            {diets.map(d => (
              <TabsTrigger key={d.id} value={d.id} className="text-xs">{d.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        {diets.map(diet => (
          <TabsContent key={diet.id} value={diet.id} className="mt-0">
            <div className="px-4 pt-3 pb-1">
              <p className="text-xs text-muted-foreground italic">{diet.desc}</p>
            </div>
            <div className="p-4 space-y-4">
              {diet.categories.map((cat, i) => (
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
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Ingredients;
