import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache to avoid re-fetching during session
const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const toCacheKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

// Check public bucket first — no edge function call needed
async function checkBucketCache(recipeName: string): Promise<string | null> {
  const key = toCacheKey(recipeName);
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/meal-images/${key}.png`;
  try {
    const resp = await fetch(publicUrl, { method: "HEAD" });
    if (resp.ok) return publicUrl;
  } catch { /* not cached */ }
  return null;
}

const requestKeyFor = (recipeName: string, tags?: string[]) => {
  const tagsKey = (tags || []).map((t) => t.toLowerCase()).sort().join("|");
  return `${recipeName}::${tagsKey}`;
};

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
          setTimeout(processQueue, 300);
        });
    });
    processQueue();
  });
}

function fetchImage(recipeName: string, tags?: string[]): Promise<string | null> {
  const requestKey = requestKeyFor(recipeName, tags);
  let request = pendingRequests.get(requestKey);
  if (request) return request;

  request = enqueue(async () => {
    // 1. Check bucket cache first (free, instant)
    const cached = await checkBucketCache(recipeName);
    if (cached) return cached;

    // 2. Fall back to edge function (generates + caches)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-meal-image",
          { body: { recipeName, tags } }
        );

        if (error) {
          console.warn(`[MealImage] Edge fn error for "${recipeName}":`, error);
          if (error.message?.includes("402") || error.message?.includes("401")) break;
          continue;
        }

        if (data?.error) {
          console.warn(`[MealImage] API error for "${recipeName}":`, data.error);
          if (data.error.includes("credits") || data.error.includes("402")) break;
          if (data.error.includes("429")) {
            await sleep(2000);
            continue;
          }
          continue;
        }

        if (data?.imageUrl) {
          return data.imageUrl as string;
        }
      } catch {
        // retry below
      }

      if (attempt < 1) {
        await sleep(450 * (attempt + 1));
      }
    }

    return null;
  });

  pendingRequests.set(requestKey, request);
  request.finally(() => pendingRequests.delete(requestKey));
  return request;
}

export function useMealImage(recipeName: string, tags?: string[], enabled = true) {
  const tagsKey = (tags || []).join("|");
  const [imageUrl, setImageUrl] = useState<string | null>(
    imageCache.get(recipeName) || null
  );
  const [loading, setLoading] = useState(!imageCache.has(recipeName) && enabled);

  useEffect(() => {
    if (!recipeName || !enabled) {
      setLoading(false);
      return;
    }

    setImageUrl(imageCache.get(recipeName) || null);

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
  }, [recipeName, tagsKey, enabled]);

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
