import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache to avoid re-fetching during session
const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

// Throttled queue: max 2 concurrent requests, 1s delay between batches
const requestQueue: Array<() => void> = [];
let activeRequests = 0;
const MAX_CONCURRENT = 2;

function processQueue() {
  while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
    const next = requestQueue.shift();
    if (next) {
      activeRequests++;
      next();
    }
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(() => {
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeRequests--;
          // Small delay before processing next to avoid rate limits
          setTimeout(processQueue, 300);
        });
    });
    processQueue();
  });
}

function fetchImage(recipeName: string, tags?: string[]): Promise<string | null> {
  let request = pendingRequests.get(recipeName);
  if (request) return request;

  request = enqueue(async () => {
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
  });

  pendingRequests.set(recipeName, request);
  request.finally(() => pendingRequests.delete(recipeName));
  return request;
}

export function useMealImage(recipeName: string, tags?: string[], enabled = true) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    imageCache.get(recipeName) || null
  );
  const [loading, setLoading] = useState(!imageCache.has(recipeName) && enabled);

  useEffect(() => {
    if (!recipeName || !enabled) {
      setLoading(false);
      return;
    }

    if (imageCache.has(recipeName)) {
      setImageUrl(imageCache.get(recipeName)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchImage(recipeName, tags).then((url) => {
      if (url) {
        imageCache.set(recipeName, url);
        setImageUrl(url);
      }
      setLoading(false);
    });
  }, [recipeName, enabled]);

  return { imageUrl, loading };
}

// Lazy MealImage component: only fetches when visible in viewport
export function MealImage({
  recipeName,
  tags,
  className = "",
}: {
  recipeName: string;
  tags?: string[];
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { imageUrl, loading } = useMealImage(recipeName, tags, isVisible);

  if (loading || !isVisible) {
    return (
      <div
        ref={ref}
        className={`bg-secondary animate-pulse rounded-xl flex items-center justify-center ${className}`}
      >
        <span className="text-2xl">🥩</span>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div
        ref={ref}
        className={`bg-secondary/60 rounded-xl flex items-center justify-center ${className}`}
      >
        <span className="text-2xl">🥩</span>
      </div>
    );
  }

  return (
    <img
      ref={ref as any}
      src={imageUrl}
      alt={recipeName}
      className={`object-cover rounded-xl ${className}`}
      loading="lazy"
    />
  );
}
