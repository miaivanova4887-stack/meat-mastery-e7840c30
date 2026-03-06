export type DietTier = "lion" | "strict" | "animal_based";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "staple";
export type CravingType = "sweets" | "seafood" | "bakery" | "comfort" | "quick" | "organs" | "cheesy" | "crispy" | "grilling";

export interface Recipe {
  name: string;
  time: string;
  cal: string;
  protein: string;
  fat: string;
  serving: string;
  desc: string;
  tags: string[];
  tier: DietTier[];
  meal: MealType;
  cravings: CravingType[];
}

export interface Ingredient {
  name: string;
  amount: string;
}

export interface CustomRecipe extends Recipe {
  id: string;
  ingredients: Ingredient[];
  steps: string[];
  createdAt: string;
  isCustom: true;
}

export const TIER_LABELS: Record<DietTier, string> = {
  lion: "🦁 Lion",
  strict: "🥩 Strict Carnivore",
  animal_based: "🍳 Animal Based",
};

export const MEAL_LABELS: Record<MealType | "all", string> = {
  all: "All",
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  staple: "Staple",
};

export const CRAVING_LABELS: Record<CravingType | "all", string> = {
  all: "🔥 All",
  sweets: "🍯 Sweets",
  seafood: "🦐 Seafood",
  bakery: "🥞 Bakery",
  comfort: "🍖 Comfort",
  quick: "⚡ Quick Bites",
  organs: "🦴 Organ Meats",
  cheesy: "🧀 Cheesy",
  crispy: "🥓 Crispy",
  grilling: "🔥 Grilling",
};

