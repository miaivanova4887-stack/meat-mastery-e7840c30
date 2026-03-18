import { ArrowLeft, Plus, ShoppingBag, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useShoppingBag } from "@/contexts/ShoppingBagContext";
import { Crown, Shield, Leaf } from "lucide-react";

const diets = [
  {
    id: "lion", label: "🦁 Lion", icon: Crown,
    desc: "Meats only. No dairy, eggs, or fish.",
    categories: [
      { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "Ground Beef (85/15)", "NY Strip", "Chuck Roast", "Lamb Chops", "Lamb Shoulder", "Leg of Lamb", "Bison", "Venison", "Beef Short Ribs", "Flank Steak", "Skirt Steak", "Sirloin", "T-Bone", "Filet Mignon", "Tri-Tip", "Beef Brisket", "Oxtail", "Goat"] },
      { name: "🍗 Poultry", items: ["Chicken Breasts", "Chicken Thighs (skin-on)", "Chicken Wings", "Chicken Drumsticks", "Whole Chicken", "Duck Breast", "Duck Legs", "Turkey Breast", "Turkey Legs", "Turkey Thighs", "Ground Turkey", "Cornish Hen", "Quail"] },
      { name: "🥓 Pork", items: ["Bacon (no sugar)", "Pork Belly", "Pork Chops", "Pork Ribs", "Pork Shoulder", "Pork Tenderloin", "Ground Pork", "Sausage (no fillers)", "Ham (unprocessed)", "Pork Loin"] },
      { name: "🫀 Organ Meats", items: ["Beef Liver", "Chicken Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads", "Tripe", "Brain", "Spleen"] },
      { name: "🦴 Fats & Broth", items: ["Beef Bone Broth", "Chicken Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease", "Suet"] },
    ],
  },
  {
    id: "strict", label: "🥩 Strict", icon: Shield,
    desc: "Meats, eggs, dairy, and seafood.",
    categories: [
      { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "Ground Beef (85/15)", "NY Strip", "Chuck Roast", "Lamb Chops", "Lamb Shoulder", "Leg of Lamb", "Bison", "Venison", "Beef Short Ribs", "Flank Steak", "Skirt Steak", "Sirloin", "T-Bone", "Filet Mignon", "Tri-Tip", "Beef Brisket", "Oxtail", "Goat"] },
      { name: "🍗 Poultry", items: ["Chicken Breasts", "Chicken Thighs (skin-on)", "Chicken Wings", "Chicken Drumsticks", "Whole Chicken", "Duck Breast", "Duck Legs", "Turkey Breast", "Turkey Legs", "Turkey Thighs", "Ground Turkey", "Cornish Hen", "Quail"] },
      { name: "🐟 Seafood", items: ["Salmon", "Sardines", "Shrimp", "Oysters", "Cod", "Mackerel", "Tuna", "Crab", "Lobster", "Scallops", "Mussels", "Clams", "Anchovies", "Swordfish", "Halibut", "Trout", "Sea Bass", "Mahi-Mahi", "Squid/Calamari"] },
      { name: "🥓 Pork", items: ["Bacon", "Pork Belly", "Pork Chops", "Pork Ribs", "Pork Shoulder", "Pork Tenderloin", "Ground Pork", "Sausage (no fillers)", "Ham", "Pork Loin"] },
      { name: "🫀 Organ Meats", items: ["Beef Liver", "Chicken Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads", "Tripe", "Brain", "Spleen"] },
      { name: "🥚 Eggs & Dairy", items: ["Eggs (pasture-raised)", "Butter", "Ghee", "Heavy Cream", "Hard Cheese", "Cream Cheese", "Sour Cream", "Cottage Cheese", "Parmesan", "Brie", "Gouda", "Tallow"] },
      { name: "🦴 Fats & Broth", items: ["Beef Bone Broth", "Chicken Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease", "Suet"] },
    ],
  },
  {
    id: "animal", label: "🌿 Animal Based", icon: Leaf,
    desc: "Meats, eggs, dairy, fruits, veggies, honey.",
    categories: [
      { name: "🥩 Red Meat", items: ["Ribeye Steak", "Ground Beef (80/20)", "Ground Beef (85/15)", "NY Strip", "Chuck Roast", "Lamb Chops", "Lamb Shoulder", "Leg of Lamb", "Bison", "Venison", "Beef Short Ribs", "Flank Steak", "Skirt Steak", "Sirloin", "T-Bone", "Filet Mignon", "Tri-Tip", "Beef Brisket", "Oxtail", "Goat"] },
      { name: "🍗 Poultry", items: ["Chicken Breasts", "Chicken Thighs (skin-on)", "Chicken Wings", "Chicken Drumsticks", "Whole Chicken", "Duck Breast", "Duck Legs", "Turkey Breast", "Turkey Legs", "Turkey Thighs", "Ground Turkey", "Cornish Hen", "Quail"] },
      { name: "🐟 Seafood", items: ["Salmon", "Sardines", "Shrimp", "Oysters", "Cod", "Mackerel", "Tuna", "Crab", "Lobster", "Scallops", "Mussels", "Clams", "Anchovies", "Swordfish", "Halibut", "Trout", "Sea Bass", "Mahi-Mahi", "Squid/Calamari"] },
      { name: "🥓 Pork", items: ["Bacon", "Pork Belly", "Pork Chops", "Pork Ribs", "Pork Shoulder", "Pork Tenderloin", "Ground Pork", "Sausage (no fillers)", "Ham", "Pork Loin"] },
      { name: "🫀 Organ Meats", items: ["Beef Liver", "Chicken Liver", "Heart", "Kidney", "Bone Marrow", "Tongue", "Sweetbreads", "Tripe", "Brain", "Spleen"] },
      { name: "🥚 Eggs & Dairy", items: ["Eggs (pasture-raised)", "Butter", "Ghee", "Heavy Cream", "Hard Cheese", "Cream Cheese", "Sour Cream", "Cottage Cheese", "Parmesan", "Brie", "Gouda", "Raw Milk", "Kefir", "Yogurt (full-fat)", "Tallow"] },
      { name: "🍯 Honey & Fruits", items: ["Raw Honey", "Berries", "Avocado", "Bananas", "Dates", "Mangoes", "Watermelon", "Pineapple", "Oranges", "Apples", "Grapes", "Coconut", "Papaya"] },
      { name: "🥬 Vegetables", items: ["Sweet Potatoes", "Squash", "Carrots", "Cucumbers", "White Rice (tolerated)", "Zucchini", "Pumpkin", "Beets", "Olives", "Pickles"] },
      { name: "🦴 Fats & Broth", items: ["Beef Bone Broth", "Chicken Bone Broth", "Beef Tallow", "Lard", "Duck Fat", "Bacon Grease", "Coconut Oil", "Olive Oil", "Suet"] },
    ],
  },
];

const Ingredients = () => {
  const navigate = useNavigate();
  const { addItem, removeItem, hasItem, count } = useShoppingBag();
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-display font-bold">{t("ingredients.title")}</h1>
        <button
          onClick={() => navigate("/shopping-bag")}
          className="ml-auto relative text-primary hover:text-primary/80 transition-colors"
        >
          <ShoppingBag size={22} />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {count}
            </span>
          )}
        </button>
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
                    {cat.items.map(item => {
                      const inBag = hasItem(item);
                      return (
                        <button
                          key={item}
                          onClick={() => inBag ? removeItem(item) : addItem(item)}
                          className={`flex items-center gap-2 text-xs text-left rounded-md px-2 py-1.5 transition-colors ${
                            inBag
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-secondary-foreground/80 hover:bg-muted"
                          }`}
                        >
                          {inBag ? <Minus size={12} className="text-primary flex-shrink-0" /> : <Plus size={12} className="text-muted-foreground flex-shrink-0" />}
                          <span>{item}</span>
                        </button>
                      );
                    })}
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
