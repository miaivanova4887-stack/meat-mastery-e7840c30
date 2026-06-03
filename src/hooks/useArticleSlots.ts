import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDismissedArticles } from "@/hooks/useDismissedArticles";
import { getCorpusItem, ARTICLE_CORPUS, type ArticleCorpusItem } from "@/data/articleCorpus";
import { pickReplacementFromCorpus } from "@/lib/articleThemes";

interface Options {
  /** Extra IDs that must never be injected as replacements (e.g. wrong-sex benefits). */
  extraExcluded?: Set<string>;
  /** Delay before swapping the dismissed slot, matching the fade-out duration. */
  swapDelayMs?: number;
}

/**
 * Manages a list of article slots on a page. When `onDismiss(id)` is called,
 * waits for the fade-out and then either swaps the slot with a thematically
 * related replacement or removes it entirely (hide-only fallback).
 */
export function useArticleSlots(initialIds: string[], opts: Options = {}) {
  const { extraExcluded, swapDelayMs = 340 } = opts;
  const { dismissed } = useDismissedArticles();

  // Start with the initial IDs minus anything the user previously dismissed.
  const startingSlots = useMemo(
    () => initialIds.filter((id) => !dismissed.has(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // freeze on mount; we don't want IDs reshuffling mid-session
  );

  const [slots, setSlots] = useState<string[]>(startingSlots);
  const injectedRef = useRef<Set<string>>(new Set());
  const handledRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const onDismiss = useCallback(
    (id: string) => {
      if (handledRef.current.has(id)) return;
      handledRef.current.add(id);

      const item = getCorpusItem(id);
      const theme = item?.theme;

      const t = window.setTimeout(() => {
        setSlots((prev) => {
          const idx = prev.indexOf(id);
          if (idx === -1) return prev;

          let replacement: ArticleCorpusItem | null = null;
          if (theme) {
            const visible = new Set(prev);
            const excluded = new Set<string>([...dismissed]);
            if (extraExcluded) extraExcluded.forEach((x) => excluded.add(x));
            replacement = pickReplacementFromCorpus({
              currentId: id,
              currentTheme: theme,
              dismissedIds: excluded,
              visibleIds: visible,
              injectedIds: injectedRef.current,
            });
          }

          const next = [...prev];
          if (replacement) {
            injectedRef.current.add(replacement.id);
            next[idx] = replacement.id;
          } else {
            next.splice(idx, 1);
          }
          return next;
        });
      }, swapDelayMs);
      timersRef.current.push(t);
    },
    [dismissed, extraExcluded, swapDelayMs],
  );

  return { slots, onDismiss };
}

// Re-export for convenience
export { ARTICLE_CORPUS };
