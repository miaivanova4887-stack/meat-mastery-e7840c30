## Goal

Extend the Community section so users can publish freeform **posts** (title optional, body required, optional image) alongside existing **recipes**. Both types live in the same chronological feed, are like-able, and surface separately on the Profile.

## Schema change (single migration)

Mirror the existing `community_recipes` / `recipe_likes` shape so we reuse the trigger pattern and stay friction-free with RLS.

### `public.community_posts`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | author |
| `title` | text NULL | optional |
| `body` | text NOT NULL | required, length-checked in app |
| `image_url` | text NULL | public Supabase Storage URL |
| `likes_count` | int NOT NULL default 0 | maintained by trigger |
| `created_at` | timestamptz NOT NULL default now() |
| `updated_at` | timestamptz NOT NULL default now() | maintained by `touch_updated_at` trigger |

Indexes: `(created_at DESC)`, `(user_id)`, `(likes_count DESC)`.

### `public.post_likes`

| column | type | notes |
|---|---|---|
| `id` | uuid PK |
| `post_id` | uuid NOT NULL |
| `user_id` | uuid NOT NULL |
| `created_at` | timestamptz default now() |
| UNIQUE `(post_id, user_id)` |

### RLS + grants

- `community_posts`:
  - `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`, `GRANT SELECT TO anon`, `GRANT ALL TO service_role`.
  - Anyone can read; auth users can insert with `auth.uid() = user_id`; update/delete only own row.
- `post_likes`:
  - same grants.
  - Anyone can read counts; auth users insert with `auth.uid() = user_id`; delete own.

### Triggers / functions

- New `public.update_post_likes_count()` (SECURITY DEFINER, mirrors `update_recipe_likes_count`) wired to INSERT/DELETE on `post_likes`.
- `touch_updated_at` (already exists) wired to UPDATE on `community_posts`.

### Storage

Reuse the existing public `recipe-images` bucket under a `posts/` prefix. No new bucket. Upload path: `posts/{user_id}/{uuid}.{ext}`. RLS on `storage.objects` already permits authenticated writes to this bucket.

### `delete-account` edge function

Add `community_posts` and `post_likes` to the cascade-delete list inside `supabase/functions/delete-account/index.ts` (purely additive).

## Component breakdown

### New files

- `src/components/community/PostCard.tsx` — author row, optional title, body (3-line clamp + Read more toggle), optional image (lazy `<img>`), like button. Visual badge "Post" (chat icon) in top-right corner.
- `src/components/community/RecipeCard.tsx` — extracted from current inline JSX in `CommunityFeed.tsx`. Adds a "Recipe" badge (chef icon) in top-right corner so visual differentiation is symmetric.
- `src/components/community/CreateChoiceSheet.tsx` — bottom sheet shown when user taps the `+` FAB. Two big buttons: **Share a Recipe** (routes to `/create-recipe?share=true`, current behavior) and **Write a Post** (opens `CreatePostSheet`).
- `src/components/community/CreatePostSheet.tsx` — Sheet form: optional title (max 120 chars), required body (textarea, max 2000 chars, live counter, trim+nonempty zod check), optional image upload (max 5MB, jpg/png/webp; uploads to storage, shows preview, allows remove). Submit button disabled until body valid. Inserts row, refreshes feed via `onCreated()` callback.

### Modified files

- `src/components/CommunityFeed.tsx`
  - Add `kind: "recipe" | "post"` discriminator and a unified `FeedItem` type.
  - Fetch posts and recipes in parallel (`Promise.all`), merge, sort by `created_at` (or `likes_count` for the Popular tab).
  - Replace the inline recipe rendering with `<RecipeCard>` / `<PostCard>`.
  - Replace the lone `+` button with the `CreateChoiceSheet` trigger (still wrapped in `TeaserGate requiredTier="pro"`).
  - Likes state becomes two sets: `likedRecipeIds`, `likedPostIds`; toggle handlers dispatch by kind.
  - Empty state copy: "No community activity yet. Be the first to share."
- `src/pages/Profile.tsx`
  - In the **Community** tab (or in the "My Recipes" panel), introduce inner sub-tabs `Recipes` / `Posts`. Reuses `myRecipesQuery` and adds parallel `myPostsQuery` (RLS-scoped to user). Combined header count `{recipes + posts}`.
- `src/i18n/en.json` + `src/i18n/fr.json`
  - Add keys under a new `community.*` namespace: `createChoiceTitle`, `shareRecipe`, `writePost`, `postTitlePlaceholder`, `postBodyPlaceholder`, `postBodyRequired`, `imageOptional`, `uploadImage`, `removeImage`, `posting`, `post`, `readMore`, `readLess`, `recipeBadge`, `postBadge`, `myRecipes`, `myPosts`, `emptyPosts`.
- `supabase/functions/delete-account/index.ts`
  - Add `await admin.from("post_likes").delete().eq("user_id", uid)` and `await admin.from("community_posts").delete().eq("user_id", uid)` to the existing cascade block.

### Recipe components — co-existence changes

Only refactors, no behavior change:
- Pure JSX extraction into `RecipeCard.tsx`; props mirror today's row shape.
- Add a small badge in the existing card header (chef icon + "Recipe"). Identical styling token used by `PostCard` for symmetry.
- `recipe_likes` table and current toggle logic remain untouched.

## Implementation order (feed-first, ship-fastest)

1. **Migration** — create `community_posts`, `post_likes`, RLS, grants, trigger. Approve → wait for types regen.
2. **Feed read path** — add `RecipeCard` extraction + new `PostCard` + unified fetch/sort in `CommunityFeed.tsx`. At this point the feed renders posts immediately once any rows exist; no creation UI yet.
3. **Create post** — `CreateChoiceSheet` + `CreatePostSheet`, including storage upload to `recipe-images/posts/{uid}/…`. End-to-end create → appears in feed.
4. **Likes for posts** — wire `post_likes` toggle parallel to existing recipe like flow (single shared `toggleLike(kind, id)` helper). Use trigger-maintained `likes_count` so optimistic UI matches.
5. **Profile counts + tabs** — add `myPostsQuery`, sub-tabs, copy.
6. **i18n** — add EN/FR keys.
7. **delete-account** — append the two cascade deletions.

### Validation rules (zod, client-side)

```ts
const postSchema = z.object({
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body:  z.string().trim().min(1, "Write something").max(2000),
  image_url: z.string().url().optional().nullable(),
});
```

## Verification

- Create a post with body only → appears top of feed with "Post" badge.
- Create a post with title + image → renders title, image, like button works.
- Like toggle on both card types persists across reload.
- Sort toggle (Latest / Popular) reorders both kinds correctly.
- RLS: another user can read but cannot update/delete; anon can read.
- Profile sub-tabs show correct rows; delete-account purges both tables.
- Dark + light themes look correct (no token changes needed).

## Out of scope (explicit)

- Comments on posts or recipes (not currently implemented for recipes; spec says "if already implemented").
- Post edit UI (DB allows it; not exposed yet — easy follow-up).
- Push notifications on new posts.
- Pagination beyond the current `limit(50)` (lazy-load is a follow-up — current feed uses a hard limit and that stays consistent across both kinds).