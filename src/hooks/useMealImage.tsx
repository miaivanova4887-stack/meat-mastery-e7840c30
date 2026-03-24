import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache to avoid re-fetching during session
const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const toCacheKey = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/** Build an optimized image URL with width/quality params via Supabase render API */
function optimizedUrl(key: string, width = 480, quality = 70): string {
  // Use Supabase's built-in image transformation render endpoint
  return `${SUPABASE_URL}/storage/v1/render/image/public/meal-images/${key}.png?width=${width}&quality=${quality}&resize=contain`;
}

/** Fallback to raw public URL */
function rawUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/meal-images/${key}.png`;
}

// Check if optimized render endpoint works, else fall back to raw
async function resolveImageUrl(recipeName: string): Promise<string | null> {
  const key = toCacheKey(recipeName);
  
  // Try optimized (smaller, faster) first
  const optUrl = optimizedUrl(key, 480, 70);
  try {
    const resp = await fetch(optUrl, { method: "HEAD" });
    if (resp.ok) return optUrl;
  } catch { /* fall through */ }

  // Fall back to raw public URL
  const raw = rawUrl(key);
  try {
    const resp = await fetch(raw, { method: "HEAD" });
    if (resp.ok) return raw;
  } catch { /* not found */ }

  return null;
}

// Throttled queue: max 3 concurrent, deduped
const requestQueue: Array<() => void> = [];
let activeRequests = 0;
const MAX_CONCURRENT = 3;

function processQueue() {
  while (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
    const next = requestQueue.shift();
    if (next) { activeRequests++; next(); }
  }
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    requestQueue.push(() => {
      fn().then(resolve).catch(reject).finally(() => {
        activeRequests--;
        setTimeout(processQueue, 100);
      });
    });
    processQueue();
  });
}

function fetchImage(recipeName: string): Promise<string | null> {
  let request = pendingRequests.get(recipeName);
  if (request) return request;

  request = enqueue(() => resolveImageUrl(recipeName));
  pendingRequests.set(recipeName, request);
  request.finally(() => pendingRequests.delete(recipeName));
  return request;
}

export function useMealImage(recipeName: string, _tags?: string[], enabled = true) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    imageCache.get(recipeName) || null
  );
  const [loading, setLoading] = useState(!imageCache.has(recipeName) && enabled);

  useEffect(() => {
    if (!recipeName || !enabled) { setLoading(false); return; }

    if (imageCache.has(recipeName)) {
      setImageUrl(imageCache.get(recipeName)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchImage(recipeName).then((url) => {
      if (url) {
        imageCache.set(recipeName, url);
        setImageUrl(url);
      }
      setLoading(false);
    });
  }, [recipeName, enabled]);

  return { imageUrl, loading };
}

/** Lazy MealImage component: only fetches when visible in viewport */
export function MealImage({
  recipeName,
  tags,
  className = "",
  width,
}: {
  recipeName: string;
  tags?: string[];
  className?: string;
  width?: number;
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
      decoding="async"
      width={width}
      fetchPriority="low"
    />
  );
}
