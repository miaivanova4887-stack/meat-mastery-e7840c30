import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "carnivore-favorite-recipes";

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setFavorites(loadFavorites());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const toggleFavorite = useCallback((recipeName: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(recipeName)) {
        next.delete(recipeName);
      } else {
        next.add(recipeName);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (recipeName: string) => favorites.has(recipeName),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite, count: favorites.size };
}
