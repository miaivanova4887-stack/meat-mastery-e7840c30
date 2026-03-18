import { useState, useMemo } from "react";
import { CURRENCIES, detectCurrency, type CurrencyCode } from "./currencyData";
import { getLocalPrices, type BudgetItem } from "./localPrices";

const BudgetPlanner = () => {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    try {
      const stored = localStorage.getItem("carnivore-budget-currency");
      if (stored && stored in CURRENCIES) return stored as CurrencyCode;
    } catch {}
    return detectCurrency();
  });
  const [weeks, setWeeks] = useState(1);
  const [items, setItems] = useState<BudgetItem[]>(() => getLocalPrices(currency));

  const curr = CURRENCIES[currency];

  const format = (value: number) => `${curr.symbol}${Math.round(value)}`;

  const totalWeekly = useMemo(() => items.reduce((sum, i) => sum + i.weeklyLocal, 0), [items]);

  const handleCurrencyChange = (c: CurrencyCode) => {
    setCurrency(c);
    localStorage.setItem("carnivore-budget-currency", c);
    setItems(getLocalPrices(c));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: "Custom item", weeklyLocal: 10, removable: true, amount: "" }]);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm mb-1">📊 Weekly Budget Plan</h3>
        <p className="text-[10px] text-muted-foreground mb-3">
          Prices based on local market averages (source: GlobalProductPrices.com, 2026). Adjust items to match your area.
        </p>

        {/* Currency selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[11px] text-muted-foreground">Currency:</span>
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <button
                key={code}
                onClick={() => handleCurrencyChange(code)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                  currency === code ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                }`}
              >
                {CURRENCIES[code].label}
              </button>
            ))}
          </div>
        </div>

        {/* Weeks selector */}
        <div className="flex items-center gap-2">
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
              <span className="text-xs font-medium text-foreground">{format(item.weeklyLocal * weeks)}</span>
              {item.removable && (
                <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
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
  );
};

export default BudgetPlanner;
