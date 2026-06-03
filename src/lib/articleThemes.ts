/**
 * Theme mapping for article-style educational content.
 * Themes are inferred from the `feedbackId` prefix (e.g. `benefits-foo` → `benefits`).
 * Adjacency is used by future replacement logic to pick semantically-related content.
 */

export const THEME_ADJACENCY: Record<string, string[]> = {
  cravings: ["first30", "started", "sustain", "benefits"],
  budget: ["guide", "sustain"],
  myths: ["benefits", "guide", "athletic"],
  athletic: ["benefits", "guide", "sustain"],
  benefits: ["sustain", "guide"],
  sustain: ["benefits", "first30", "started"],
  guide: ["benefits", "first30", "started"],
  first30: ["cravings", "guide"],
  started: ["cravings", "guide"],
  stories: ["benefits", "sustain"],
};

const KNOWN_THEMES = new Set(Object.keys(THEME_ADJACENCY));

/** Derive theme from an article id like "benefits-inflammation" → "benefits". */
export function inferTheme(articleId: string): string | undefined {
  const prefix = articleId.split("-", 1)[0];
  return KNOWN_THEMES.has(prefix) ? prefix : undefined;
}

/**
 * Pick a replacement article. Same-theme candidates win; otherwise adjacency.
 * Returns null when no candidate exists.
 */
export function pickReplacement<T extends { id: string; theme: string }>(
  theme: string,
  pool: T[],
  excluded: Set<string>,
): T | null {
  const available = pool.filter((p) => !excluded.has(p.id));
  const sameTheme = available.find((p) => p.theme === theme);
  if (sameTheme) return sameTheme;
  for (const adj of THEME_ADJACENCY[theme] ?? []) {
    const hit = available.find((p) => p.theme === adj);
    if (hit) return hit;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ARTICLE_CORPUS, type ArticleCorpusItem } from "@/data/articleCorpus";

/**
 * Corpus-aware replacement picker. Excludes the dismissed article, anything
 * already dismissed, anything currently visible on the page, and anything
 * already injected during this session.
 */
export function pickReplacementFromCorpus(opts: {
  currentId: string;
  currentTheme: string;
  dismissedIds: Set<string>;
  visibleIds: Set<string>;
  injectedIds: Set<string>;
}): ArticleCorpusItem | null {
  const { currentId, currentTheme, dismissedIds, visibleIds, injectedIds } = opts;
  const isEligible = (item: ArticleCorpusItem) =>
    item.id !== currentId &&
    !dismissedIds.has(item.id) &&
    !visibleIds.has(item.id) &&
    !injectedIds.has(item.id);

  const sameTheme = ARTICLE_CORPUS.find(
    (i) => i.theme === currentTheme && isEligible(i),
  );
  if (sameTheme) return sameTheme;

  for (const adj of THEME_ADJACENCY[currentTheme] ?? []) {
    const hit = ARTICLE_CORPUS.find((i) => i.theme === adj && isEligible(i));
    if (hit) return hit;
  }
  return null;
}

