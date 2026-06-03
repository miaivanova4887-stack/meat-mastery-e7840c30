
## Goal

When a user taps **Not really** on any article-style content, show a brief acknowledgment, fade the item out after ~3s, and (when possible) replace it with a sibling article from the same or an adjacent theme. Existing **Yes** feedback is untouched.

## Affected surfaces

All pages that render `ContentSection` with a `feedbackId`:

- `src/pages/Benefits.tsx` (theme: `benefits`)
- `src/pages/Cravings.tsx` (theme: `cravings`)
- `src/pages/Sustain.tsx` (theme: `sustain`)
- `src/pages/AthleticPerformance.tsx` (theme: `athletic`)
- `src/pages/Myths.tsx` (theme: `myths`)
- `src/pages/Guide.tsx` (theme: `guide`)
- `src/pages/BudgetEating.tsx` (theme: `budget`)
- `src/pages/GettingStarted.tsx` (theme: `first30`)
- `src/pages/Stories.tsx` (theme: `stories`, uses `ArticleFeedback` directly)

`src/pages/NewsFeed.tsx` has no per-item ArticleFeedback today — out of scope for v1 (noted as future).

## Architecture

Centralize behavior in one hook + light wrappers so each page changes minimally.

### 1. Schema — `content_reactions`

```sql
CREATE TABLE public.content_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_id text NOT NULL,
  content_type text NOT NULL DEFAULT 'article',
  reaction text NOT NULL,          -- 'not_really' | 'yes' (future)
  theme text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id, reaction)
);
GRANT SELECT, INSERT, DELETE ON public.content_reactions TO authenticated;
GRANT ALL ON public.content_reactions TO service_role;
ALTER TABLE public.content_reactions ENABLE ROW LEVEL SECURITY;
-- policies: user can select/insert/delete own; service role bypasses
```

Local-first: dismissed IDs are also stored in `localStorage` (`carnivore-dismissed-articles`) so unauthenticated users get the same UX and SSR/offline works. DB write is best-effort (fire-and-forget) when logged in.

### 2. New hook — `src/hooks/useDismissibleArticle.ts`

Provides:

- `dismissedIds: Set<string>` — merged from localStorage + (if authed) DB
- `dismiss(articleId, theme?)` — writes locally, fires DB insert, dispatches `articles-dismissed` event
- `isDismissed(id)` — boolean
- listens to `articles-dismissed` cross-component sync

### 3. New helper — `src/lib/articleThemes.ts`

```ts
export const THEME_ADJACENCY: Record<string, string[]> = {
  cravings:  ['first30', 'sustain', 'benefits'],
  budget:    ['guide', 'sustain'],
  myths:     ['benefits', 'guide', 'athletic'],
  athletic:  ['benefits', 'guide', 'sustain'],
  benefits:  ['sustain', 'guide'],
  sustain:   ['benefits', 'first30'],
  guide:     ['benefits', 'first30'],
  first30:   ['cravings', 'guide'],
  stories:   ['benefits', 'sustain'],
};
export function pickReplacement(
  theme: string,
  pool: { id: string; theme: string }[],
  dismissed: Set<string>,
  exclude: Set<string>,
): { id: string; theme: string } | null { /* same theme first, then adjacency, then null */ }
```

### 4. `ArticleFeedback.tsx` changes

- Add optional `theme?: string` and `onNotReally?: () => void` props.
- On **Not really**:
  1. Save existing feedback (keeps reassuring copy visible).
  2. Show subtle inline text "Got it — we'll show less like this."
  3. After **3000 ms**, call `dismiss(articleId, theme)` and `onNotReally?.()`.

### 5. `ContentSection.tsx` changes

- Accept optional `theme?: string`, forward to `ArticleFeedback`.
- Use internal state `phase: 'visible' | 'fading' | 'gone'`; on dismiss callback, animate `animate-fade-out` + max-height collapse over 300ms then unmount.
- When unmounting, dispatch an `onDismiss(id, theme)` callback so the parent page can swap in a replacement.

### 6. Per-page wiring (centralized)

Introduce a tiny wrapper `src/components/ArticleList.tsx` that takes `theme` + an array of `{ id, render }`, tracks dismissed IDs via the hook, filters them out, and — when an item is dismissed — inserts a `pickReplacement(...)` from a `pool` prop (other items on the page or a shared corpus).

Migrate each of the 9 pages to render their `ContentSection`s through `ArticleList`. For pages whose pool is just the page's own list, replacement falls back to "hide only" once the local pool is exhausted (acceptable per spec).

Optionally, a small shared corpus index (`src/data/articleCorpus.ts`) maps every `feedbackId → { theme, render }` so cross-page replacement is possible later. v1 ships with per-page pools only to keep risk low.

### 7. Stories page

`Stories.tsx` uses `ArticleFeedback` directly inside a custom card. Wrap each story in the same dismiss flow via the hook (no list-swap; just fade out + hide). Same animation.

## Theme + ID mapping (already present in code)

Existing `feedbackId`s already encode theme via prefix (`benefits-*`, `cravings-*`, `myths-*`, `guide-*`, `budget-*`, `sustain-*`, `athletic-*`, `stories-*`). First-30-days IDs in `GettingStarted.tsx` will be normalized to `first30-*` (or theme passed explicitly so legacy IDs keep working).

## UX details

- Acknowledgment copy: "Got it — we'll show less like this." (added to en/fr i18n).
- Fade: 300 ms `opacity` + `max-height` collapse after the 3 s acknowledgment hold.
- Replacement slides in with `animate-fade-in`.
- No layout jump: collapse animates height; replacement mounts into the same slot.
- Detail-page case (Myths, Guide etc.): each section is independently dismissable in place. We do **not** navigate away — lower risk.

## Implementation order (lowest → highest risk)

1. **Migration** — create `content_reactions` table + RLS.
2. **Hook + helpers** — `useDismissibleArticle`, `articleThemes.ts`, i18n keys.
3. **ArticleFeedback** — add `theme` + 3s dismiss timer + ack copy.
4. **ContentSection** — fade/collapse + `onDismiss` callback.
5. **ArticleList wrapper** — filters + replacement pool.
6. **Page migrations** in this order, one at a time:
   Cravings → Sustain → Benefits → Athletic → Myths → Guide → Budget → GettingStarted → Stories.
7. Smoke-test each surface; confirm Yes flow unchanged.

## Where replacement is not possible (hide-only)

- **Stories.tsx** — short curated list, no semantic siblings on-page → fade + hide.
- Any page where the local pool is exhausted after multiple dismissals → fade + hide.
- Detail-style single-section pages → fade + hide (current spec accepts this).

## Constraints respected

- Yes/helpful path untouched.
- Reaction rows are per (`user_id`, `content_id`, `reaction`) — easy to delete later for a preferences-management screen.
- Deterministic mapping, no AI.
- Local-first so unauthed users still get dismissal UX.
