import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "carnivore-dismissed-articles";
const EVENT = "articles-dismissed";

function readLocal(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeLocal(set: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/**
 * Tracks article IDs the user has reacted to with "not really".
 * Persists locally and best-effort to Supabase `content_reactions` when authed.
 */
export function useDismissedArticles() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => readLocal());

  // Hydrate from DB on mount when authenticated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;
        const { data, error } = await supabase
          .from("content_reactions")
          .select("content_id")
          .eq("user_id", auth.user.id)
          .eq("reaction", "not_really");
        if (cancelled || error || !data) return;
        setDismissed((prev) => {
          const merged = new Set(prev);
          data.forEach((r: { content_id: string }) => merged.add(r.content_id));
          writeLocal(merged);
          return merged;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-component sync
  useEffect(() => {
    const handler = () => setDismissed(readLocal());
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const dismiss = useCallback(async (articleId: string, theme?: string) => {
    const next = readLocal();
    if (next.has(articleId)) return;
    next.add(articleId);
    writeLocal(next);
    setDismissed(new Set(next));
    window.dispatchEvent(new CustomEvent(EVENT));

    // Best-effort DB persistence
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      await supabase.from("content_reactions").upsert(
        {
          user_id: auth.user.id,
          content_id: articleId,
          content_type: "article",
          reaction: "not_really",
          theme: theme ?? null,
        },
        { onConflict: "user_id,content_id,reaction" },
      );
    } catch {
      /* ignore */
    }
  }, []);

  const isDismissed = useCallback(
    (id: string) => dismissed.has(id),
    [dismissed],
  );

  return { dismissed, dismiss, isDismissed };
}
