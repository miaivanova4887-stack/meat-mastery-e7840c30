import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import TeaserGate from "@/components/TeaserGate";
import RecipeCard, { type RecipeCardData } from "@/components/community/RecipeCard";
import PostCard, { type PostCardData } from "@/components/community/PostCard";
import CreateChoiceSheet from "@/components/community/CreateChoiceSheet";
import CreatePostSheet from "@/components/community/CreatePostSheet";

type FeedItem =
  | { kind: "recipe"; data: RecipeCardData; sortKey: number; popularKey: number }
  | { kind: "post"; data: PostCardData; sortKey: number; popularKey: number };

const CommunityFeed = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [likedRecipeIds, setLikedRecipeIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"latest" | "popular">("latest");
  const [showChoice, setShowChoice] = useState(false);
  const [showPostSheet, setShowPostSheet] = useState(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    const [recipesRes, postsRes] = await Promise.all([
      (supabase as any)
        .from("community_recipes")
        .select("*, profile:profiles(display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("community_posts")
        .select("*, profile:profiles(display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const recipeItems: FeedItem[] = (recipesRes.data || []).map((r: any) => ({
      kind: "recipe" as const,
      data: {
        ...r,
        tags: r.tags || [],
        diet_tiers: r.diet_tiers || [],
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      },
      sortKey: new Date(r.created_at).getTime(),
      popularKey: r.likes_count ?? 0,
    }));

    const postItems: FeedItem[] = (postsRes.data || []).map((p: any) => ({
      kind: "post" as const,
      data: {
        ...p,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
      },
      sortKey: new Date(p.created_at).getTime(),
      popularKey: p.likes_count ?? 0,
    }));

    setItems([...recipeItems, ...postItems]);
    setLoading(false);
  }, []);

  const fetchLikes = useCallback(async () => {
    if (!user) {
      setLikedRecipeIds(new Set());
      setLikedPostIds(new Set());
      return;
    }
    const [r, p] = await Promise.all([
      (supabase as any).from("recipe_likes").select("recipe_id").eq("user_id", user.id),
      (supabase as any).from("post_likes").select("post_id").eq("user_id", user.id),
    ]);
    if (r.data) setLikedRecipeIds(new Set(r.data.map((l: any) => l.recipe_id)));
    if (p.data) setLikedPostIds(new Set(p.data.map((l: any) => l.post_id)));
  }, [user]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);
  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  const sorted = [...items].sort((a, b) =>
    tab === "popular" ? b.popularKey - a.popularKey : b.sortKey - a.sortKey,
  );

  const toggleRecipeLike = async (recipeId: string) => {
    if (!user) {
      toast(t("community.recipe.signInToLike"));
      navigate("/auth");
      return;
    }
    const liked = likedRecipeIds.has(recipeId);
    if (liked) {
      await (supabase as any)
        .from("recipe_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("recipe_id", recipeId);
      setLikedRecipeIds((prev) => {
        const next = new Set(prev);
        next.delete(recipeId);
        return next;
      });
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "recipe" && it.data.id === recipeId
            ? {
                ...it,
                data: { ...it.data, likes_count: it.data.likes_count - 1 },
                popularKey: it.popularKey - 1,
              }
            : it,
        ),
      );
    } else {
      await (supabase as any)
        .from("recipe_likes")
        .insert({ user_id: user.id, recipe_id: recipeId });
      setLikedRecipeIds((prev) => new Set(prev).add(recipeId));
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "recipe" && it.data.id === recipeId
            ? {
                ...it,
                data: { ...it.data, likes_count: it.data.likes_count + 1 },
                popularKey: it.popularKey + 1,
              }
            : it,
        ),
      );
    }
  };

  const togglePostLike = async (postId: string) => {
    if (!user) {
      toast(t("community.post.signInToLike"));
      navigate("/auth");
      return;
    }
    const liked = likedPostIds.has(postId);
    if (liked) {
      await (supabase as any)
        .from("post_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", postId);
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "post" && it.data.id === postId
            ? {
                ...it,
                data: { ...it.data, likes_count: it.data.likes_count - 1 },
                popularKey: it.popularKey - 1,
              }
            : it,
        ),
      );
    } else {
      await (supabase as any).from("post_likes").insert({ user_id: user.id, post_id: postId });
      setLikedPostIds((prev) => new Set(prev).add(postId));
      setItems((prev) =>
        prev.map((it) =>
          it.kind === "post" && it.data.id === postId
            ? {
                ...it,
                data: { ...it.data, likes_count: it.data.likes_count + 1 },
                popularKey: it.popularKey + 1,
              }
            : it,
        ),
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Auth banner */}
      {!user && (
        <button
          onClick={() => navigate("/auth")}
          className="w-full ios-card p-4 flex items-center gap-3 hover:bg-secondary/60 transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users size={20} className="text-primary" />
          </div>
          <div className="text-left flex-1">
            <p className="text-[13px] font-semibold text-foreground">Join the Community</p>
            <p className="text-[11px] text-muted-foreground">
              Sign in to share recipes, write posts, and connect
            </p>
          </div>
          <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
        </button>
      )}

      {/* Sort tabs + create */}
      <div className="flex items-center gap-2">
        {(["latest", "popular"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
              tab === t ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        {user && (
          <TeaserGate requiredTier="pro" featureName="Community Posting">
            <button
              onClick={() => setShowChoice(true)}
              className="ml-auto w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              aria-label="Create"
            >
              <Plus size={16} />
            </button>
          </TeaserGate>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No community activity yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((it) =>
            it.kind === "recipe" ? (
              <RecipeCard
                key={`r-${it.data.id}`}
                recipe={it.data}
                liked={likedRecipeIds.has(it.data.id)}
                onToggleLike={() => toggleRecipeLike(it.data.id)}
              />
            ) : (
              <PostCard
                key={`p-${it.data.id}`}
                post={it.data}
                liked={likedPostIds.has(it.data.id)}
                onToggleLike={() => togglePostLike(it.data.id)}
              />
            ),
          )}
        </div>
      )}

      {/* Create sheets */}
      <CreateChoiceSheet
        open={showChoice}
        onClose={() => setShowChoice(false)}
        onShareRecipe={() => {
          setShowChoice(false);
          navigate("/create-recipe?share=true");
        }}
        onWritePost={() => {
          setShowChoice(false);
          setShowPostSheet(true);
        }}
      />
      <CreatePostSheet
        open={showPostSheet}
        onClose={() => setShowPostSheet(false)}
        onCreated={() => fetchFeed()}
      />
    </div>
  );
};

export default CommunityFeed;