export const recipes: Recipe[] = [
  // === LION DIET ===
  { name: "Reverse-Seared Ribeye", time: "45 min", cal: "650", protein: "52g", fat: "48g", serving: "12 oz steak", desc: "Oven at 250°F until 115°F internal, then sear in cast iron with tallow. Rest 5 minutes.", tags: ["Beef", "Beginner"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["comfort", "grilling"] },
  { name: "Smash Burgers", time: "15 min", cal: "480", protein: "38g", fat: "36g", serving: "2 patties (4 oz each)", desc: "Season ground beef with salt. Form balls, smash on screaming hot griddle. Cook 2 min per side.", tags: ["Beef", "Quick"], tier: ["lion", "strict", "animal_based"], meal: "lunch", cravings: ["quick", "crispy", "grilling"] },
  { name: "Bone Broth", time: "24 hrs", cal: "80", protein: "10g", fat: "2g", serving: "1 cup (240 ml)", desc: "Roast marrow bones at 400°F, then simmer with water, salt for 24 hours. Strain.", tags: ["Healing", "Staple"], tier: ["lion", "strict", "animal_based"], meal: "staple", cravings: ["comfort"] },
  { name: "Pan-Seared Liver & Bacon", time: "15 min", cal: "380", protein: "32g", fat: "24g", serving: "4 oz liver + 3 slices bacon", desc: "Slice liver thin. Cook bacon first, then sear liver 2 min per side in bacon fat. Don't overcook.", tags: ["Organ Meat", "Nutrient Dense"], tier: ["lion", "strict", "animal_based"], meal: "lunch", cravings: ["organs", "quick", "crispy"] },
  { name: "Slow-Cooked Beef Short Ribs", time: "6 hrs", cal: "720", protein: "58g", fat: "54g", serving: "3 ribs (~14 oz)", desc: "Season with salt. Sear in dutch oven, add beef broth. Cook at 275°F for 5-6 hours until fall-off-bone.", tags: ["Beef", "Weekend"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["comfort"] },
  { name: "Beef Tongue Tacos (No Shell)", time: "3 hrs", cal: "340", protein: "30g", fat: "22g", serving: "6 oz sliced tongue", desc: "Simmer tongue for 3 hours. Peel, slice, and sear in tallow. Serve with salt.", tags: ["Organ Meat", "Unique"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["organs", "comfort"] },
  { name: "Bone Marrow on the Bone", time: "25 min", cal: "420", protein: "8g", fat: "42g", serving: "3 split bones", desc: "Roast split marrow bones at 450°F for 20 min. Scoop with salt. Nature's butter.", tags: ["Organ Meat", "Easy"], tier: ["lion", "strict", "animal_based"], meal: "snack", cravings: ["organs", "comfort"] },
  { name: "Beef Heart Skewers", time: "20 min", cal: "290", protein: "36g", fat: "14g", serving: "6 oz cubed heart (3 skewers)", desc: "Cube heart, marinate in tallow and salt. Grill on skewers 3-4 min per side. Tender and lean.", tags: ["Organ Meat", "Grilling"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["organs", "grilling"] },
  { name: "Ground Beef Patties", time: "10 min", cal: "400", protein: "32g", fat: "30g", serving: "2 patties (3 oz each)", desc: "80/20 beef, season with salt. Pan-fry 4 min per side. The simplest carnivore meal.", tags: ["Beef", "Quick"], tier: ["lion", "strict", "animal_based"], meal: "lunch", cravings: ["quick"] },
  { name: "Tallow-Fried Steak Bites", time: "12 min", cal: "520", protein: "42g", fat: "38g", serving: "8 oz cubed sirloin", desc: "Cube sirloin, fry in hot tallow until crispy outside, pink inside. Salt generously.", tags: ["Beef", "Quick"], tier: ["lion", "strict", "animal_based"], meal: "snack", cravings: ["quick", "crispy"] },
  { name: "Braised Oxtail", time: "4 hrs", cal: "580", protein: "44g", fat: "42g", serving: "3 pieces (~12 oz)", desc: "Sear oxtail, braise in bone broth at 300°F for 4 hours. Collagen-rich and deeply flavored.", tags: ["Beef", "Weekend"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["comfort"] },
  { name: "Breakfast Steak", time: "10 min", cal: "500", protein: "44g", fat: "36g", serving: "8 oz NY strip", desc: "Thin NY strip, seared hot in tallow. 2 min per side. Start your day with real fuel.", tags: ["Beef", "Quick"], tier: ["lion", "strict", "animal_based"], meal: "breakfast", cravings: ["quick", "grilling"] },
  { name: "Pork Belly Slices", time: "35 min", cal: "620", protein: "22g", fat: "58g", serving: "6 oz sliced belly", desc: "Score skin, salt heavily. Roast at 425°F for 30 min until crackling. Slice thick.", tags: ["Pork", "Crispy"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["crispy", "comfort"] },
  { name: "Lamb Chops", time: "15 min", cal: "480", protein: "36g", fat: "36g", serving: "3 chops (~10 oz)", desc: "Season with salt. Sear 3 min per side for medium-rare. Rest 5 minutes.", tags: ["Lamb", "Easy"], tier: ["lion", "strict", "animal_based"], meal: "dinner", cravings: ["quick", "grilling"] },
  { name: "Beef Kidney Stir-Fry", time: "15 min", cal: "260", protein: "34g", fat: "12g", serving: "5 oz sliced kidney", desc: "Soak kidneys in salt water 1 hour. Slice thin, stir-fry in tallow on high heat 3 min.", tags: ["Organ Meat", "Quick"], tier: ["lion", "strict", "animal_based"], meal: "lunch", cravings: ["organs", "quick"] },

  // === STRICT CARNIVORE ===
  { name: "Bacon-Wrapped Chicken Thighs", time: "35 min", cal: "520", protein: "42g", fat: "36g", serving: "2 thighs wrapped", desc: "Wrap skin-on thighs with bacon. Bake at 400°F for 30 min until crispy. Season with salt.", tags: ["Poultry", "Easy"], tier: ["strict", "animal_based"], meal: "dinner", cravings: ["crispy", "comfort"] },
  { name: "Butter-Basted Salmon", time: "20 min", cal: "440", protein: "38g", fat: "30g", serving: "6 oz fillet", desc: "Sear skin-side down 4 min. Flip, add butter and baste. Finish in 350°F oven for 8 min.", tags: ["Seafood", "Omega-3"], tier: ["strict", "animal_based"], meal: "dinner", cravings: ["seafood", "comfort"] },
  { name: "Carnivore Egg Muffins", time: "25 min", cal: "320", protein: "24g", fat: "24g", serving: "3 muffins", desc: "Whisk 6 eggs with crumbled bacon and shredded cheese. Pour into muffin tin. Bake 375°F for 18 min.", tags: ["Eggs", "Meal Prep"], tier: ["strict", "animal_based"], meal: "breakfast", cravings: ["bakery", "cheesy"] },
  { name: "Shrimp in Garlic Butter", time: "10 min", cal: "280", protein: "28g", fat: "18g", serving: "8 large shrimp", desc: "Sauté large shrimp in butter with garlic salt for 3 min per side. Quick and satisfying.", tags: ["Seafood", "Quick"], tier: ["strict", "animal_based"], meal: "lunch", cravings: ["seafood", "quick"] },
  { name: "Bacon & Egg Cups", time: "20 min", cal: "350", protein: "22g", fat: "28g", serving: "3 cups", desc: "Line muffin tin with bacon, crack egg inside each. Bake 375°F for 15 min. Perfect grab-and-go.", tags: ["Eggs", "Meal Prep"], tier: ["strict", "animal_based"], meal: "breakfast", cravings: ["bakery", "crispy"] },
  { name: "Cream Cheese Stuffed Burgers", time: "20 min", cal: "580", protein: "40g", fat: "46g", serving: "1 stuffed burger (8 oz)", desc: "Form two thin patties, add cream cheese between, seal edges. Grill 5 min per side.", tags: ["Beef", "Cheese"], tier: ["strict", "animal_based"], meal: "dinner", cravings: ["cheesy", "grilling", "comfort"] },
  { name: "Butter-Poached Lobster Tail", time: "25 min", cal: "380", protein: "32g", fat: "26g", serving: "1 tail (~6 oz)", desc: "Gently poach lobster tail in melted butter at low heat for 10 min. Decadent and simple.", tags: ["Seafood", "Special"], tier: ["strict", "animal_based"], meal: "dinner", cravings: ["seafood", "comfort"] },
  { name: "Cheese Crisps", time: "10 min", cal: "220", protein: "14g", fat: "18g", serving: "4 crisps (2 oz cheese)", desc: "Pile shredded cheddar on parchment. Bake 400°F for 7 min until golden. Crunchy zero-carb snack.", tags: ["Cheese", "Snack"], tier: ["strict", "animal_based"], meal: "snack", cravings: ["cheesy", "crispy", "quick"] },
  { name: "Steak & Eggs", time: "15 min", cal: "650", protein: "52g", fat: "48g", serving: "8 oz strip + 3 eggs", desc: "Sear strip steak 3 min/side. Rest while you fry 3 eggs in butter. The classic carnivore breakfast.", tags: ["Beef", "Eggs"], tier: ["strict", "animal_based"], meal: "breakfast", cravings: ["quick", "comfort"] },
  { name: "Sardines on Pork Rinds", time: "5 min", cal: "310", protein: "26g", fat: "22g", serving: "1 tin sardines + 1 oz rinds", desc: "Top pork rinds with canned sardines and a squeeze of lemon. Omega-3 powerhouse in seconds.", tags: ["Seafood", "Quick"], tier: ["strict", "animal_based"], meal: "snack", cravings: ["seafood", "crispy", "quick"] },
  { name: "Brie-Stuffed Chicken Breast", time: "30 min", cal: "480", protein: "44g", fat: "32g", serving: "1 breast (~8 oz)", desc: "Butterfly chicken breast, stuff with brie, wrap in bacon. Bake 375°F for 25 min.", tags: ["Poultry", "Cheese"], tier: ["strict", "animal_based"], meal: "dinner", cravings: ["cheesy", "comfort"] },
  { name: "Crab Legs in Butter", time: "15 min", cal: "320", protein: "34g", fat: "18g", serving: "1 lb crab legs", desc: "Steam king crab legs 8 min. Serve with melted butter and salt. Pure indulgence.", tags: ["Seafood", "Special"], tier: ["strict", "animal_based"], meal: "dinner", cravings: ["seafood", "comfort"] },
  { name: "Egg Drop Bone Broth", time: "10 min", cal: "180", protein: "18g", fat: "10g", serving: "1.5 cups broth + 2 eggs", desc: "Heat bone broth to simmer. Drizzle beaten eggs while stirring. Season with salt.", tags: ["Eggs", "Healing"], tier: ["strict", "animal_based"], meal: "staple", cravings: ["comfort", "quick"] },
  { name: "Deviled Eggs", time: "20 min", cal: "240", protein: "14g", fat: "20g", serving: "6 halves (3 eggs)", desc: "Hard boil eggs, halve, mix yolks with mayo and mustard. Pipe filling back. Top with paprika.", tags: ["Eggs", "Snack"], tier: ["strict", "animal_based"], meal: "snack", cravings: ["bakery"] },
  { name: "Tuna Steak Seared Rare", time: "8 min", cal: "320", protein: "44g", fat: "14g", serving: "8 oz tuna steak", desc: "Pat dry, salt well. Sear in hot tallow 90 seconds per side. Should be red in center.", tags: ["Seafood", "Quick"], tier: ["strict", "animal_based"], meal: "lunch", cravings: ["seafood", "quick", "grilling"] },
  { name: "Parmesan Chicken Wings", time: "40 min", cal: "440", protein: "36g", fat: "32g", serving: "8 wings", desc: "Bake wings at 425°F for 35 min. Toss in butter and grated parmesan while hot.", tags: ["Poultry", "Cheese"], tier: ["strict", "animal_based"], meal: "snack", cravings: ["cheesy", "crispy"] },
  { name: "Scrambled Eggs in Butter", time: "5 min", cal: "300", protein: "18g", fat: "24g", serving: "3 eggs + 1 tbsp butter", desc: "Low heat, lots of butter, stir constantly. Remove while still slightly wet. Creamy perfection.", tags: ["Eggs", "Quick"], tier: ["strict", "animal_based"], meal: "breakfast", cravings: ["quick", "comfort"] },
  { name: "Mackerel Fillets", time: "12 min", cal: "360", protein: "30g", fat: "26g", serving: "2 fillets (~7 oz)", desc: "Score skin, season with salt. Pan-fry skin-down 4 min, flip 2 min. Rich in omega-3s.", tags: ["Seafood", "Omega-3"], tier: ["strict", "animal_based"], meal: "lunch", cravings: ["seafood", "quick", "crispy"] },

  // === ANIMAL BASED ===
  { name: "Steak with Honey Glaze", time: "20 min", cal: "580", protein: "46g", fat: "38g", serving: "10 oz ribeye + 1 tbsp honey", desc: "Sear ribeye, rest. Drizzle with raw honey and sea salt. Sweet meets savory perfection.", tags: ["Beef", "Honey"], tier: ["animal_based"], meal: "dinner", cravings: ["sweets", "grilling"] },
  { name: "Carnivore Pancakes", time: "15 min", cal: "280", protein: "20g", fat: "18g", serving: "3 pancakes", desc: "Blend 2 eggs, cream cheese, and a drizzle of honey. Cook like regular pancakes in butter.", tags: ["Eggs", "Sweet"], tier: ["animal_based"], meal: "breakfast", cravings: ["sweets", "bakery"] },
  { name: "Beef & Berry Bowl", time: "15 min", cal: "450", protein: "36g", fat: "28g", serving: "6 oz beef + 1 cup berries", desc: "Ground beef patty over mixed berries with a drizzle of honey and sea salt.", tags: ["Beef", "Fruit"], tier: ["animal_based"], meal: "lunch", cravings: ["sweets", "quick"] },
  { name: "Honey Butter Chicken Thighs", time: "35 min", cal: "490", protein: "38g", fat: "34g", serving: "2 thighs glazed", desc: "Roast thighs at 400°F. Glaze with honey-butter mix in last 5 min. Crispy and sweet.", tags: ["Poultry", "Honey"], tier: ["animal_based"], meal: "dinner", cravings: ["sweets", "crispy", "comfort"] },
  { name: "Fruit & Yogurt with Honey", time: "5 min", cal: "220", protein: "12g", fat: "8g", serving: "1 cup yogurt + ½ cup fruit", desc: "Full-fat Greek yogurt, mixed berries, raw honey drizzle. Quick animal-based breakfast.", tags: ["Dairy", "Fruit"], tier: ["animal_based"], meal: "breakfast", cravings: ["sweets", "quick"] },
  { name: "Grilled Steak with Mango Salsa", time: "25 min", cal: "540", protein: "48g", fat: "30g", serving: "10 oz NY strip + ½ mango", desc: "Grill NY strip. Top with diced mango, salt, and lime juice. Tropical carnivore vibes.", tags: ["Beef", "Fruit"], tier: ["animal_based"], meal: "dinner", cravings: ["sweets", "grilling"] },
  { name: "Egg & Avocado Plate", time: "10 min", cal: "380", protein: "18g", fat: "32g", serving: "3 eggs + ½ avocado", desc: "Fried eggs over sliced avocado with salt and honey drizzle. Simple animal-based fuel.", tags: ["Eggs", "Easy"], tier: ["animal_based"], meal: "breakfast", cravings: ["quick", "comfort"] },
  { name: "Salmon with Honey Mustard", time: "20 min", cal: "460", protein: "38g", fat: "28g", serving: "6 oz fillet + glaze", desc: "Glaze salmon with honey-mustard mix. Bake 400°F for 15 min. Pair with sliced oranges.", tags: ["Seafood", "Honey"], tier: ["animal_based"], meal: "dinner", cravings: ["seafood", "sweets"] },
  { name: "Banana Egg Pancakes", time: "10 min", cal: "260", protein: "16g", fat: "12g", serving: "4 small pancakes", desc: "Mash 1 banana, mix with 2 eggs. Cook in butter. Top with honey. 3 ingredients.", tags: ["Eggs", "Fruit"], tier: ["animal_based"], meal: "breakfast", cravings: ["sweets", "bakery", "quick"] },
  { name: "Beef Bone Broth Ramen", time: "20 min", cal: "380", protein: "28g", fat: "22g", serving: "2 cups broth + 4 oz beef", desc: "Rich bone broth with soft-boiled egg, sliced beef, and sweet potato noodles.", tags: ["Beef", "Healing"], tier: ["animal_based"], meal: "dinner", cravings: ["comfort"] },
  { name: "Honey-Glazed Pork Ribs", time: "4 hrs", cal: "680", protein: "42g", fat: "52g", serving: "½ rack (~6 ribs)", desc: "Slow cook ribs at 275°F for 3.5 hrs. Brush with honey in final 30 min. Sticky and tender.", tags: ["Pork", "Weekend"], tier: ["animal_based"], meal: "dinner", cravings: ["sweets", "comfort", "grilling"] },
  { name: "Cottage Cheese & Fruit Bowl", time: "5 min", cal: "250", protein: "20g", fat: "10g", serving: "1 cup cottage cheese + ½ cup fruit", desc: "Full-fat cottage cheese with blueberries, strawberries, and a honey drizzle.", tags: ["Dairy", "Fruit"], tier: ["animal_based"], meal: "snack", cravings: ["sweets", "cheesy", "quick"] },
];
