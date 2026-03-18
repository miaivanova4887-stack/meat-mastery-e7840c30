import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import ContentSection from "@/components/ContentSection";
import MotivationCTA from "@/components/MotivationCTA";
import { useTranslation } from "react-i18next";
import { useScrollToTop } from "@/hooks/useScrollToTop";

const CURRENCIES: Record<string, { symbol: string; rate: number; label: string }> = {
  USD: { symbol: "$", rate: 1, label: "🇺🇸 USD" },
  EUR: { symbol: "€", rate: 0.92, label: "🇪🇺 EUR" },
  GBP: { symbol: "£", rate: 0.79, label: "🇬🇧 GBP" },
  CAD: { symbol: "CA$", rate: 1.36, label: "🇨🇦 CAD" },
  AUD: { symbol: "A$", rate: 1.53, label: "🇦🇺 AUD" },
  ZAR: { symbol: "R", rate: 18.1, label: "🇿🇦 ZAR" },
  INR: { symbol: "₹", rate: 83.0, label: "🇮🇳 INR" },
  BRL: { symbol: "R$", rate: 4.97, label: "🇧🇷 BRL" },
};

interface BudgetItem {
  name: string;
  weeklyUSD: number;
  variable?: boolean;
  amount: string;
}

const BASE_ITEMS: BudgetItem[] = [
  { name: "Ground beef (80/20)", weeklyUSD: 25, variable: true, amount: "5 lbs" },
  { name: "Eggs", weeklyUSD: 9, variable: true, amount: "3 dozen" },
  { name: "Butter", weeklyUSD: 8, variable: true, amount: "2 lbs" },
  { name: "Chicken thighs", weeklyUSD: 10, variable: true, amount: "4 lbs" },
  { name: "Beef liver", weeklyUSD: 5, variable: true, amount: "2 lbs" },
  { name: "Salt & tallow", weeklyUSD: 5, variable: false, amount: "staples" },
  { name: "Bone broth ingredients", weeklyUSD: 3, variable: false, amount: "bones" },
];

const BudgetEating = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  useScrollToTop();

  const [currency, setCurrency] = useState(() => {
    try {
      const stored = localStorage.getItem("carnivore-budget-currency");
      return stored || "USD";
    } catch { return "USD"; }
  });
  const [weeks, setWeeks] = useState(1);
  const [items, setItems] = useState<BudgetItem[]>(BASE_ITEMS);

  const curr = CURRENCIES[currency] || CURRENCIES.USD;

  const convert = (usd: number) => Math.round(usd * curr.rate);
  const format = (usd: number) => `${curr.symbol}${convert(usd)}`;

  const totalWeekly = useMemo(() => items.reduce((sum, i) => sum + i.weeklyUSD, 0), [items]);

  const handleCurrencyChange = (c: string) => {
    setCurrency(c);
    localStorage.setItem("carnivore-budget-currency", c);
  };

  const toggleItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: "Custom item", weeklyUSD: 10, variable: true, amount: "" }]);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold">{t("budget.title")}</h1>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t("budget.subtitle")}</p>

        <ContentSection type="key_points" title="Affordable Cuts That Deliver" feedbackId="budget-cuts" feedbackQuestion="Will you try any of these cuts?" items={[
          "Ground beef: The ultimate budget staple — versatile and nutrient-dense",
          "Chuck roast: Perfect for slow cooking, falls apart tender",
          "Chicken thighs: Cheaper than breast, far more flavorful",
          "Pork shoulder: Incredible value with high fat content",
          "Beef heart: One of the cheapest organs, packed with CoQ10",
          "Canned sardines: Dirt cheap, loaded with omega-3s",
        ]} />

        <ContentSection type="tips" title="Shopping Smarter" feedbackId="budget-shopping" feedbackQuestion="Do you already use any of these strategies?" items={[
          "Buy in bulk when sales hit and freeze portions",
          "Check clearance sections for marked-down meat",
          "Warehouse clubs often have the best per-pound prices",
          "Build a relationship with your local butcher for deals",
          "Buy whole chickens instead of individual parts",
        ]} />

        <ContentSection type="key_points" title="Buying in Bulk" feedbackId="budget-bulk" feedbackQuestion="Would you consider a bulk buy?" items={[
          "Look into quarter or half cow shares from local farms",
          "Split large orders with friends or family to reduce cost",
          "A chest freezer pays for itself within months",
          "Cost per pound drops dramatically with bulk purchases",
          "Many farms offer payment plans for large orders",
        ]} />

        <ContentSection type="tips" title="Free & Nearly Free Food" feedbackId="budget-free" feedbackQuestion="Have you tried any of these?" items={[
          "Hunting and fishing — invest once, eat for months",
          "Ask butchers for bones, fat trimmings, and scraps",
          "Organ meats are often given away or sold cheaply",
          "Render your own tallow from beef fat (often free)",
          "Make rich bone broth from leftover bones",
        ]} />

        <ContentSection type="key_points" title="Weekly Meal Prep on a Budget" feedbackId="budget-prep" feedbackQuestion="Would this work for your schedule?" items={[
          "Batch cook 5 lbs of ground beef on Sunday",
          "Slow-cook tough, cheap cuts into tender meals",
          "Hard-boil a dozen eggs for grab-and-go protein",
          "Render tallow once a month for cooking fat supply",
          "Freeze individual portions for zero-waste weeks",
        ]} />

        {/* Weekly Budget Plan with controls */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm mb-3">📊 Weekly Budget Plan</h3>

            {/* Currency selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-muted-foreground">Currency:</span>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(CURRENCIES).map(([code, { label }]) => (
                  <button
                    key={code}
                    onClick={() => handleCurrencyChange(code)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                      currency === code ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weeks selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-muted-foreground">Plan for:</span>
              <div className="flex gap-1">
                {[1, 2, 4, 6, 8].map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeeks(w)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      weeks === w ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {w}w
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="divide-y divide-border">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-foreground">{item.name}</span>
                  {item.amount && <span className="text-[10px] text-muted-foreground ml-1">({item.amount})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{format(item.weeklyUSD * weeks)}</span>
                  {item.variable && (
                    <button onClick={() => toggleItem(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addItem} className="w-full px-4 py-2.5 text-xs text-primary font-medium text-left hover:bg-accent/30 transition-colors">
              + Add custom item
            </button>
          </div>

          {/* Total */}
          <div className="px-4 py-3 bg-primary/5 border-t border-border">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-foreground">
                {weeks > 1 ? `${weeks}-Week Total` : "Estimated Weekly Total"}
              </span>
              <span className="text-sm font-bold text-primary">{format(totalWeekly * weeks)}</span>
            </div>
            {weeks > 1 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {format(totalWeekly)}/week average
              </p>
            )}
          </div>
        </div>
      </div>

      <MotivationCTA />
    </div>
  );
};

export default BudgetEating;
