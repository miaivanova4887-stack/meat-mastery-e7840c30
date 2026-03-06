import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface ShoppingBagContextType {
  items: string[];
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
  clearBag: () => void;
  hasItem: (item: string) => boolean;
  count: number;
}

const ShoppingBagContext = createContext<ShoppingBagContextType | undefined>(undefined);

const STORAGE_KEY = "carnivore-shopping-bag";

export const ShoppingBagProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((item: string) => {
    setItems((prev) => {
      if (prev.includes(item)) return prev;
      toast.success(`${item} added to bag`);
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((item: string) => {
    setItems((prev) => prev.filter((i) => i !== item));
  }, []);

  const clearBag = useCallback(() => {
    setItems([]);
    toast("Bag cleared");
  }, []);

  const hasItem = useCallback((item: string) => items.includes(item), [items]);

  return (
    <ShoppingBagContext.Provider value={{ items, addItem, removeItem, clearBag, hasItem, count: items.length }}>
      {children}
    </ShoppingBagContext.Provider>
  );
};

export const useShoppingBag = () => {
  const ctx = useContext(ShoppingBagContext);
  if (!ctx) throw new Error("useShoppingBag must be used within ShoppingBagProvider");
  return ctx;
};
