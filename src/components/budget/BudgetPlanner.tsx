import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { CURRENCIES, detectCurrency, type CurrencyCode } from "./currencyData";
import { getLocalPrices, type BudgetItem } from "./localPrices";
import { resetViewportScale } from "@/lib/utils";

const STORAGE_KEY = "carnivore-budget-overrides";

type Overrides = Record<string, Record<number, { name?: string; weeklyLocal?: number }>>;

function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(o: Overrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
}

function applyOverrides(items: BudgetItem[], currency: CurrencyCode): BudgetItem[] {
  const overrides = loadOverrides()[currency] || {};
  return items.map((item, idx) => {
    const o = overrides[idx];
    if (!o) return item;
    return {
      ...item,
      name: o.name ?? item.name,
      weeklyLocal: o.weeklyLocal ?? item.weeklyLocal,
    };
  });
}

const EditableCell = ({
  value,
  onSave,
  type = "text",
  className = "",
  symbol = "",
}: {
  value: string | number;
  onSave: (v: string) => void;
  type?: "text" | "number";
  className?: string;
  symbol?: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== String(value)) onSave(trimmed);
    else setDraft(String(value));
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value)); setEditing(true); }}
        className={`text-left hover:bg-accent/40 rounded px-1 -mx-1 transition-colors cursor-text ${className}`}
      >
        {symbol}{type === "number" ? Math.round(Number(value)) : value}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { commit(); resetViewportScale(); }}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
      type={type}
      className={`bg-accent/60 rounded px-1 -mx-1 outline-none ring-1 ring-primary/30 text-base md:text-sm ${className}`}
      style={{ width: type === "number" ? "60px" : "auto" }}
    />
  );
};

const BudgetPlanner = () => {
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    try {
      const stored = localStorage.getItem("carnivore-budget-currency");
      if (stored && stored in CURRENCIES) return stored as CurrencyCode;
    } catch {}
    return detectCurrency();
  });
  const [weeks, setWeeks] = useState(1);
  const [items, setItems] = useState<BudgetItem[]>(() => applyOverrides(getLocalPrices(currency), currency));
  const [customItems, setCustomItems] = useState<BudgetItem[]>(() => {
    try {
      const raw = localStorage.getItem(`carnivore-budget-custom-${currency}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const curr = CURRENCIES[currency];
  const format = (value: number) => `${curr.symbol}${Math.round(value)}`;

  const allItems = useMemo(() => [...items, ...customItems], [items, customItems]);
  const totalWeekly = useMemo(() => allItems.reduce((sum, i) => sum + i.weeklyLocal, 0), [allItems]);

  const persistOverride = useCallback((idx: number, patch: { name?: string; weeklyLocal?: number }) => {
    const all = loadOverrides();
    if (!all[currency]) all[currency] = {};
    all[currency][idx] = { ...(all[currency][idx] || {}), ...patch };
    saveOverrides(all);
  }, [currency]);

  const persistCustomItems = useCallback((updated: BudgetItem[]) => {
    localStorage.setItem(`carnivore-budget-custom-${currency}`, JSON.stringify(updated));
  }, [currency]);

  const handleCurrencyChange = (c: CurrencyCode) => {
    setCurrency(c);
    localStorage.setItem("carnivore-budget-currency", c);
    setItems(applyOverrides(getLocalPrices(c), c));
    try {
      const raw = localStorage.getItem(`carnivore-budget-custom-${c}`);
      setCustomItems(raw ? JSON.parse(raw) : []);
    } catch { setCustomItems([]); }
  };

  const updateItemName = (idx: number, name: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, name } : it));
    persistOverride(idx, { name });
  };

  const updateItemPrice = (idx: number, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, weeklyLocal: num } : it));
    persistOverride(idx, { weeklyLocal: num });
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    // Also remove override
    const all = loadOverrides();
    if (all[currency]) { delete all[currency][idx]; saveOverrides(all); }
  };

  const updateCustomName = (idx: number, name: string) => {
    const updated = customItems.map((it, i) => i === idx ? { ...it, name } : it);
    setCustomItems(updated);
    persistCustomItems(updated);
  };

  const updateCustomPrice = (idx: number, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    const updated = customItems.map((it, i) => i === idx ? { ...it, weeklyLocal: num } : it);
    setCustomItems(updated);
    persistCustomItems(updated);
  };

  const removeCustom = (idx: number) => {
    const updated = customItems.filter((_, i) => i !== idx);
    setCustomItems(updated);
    persistCustomItems(updated);
  };

  const addItem = () => {
    const updated = [...customItems, { name: "Custom item", weeklyLocal: 10, removable: true, amount: "" }];
    setCustomItems(updated);
    persistCustomItems(updated);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground text-sm mb-1">📊 Weekly Budget Plan</h3>
        <p className="text-[10px] text-muted-foreground mb-3">
          Tap any name or price to edit. Changes are saved automatically.
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
          <div key={`base-${idx}`} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex-1 min-w-0 mr-2">
              <EditableCell
                value={item.name}
                onSave={(v) => updateItemName(idx, v)}
                className="text-xs text-foreground"
              />
              {item.amount && <span className="text-[10px] text-muted-foreground ml-1">({item.amount})</span>}
            </div>
            <div className="flex items-center gap-2">
              <EditableCell
                value={item.weeklyLocal * weeks}
                onSave={(v) => updateItemPrice(idx, String(parseFloat(v) / weeks))}
                type="number"
                className="text-xs font-medium text-foreground text-right"
                symbol={curr.symbol}
              />
              {item.removable && (
                <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        {customItems.map((item, idx) => (
          <div key={`custom-${idx}`} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex-1 min-w-0 mr-2">
              <EditableCell
                value={item.name}
                onSave={(v) => updateCustomName(idx, v)}
                className="text-xs text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <EditableCell
                value={item.weeklyLocal * weeks}
                onSave={(v) => updateCustomPrice(idx, String(parseFloat(v) / weeks))}
                type="number"
                className="text-xs font-medium text-foreground text-right"
                symbol={curr.symbol}
              />
              <button onClick={() => removeCustom(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
                ✕
              </button>
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
