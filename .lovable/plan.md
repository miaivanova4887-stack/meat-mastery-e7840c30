## V2: Same-slot replacement after "Not really"

Build on the v1 dismissal flow. When an eligible replacement exists, the dismissed article's slot is reused by another article (same theme first, adjacent theme second) instead of collapsing to empty.

### 1. Shared corpus — `src/data/articleCorpus.ts` (new)

Data-driven, no JSX factories (avoids hydration/unstable-ref issues). Each item describes how to render via the existing primitives (`ContentSection`, custom `cravings` card, `stories` card, `benefits` card):

```ts
type ContentKind =
  | { kind: "section"; type: "overview" | "key_points" | "tips" | "data" | "important";
      titleKey: string; questionKey?: string;
      itemsKey?: string; dataRowsKey?: string; bodyKey?: string }
  | { kind: "cravings"; iconName: string; titleKey: string; descKey: string; questionKey: string }
  | { kind: "sustain";  iconName: string; titleKey: string; descKey: string; questionKey: string; link?: string }
  | { kind: "benefit";  iconName: string; titleKey: string; descKey: string; questionKey: string }
  | { kind: "myth";     index: number }            // pulls from t("myths.items")[index]
  | { kind: "story";    story: StoryDef };         // static, EN-only like today

export type ArticleCorpusItem = {
  id: string;          // matches feedbackId / articleId, e.g. "benefits-energy"
  theme: string;       // matches THEME_ADJACENCY keys
  page: string;        // "benefits" | "cravings" | "sustain" | ...
  content: ContentKind;
};

export const ARTICLE_CORPUS: ArticleCorpusItem[];
export function getCorpusItem(id: string): ArticleCorpusItem | undefined;
export function getPageItems(page: string): ArticleCorpusItem[];
```

The current per-page arrays (`benefitKeys`, `strategyKeys`, `tipKeys`, `stories`, the `<ContentSection>` calls in Athletic / Guide / Budget / GettingStarted / Myths) are migrated into this corpus. Each page then renders by mapping over its corpus slice — no duplicated JSX. A single `<CorpusItemRenderer item={...} />` component knows how to render each `ContentKind`.

### 2. Replacement engine — extend `src/lib/articleThemes.ts`

Keep `pickReplacement` for back-compat; add corpus-aware version:

```ts
export function pickReplacementFromCorpus(opts: {
  currentId: string;
  currentTheme: string;
  dismissedIds: Set<string>;
  visibleIds: Set<string>;
  injectedIds: Set<string>;
}): ArticleCorpusItem | null
```

Order: same theme → adjacent themes (via `THEME_ADJACENCY`) → null. Excludes `currentId`, anything in `dismissedIds`, anything currently visible on the page, and anything already injected this session.

### 3. Page-level orchestration — `src/hooks/useArticleSlots.ts` (new)

Each migrated page calls:

```ts
const { slots, onDismiss } = useArticleSlots(initialIdsForThisPage);
```

Internally:

- `slots: string[]` — ordered list of article IDs to render (starts as the page's corpus IDs minus already-dismissed ones).
- A `Set<string>` of `injectedIds` for the current view instance (not persisted).
- `onDismiss(id)` is called when `ArticleFeedback` finishes its 3 s acknowledgment. It runs `pickReplacementFromCorpus`; if found, replaces `id` with the new id in `slots` and adds it to `injectedIds`; otherwise removes the slot (hide-only fallback).

The page renders `slots.map(id => <CorpusItemRenderer key={id} item={getCorpusItem(id)!} onDismiss={onDismiss} />)`. Keying by `id` (not index) gives React stable identity, and the freshly-mounted replacement gets `animate-fade-in` for the subtle entry. `key` change on the slot drives the cross-fade naturally.

### 4. `ArticleFeedback` + `ContentSection` / `DismissibleCard` wiring

- `ArticleFeedback` already accepts `onDismiss`; it currently only marks the article as dismissed. After the 3 s timer, it will also invoke the page-level `onDismiss(id)` so the slot can be swapped. Persistence (`dismiss()` → `useDismissedArticles`) is unchanged.
- `ContentSection` / `DismissibleCard` keep their fade/collapse, but when the parent swaps `key`, the old node unmounts after fade and the new corpus item mounts in its place. We add a small grace: parent waits ~320 ms (the existing fade) before swapping `slots[i]`, so the user sees fade-out → fade-in rather than an abrupt replace. Implemented via a queued swap inside `useArticleSlots`.

### 5. Pages touched

Migrated to corpus + slots:

- `src/pages/Benefits.tsx`
- `src/pages/Cravings.tsx`
- `src/pages/Sustain.tsx`
- `src/pages/AthleticPerformance.tsx`
- `src/pages/Myths.tsx`
- `src/pages/Guide.tsx`
- `src/pages/BudgetEating.tsx`
- `src/pages/GettingStarted.tsx`
- `src/pages/Stories.tsx`

Sex-conditional Benefits items (`hormones_f`, `testosterone`, `lean_muscle`) stay filtered at the page level before handing IDs to `useArticleSlots`, so replacements never inject a wrong-sex card.

Non-dismissible `type: "important"` sections (warnings, disclaimers) stay outside `useArticleSlots` — they are not eligible as replacements and cannot be dismissed (already enforced by `ContentSection`).

### 6. Same-slot animation

- Old card fades + collapses (existing 300 ms behavior, unchanged).
- After the collapse settles, parent updates `slots[i]` → new corpus id.
- New card mounts with `animate-fade-in-up` (already used by these cards) for a smooth entrance in the same layout slot.

### 7. Fallback / no-eligible-replacement

If `pickReplacementFromCorpus` returns `null`, behavior matches v1 exactly: the slot is removed and surrounding cards reflow. This applies to:

- Stories (short, page-local pool; cross-theme matches uncommon and curated)
- Any page where the user has dismissed enough items that the corpus is exhausted for that theme + adjacency
- Sex-filtered Benefits where the only same-theme remainder is wrong-sex

### 8. Constraints preserved

- v1 persistence (`carnivore-dismissed-articles` + `content_reactions`) untouched.
- 3-second acknowledgment timing unchanged.
- "Yes" flow unchanged.
- No schema changes.
- Deterministic, no AI calls.
- No factory functions stored in state; corpus is plain data, render is a switch in `CorpusItemRenderer`.

- Keep the corpus focused on the dismissible content blocks, not whole-page layout wrappers.
- Make `onDismiss(id)` idempotent so duplicate timer/event fires cannot double-swap a slot.

### Files

New:

- `src/data/articleCorpus.ts`
- `src/hooks/useArticleSlots.ts`
- `src/components/CorpusItemRenderer.tsx`

Edited:

- `src/lib/articleThemes.ts` (add `pickReplacementFromCorpus`)
- `src/components/ArticleFeedback.tsx` (call page-level `onDismiss` after the 3 s timer; already props-ready)
- `src/pages/Benefits.tsx`, `Cravings.tsx`, `Sustain.tsx`, `AthleticPerformance.tsx`, `Myths.tsx`, `Guide.tsx`, `BudgetEating.tsx`, `GettingStarted.tsx`, `Stories.tsx` (render via corpus + slots)

### Success criteria check

- ✅ Same-slot replacement after fade-out when eligible.
- ✅ Same-theme first, adjacent second via `THEME_ADJACENCY`.
- ✅ No duplicates on the page (excludes `visibleIds` and `injectedIds`).
- ✅ Cross-session persistence intact.
- ✅ Hide-only fallback when no replacement.