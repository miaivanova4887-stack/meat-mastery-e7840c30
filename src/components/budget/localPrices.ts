import type { CurrencyCode } from "./currencyData";

export interface BudgetItem {
  name: string;
  weeklyLocal: number;
  removable?: boolean;
  amount: string;
}

/**
 * Research-based local weekly food prices for a carnivore diet.
 *
 * Sources:
 * - GlobalProductPrices.com (Jan 2026): beef prices per kg by country
 *   USA $18.80/kg, UK $24.72/kg, EUR avg ~$22/kg, Canada $20.38/kg,
 *   Australia $17.75/kg, South Africa $10.16/kg, India ~$6.50/kg, Brazil $10.08/kg
 * - USDA retail ground beef Oct 2024: $5.59/lb
 * - Local egg, butter, chicken, organ meat prices from national statistics
 *
 * Prices are in local currency, representing realistic weekly grocery costs
 * for a single person eating carnivore (~2 kg meat/day baseline).
 */
const LOCAL_PRICES: Record<CurrencyCode, BudgetItem[]> = {
  USD: [
    { name: "Ground beef (80/20)", weeklyLocal: 28, removable: true, amount: "5 lbs" },
    { name: "Eggs", weeklyLocal: 9, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 8, removable: true, amount: "2 lbs" },
    { name: "Chicken thighs", weeklyLocal: 11, removable: true, amount: "4 lbs" },
    { name: "Beef liver", weeklyLocal: 5, removable: true, amount: "2 lbs" },
    { name: "Salt & tallow", weeklyLocal: 5, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 3, removable: false, amount: "bones" },
  ],
  EUR: [
    // EU avg beef ~€16/kg, eggs ~€3.50/dozen, butter ~€3/250g
    { name: "Hackfleisch / Viande hachée", weeklyLocal: 36, removable: true, amount: "2.5 kg" },
    { name: "Eier / Œufs", weeklyLocal: 11, removable: true, amount: "36 St." },
    { name: "Butter", weeklyLocal: 10, removable: true, amount: "1 kg" },
    { name: "Hähnchenschenkel / Cuisses", weeklyLocal: 12, removable: true, amount: "2 kg" },
    { name: "Rinderleber / Foie", weeklyLocal: 5, removable: true, amount: "1 kg" },
    { name: "Salz & Talg", weeklyLocal: 4, removable: false, amount: "Grundlagen" },
    { name: "Knochenbrühe-Zutaten", weeklyLocal: 3, removable: false, amount: "Knochen" },
  ],
  GBP: [
    // UK beef ~£12/kg, eggs ~£2.80/dozen, butter ~£2/250g
    { name: "Beef mince (20% fat)", weeklyLocal: 30, removable: true, amount: "2.5 kg" },
    { name: "Free-range eggs", weeklyLocal: 8, removable: true, amount: "36 eggs" },
    { name: "Butter", weeklyLocal: 8, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 10, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 4, removable: true, amount: "1 kg" },
    { name: "Salt & dripping", weeklyLocal: 4, removable: false, amount: "staples" },
    { name: "Marrow bones", weeklyLocal: 3, removable: false, amount: "bones" },
  ],
  CAD: [
    // Canada beef ~CA$27/kg, eggs ~CA$5/dozen, butter ~CA$6/lb
    { name: "Ground beef", weeklyLocal: 38, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 15, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 12, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 14, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 7, removable: true, amount: "1 kg" },
    { name: "Salt & tallow", weeklyLocal: 6, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 4, removable: false, amount: "bones" },
  ],
  AUD: [
    // Australia beef ~A$27/kg, eggs ~A$6/dozen, butter ~A$5/250g
    { name: "Beef mince", weeklyLocal: 35, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 18, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 14, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 14, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 6, removable: true, amount: "1 kg" },
    { name: "Salt & tallow", weeklyLocal: 6, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 4, removable: false, amount: "bones" },
  ],
  ZAR: [
    // SA beef ~R185/kg, eggs ~R55/dozen, butter ~R60/250g
    { name: "Beef mince", weeklyLocal: 460, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 165, removable: true, amount: "3 dozen" },
    { name: "Butter", weeklyLocal: 180, removable: true, amount: "1 kg" },
    { name: "Chicken thighs", weeklyLocal: 140, removable: true, amount: "2 kg" },
    { name: "Beef liver", weeklyLocal: 60, removable: true, amount: "1 kg" },
    { name: "Salt & drippings", weeklyLocal: 40, removable: false, amount: "staples" },
    { name: "Marrow bones", weeklyLocal: 30, removable: false, amount: "bones" },
  ],
  INR: [
    // India beef/buffalo ~₹400/kg, eggs ~₹7 each, butter ~₹500/kg
    { name: "Buffalo mince", weeklyLocal: 1000, removable: true, amount: "2.5 kg" },
    { name: "Eggs", weeklyLocal: 250, removable: true, amount: "36 eggs" },
    { name: "Butter / Ghee", weeklyLocal: 350, removable: true, amount: "500g" },
    { name: "Chicken thighs", weeklyLocal: 500, removable: true, amount: "2 kg" },
    { name: "Goat liver", weeklyLocal: 200, removable: true, amount: "1 kg" },
    { name: "Salt & ghee", weeklyLocal: 100, removable: false, amount: "staples" },
    { name: "Bone broth ingredients", weeklyLocal: 80, removable: false, amount: "bones" },
  ],
  BRL: [
    // Brazil beef ~R$50/kg, eggs ~R$14/dozen, butter ~R$30/200g
    { name: "Carne moída", weeklyLocal: 125, removable: true, amount: "2.5 kg" },
    { name: "Ovos", weeklyLocal: 42, removable: true, amount: "3 dúzias" },
    { name: "Manteiga", weeklyLocal: 60, removable: true, amount: "500g" },
    { name: "Sobrecoxa de frango", weeklyLocal: 40, removable: true, amount: "2 kg" },
    { name: "Fígado bovino", weeklyLocal: 20, removable: true, amount: "1 kg" },
    { name: "Sal & banha", weeklyLocal: 15, removable: false, amount: "básicos" },
    { name: "Ingredientes p/ caldo", weeklyLocal: 10, removable: false, amount: "ossos" },
  ],
};

export function getLocalPrices(currency: CurrencyCode): BudgetItem[] {
  // Return a deep copy so state mutations don't affect the source
  return (LOCAL_PRICES[currency] || LOCAL_PRICES.USD).map(item => ({ ...item }));
}
