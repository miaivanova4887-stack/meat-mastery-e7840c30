import type { CurrencyCode } from "./currencyData";

export interface BudgetItem {
  name: string;
  weeklyLocal: number;
  removable?: boolean;
  amount: string;
}

const LOCAL_PRICES: Record<CurrencyCode, BudgetItem[]> = {
  CAD: [
    { name: "Ground beef", weeklyLocal: 38, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 15, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 12, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 14, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 7, removable: true, amount: "1 kg" },
    { name: "Salt & tallow", weeklyLocal: 6, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 4, removable: false, amount: "bones" },
  ],
  USD: [
    { name: "Ground beef (80/20)", weeklyLocal: 28, removable: true, amount: "5 lbs" },
    { name: "Eggs", weeklyLocal: 9, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 8, removable: true, amount: "2 lbs" },
    { name: "Chicken thighs", weeklyLocal: 11, removable: true, amount: "4 lbs" },
    { name: "Beef liver", weeklyLocal: 5, removable: true, amount: "2 lbs" },
    { name: "Salt & tallow", weeklyLocal: 5, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 3, removable: false, amount: "bones" },
  ],
  GBP: [
    { name: "Beef mince (20% fat)", weeklyLocal: 30, removable: true, amount: "2.5 kg" },
    { name: "Free-range eggs", weeklyLocal: 8, removable: true, amount: "36 eggs" },
    { name: "Butter", weeklyLocal: 8, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 10, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 4, removable: true, amount: "1 kg" },
    { name: "Salt & dripping", weeklyLocal: 4, removable: false, amount: "staples" },
    { name: "Marrow bones", weeklyLocal: 3, removable: false, amount: "bones" },
  ],
  AUD: [
    { name: "Beef mince", weeklyLocal: 35, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 18, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 14, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 14, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 6, removable: true, amount: "1 kg" },
    { name: "Salt & tallow", weeklyLocal: 6, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 4, removable: false, amount: "bones" },
  ],
  NZD: [
    { name: "Beef mince", weeklyLocal: 38, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 20, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 15, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 16, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 7, removable: true, amount: "1 kg" },
    { name: "Salt & tallow", weeklyLocal: 6, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 5, removable: false, amount: "bones" },
  ],
  EUR: [
    { name: "Hackfleisch / Viande hachée", weeklyLocal: 36, removable: true, amount: "2.5 kg" },
    { name: "Eier / Œufs", weeklyLocal: 11, removable: true, amount: "36 St." },
    { name: "Butter", weeklyLocal: 10, removable: true, amount: "1 kg" },
    { name: "Hähnchenschenkel / Cuisses", weeklyLocal: 12, removable: true, amount: "2 kg" },
    { name: "Rinderleber / Foie", weeklyLocal: 5, removable: true, amount: "1 kg" },
    { name: "Salz & Talg", weeklyLocal: 4, removable: false, amount: "Grundlagen" },
    { name: "Knochenbrühe-Zutaten", weeklyLocal: 3, removable: false, amount: "Knochen" },
  ],
};

export function getLocalPrices(currency: CurrencyCode): BudgetItem[] {
  return (LOCAL_PRICES[currency] || LOCAL_PRICES.USD).map(item => ({ ...item }));
}
