import { useState, useCallback, useEffect } from "react";
import type { CustomRecipe } from "@/data/recipes";

const STORAGE_KEY = "carnivore-custom-recipes";

function loadRecipes(): CustomRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useCustomRecipes() {
  const [recipes, setRecipes] = useState<CustomRecipe[]>(loadRecipes);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }, [recipes]);

  const addRecipe = useCallback((recipe: CustomRecipe) => {
    setRecipes((prev) => [recipe, ...prev]);
  }, []);

  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRecipe = useCallback((id: string, updates: Partial<CustomRecipe>) => {
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  return { customRecipes: recipes, addRecipe, deleteRecipe, updateRecipe };
}
