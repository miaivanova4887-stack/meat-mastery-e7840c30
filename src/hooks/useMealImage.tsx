import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache to avoid re-fetching during session
const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

export function useMealImage(recipeName: string, tags?: string[]) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    imageCache.get(recipeName) || null
  );
  const [loading, setLoading] = useState(!imageCache.has(recipeName));

  useEffect(() => {
    if (!recipeName) {
      setLoading(false);
      return;
    }

    // Already cached in memory
    if (imageCache.has(recipeName)) {
      setImageUrl(imageCache.get(recipeName)!);
      setLoading(false);
      return;
    }

    // Deduplicate concurrent requests for same recipe
    let request = pendingRequests.get(recipeName);
    if (!request) {
      request = (async () => {
        try {
          const { data, error } = await supabase.functions.invoke(
            "generate-meal-image",
            { body: { recipeName, tags } }
          );
          if (error || data?.error) return null;
          return data?.imageUrl || null;
        } catch {
          return null;
        }
      })();
      pendingRequests.set(recipeName, request);
    }

    request.then((url) => {
      pendingRequests.delete(recipeName);
      if (url) {
        imageCache.set(recipeName, url);
        setImageUrl(url);
      }
      setLoading(false);
    });
  }, [recipeName]);

  return { imageUrl, loading };
}

// Component for lazy-loading meal images
export function MealImage({
  recipeName,
  tags,
  className = "",
}: {
  recipeName: string;
  tags?: string[];
  className?: string;
}) {
  const { imageUrl, loading } = useMealImage(recipeName, tags);

  if (loading) {
    return (
      <div
        className={`bg-secondary animate-pulse rounded-xl flex items-center justify-center ${className}`}
      >
        <span className="text-2xl">🥩</span>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div
        className={`bg-secondary/60 rounded-xl flex items-center justify-center ${className}`}
      >
        <span className="text-2xl">🥩</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={recipeName}
      className={`object-cover rounded-xl ${className}`}
      loading="lazy"
    />
  );
}
