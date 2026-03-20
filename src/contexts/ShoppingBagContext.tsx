import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type UnitSystem = "imperial" | "metric";

export interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
}

interface ShoppingBagContextType {
  items: ShoppingItem[];
  addItem: (name: string, quantity?: number, unit?: string) => void;
  removeItem: (name: string) => void;
  clearBag: () => void;
  hasItem: (name: string) => boolean;
  count: number;
  unitSystem: UnitSystem;
  toggleUnitSystem: () => void;
  updateQuantity: (name: string, quantity: number) => void;
}

const ShoppingBagContext = createContext<ShoppingBagContextType | undefined>(undefined);

const STORAGE_KEY = "carnivore-shopping-bag-v2";
const UNIT_KEY = "carnivore-unit-system";

// Unit conversion helpers
const CONVERSIONS: Record<string, { to: string; factor: number }> = {
  oz: { to: "g", factor: 28.35 },
  lb: { to: "kg", factor: 0.4536 },
  g: { to: "oz", factor: 1 / 28.35 },
  kg: { to: "lb", factor: 1 / 0.4536 },
  tbsp: { to: "ml", factor: 14.79 },
  tsp: { to: "ml", factor: 4.93 },
  cup: { to: "ml", factor: 236.59 },
  cups: { to: "ml", factor: 236.59 },
  ml: { to: "tbsp", factor: 1 / 14.79 },
};

const IMPERIAL_UNITS = ["oz", "lb", "tbsp", "tsp", "cup", "cups"];
const METRIC_UNITS = ["g", "kg", "ml"];

export function convertUnit(quantity: number, unit: string, targetSystem: UnitSystem): { quantity: number; unit: string } {
  const isImperial = IMPERIAL_UNITS.includes(unit);
  const isMetric = METRIC_UNITS.includes(unit);

  if ((targetSystem === "imperial" && isImperial) || (targetSystem === "metric" && isMetric)) {
    return { quantity, unit };
  }

  const conv = CONVERSIONS[unit];
  if (!conv) return { quantity, unit };

  const converted = quantity * conv.factor;
  return { quantity: Math.round(converted * 100) / 100, unit: conv.to };
}

export function parseAmount(amount: string): { quantity: number; unit: string } {
  const match = amount.match(/^([\d./]+)\s*(.*)$/);
  if (!match) return { quantity: 1, unit: "piece" };

  let qty: number;
  if (match[1].includes("/")) {
    const parts = match[1].split("/");
    qty = parseFloat(parts[0]) / parseFloat(parts[1]);
  } else {
    qty = parseFloat(match[1]);
  }

  const unit = match[2].trim().toLowerCase() || "piece";
  return { quantity: isNaN(qty) ? 1 : qty, unit };
}

export const ShoppingBagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ShoppingItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      // Migrate from old format
      const old = localStorage.getItem("carnivore-shopping-bag");
      if (old) {
        const oldItems: string[] = JSON.parse(old);
        return oldItems.map(name => ({ name, quantity: 1, unit: "piece" }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const [unitSystem, setUnitSystem] = useState<UnitSystem>(() => {
    try {
      return (localStorage.getItem(UNIT_KEY) as UnitSystem) || "imperial";
    } catch {
      return "imperial";
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(UNIT_KEY, unitSystem);
  }, [unitSystem]);

  const addItem = useCallback((name: string, quantity = 1, unit = "piece") => {
    setItems((prev) => {
      const existing = prev.find(i => i.name.toLowerCase() === name.toLowerCase() && i.unit === unit);
      if (existing) {
        toast.success(`${name} quantity updated`);
        return prev.map(i =>
          i.name.toLowerCase() === name.toLowerCase() && i.unit === unit
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      toast.success(`${name} added to shopping list`);
      return [...prev, { name, quantity, unit }];
    });
  }, []);

  const removeItem = useCallback((name: string) => {
    setItems((prev) => prev.filter((i) => i.name !== name));
  }, []);

  const clearBag = useCallback(() => {
    setItems([]);
    toast("Shopping list cleared");
  }, []);

  const hasItem = useCallback((name: string) => items.some(i => i.name.toLowerCase() === name.toLowerCase()), [items]);

  const updateQuantity = useCallback((name: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.name !== name));
      return;
    }
    setItems(prev => prev.map(i => i.name === name ? { ...i, quantity } : i));
  }, []);

  const toggleUnitSystem = useCallback(() => {
    setUnitSystem(prev => prev === "imperial" ? "metric" : "imperial");
  }, []);

  return (
    <ShoppingBagContext.Provider value={{
      items, addItem, removeItem, clearBag, hasItem,
      count: items.length, unitSystem, toggleUnitSystem, updateQuantity
    }}>
      {children}
    </ShoppingBagContext.Provider>
  );
};

export const useShoppingBag = () => {
  const ctx = useContext(ShoppingBagContext);
  if (!ctx) throw new Error("useShoppingBag must be used within ShoppingBagProvider");
  return ctx;
};
