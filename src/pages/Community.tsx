import { ArrowLeft, Heart, Clock, Flame, Users, Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CommunityRecipe {
  id: string;
  user_id: string;
  name: string;
  time: string;
  cal: string;
  protein: string;
  fat: string;
  serving: string;
  description: string;
  tags: string[];
  diet_tiers: string[];
  meal_type: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  likes_count: number;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

const Community = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"latest" | "popular">("latest");

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const order = tab === "popular" ? "likes_count" : "created_at";
    const { data, error } = await supabase
      .from("community_recipes")
      .select("*, profile:profiles!community_recipes_user_id_fkey(display_name, avatar_url)")
      .order(order, { ascending: false })
      .limit(50);

    if (!error && data) {
      setRecipes(data.map((r: any) => ({
        ...r,
        tags: r.tags || [],
        diet_tiers: r.diet_tiers || [],
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      })));
    }
    setLoading(false);
  }, [tab]);

  const fetchLikes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("recipe_likes")
      .select("recipe_id")
      .eq("user_id", user.id);
    if (data) setLikedIds(new Set(data.map((l: any) => l.recipe_id)));
  }, [user]);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);
  useEffect(() => { fetchLikes(); }, [fetchLikes]);

  const toggleLike = async (recipeId: string) => {
    if (!user) {
      toast("Sign in to like recipes");
      navigate("/auth");
      return;
    }

    const liked = likedIds.has(recipeId);
    if (liked) {
      await supabase.from("recipe_likes").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
      setLikedIds((prev) => { const next = new Set(prev); next.delete(recipeId); return next; });
      setRecipes((prev) => prev.map((r) => r.id === recipeId ? { ...r, likes_count: r.likes_count - 1 } : r));
    } else {
      await supabase.from("recipe_likes").insert({ user_id: user.id, recipe_id: recipeId });
      setLikedIds((prev) => new Set(prev).add(recipeId));
      setRecipes((prev) => prev.map((r) => r.id === recipeId ? { ...r, likes_count: r.likes_count + 1 } : r));
    }
  };

  const tierEmoji: Record<string, string> = { lion: "🦁", strict: "🥩", animal_based: "🍳" };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Community</h1>
        {user && (
          <button
            onClick={() => navigate("/create-recipe?share=true")}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-3">
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
              <p className="text-[11px] text-muted-foreground">Sign in to share recipes, like, and connect</p>
            </div>
            <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
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
        </div>

        {/* Recipes */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No community recipes yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Be the first to share one!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recipes.map((r) => (
              <div key={r.id} className="ios-card p-4">
                {/* Author */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {(r.profile?.display_name || "?")[0].toUpperCase()}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {r.profile?.display_name || "Anonymous"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="font-display font-bold text-foreground text-[15px] leading-tight">{r.name}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock size={11} /> {r.time}</span>
                  <span className="flex items-center gap-1"><Flame size={11} /> {r.cal} cal</span>
                  {r.serving && <span className="text-[11px]">· {r.serving}</span>}
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex gap-1">
                    {r.diet_tiers.map((t) => (
                      <span key={t} className="text-[10px]">{tierEmoji[t] || t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-primary">{r.protein} P</span>
                    <span className="text-[11px] text-muted-foreground">{r.fat} F</span>
                  </div>
                </div>

                {r.description && (
                  <p className="text-xs text-secondary-foreground/70 mt-2 leading-relaxed line-clamp-2">{r.description}</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/30">
                  <div className="flex gap-1.5 flex-wrap">
                    {r.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{t}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => toggleLike(r.id)}
                    className="flex items-center gap-1 text-xs transition-colors"
                  >
                    <Heart
                      size={14}
                      className={likedIds.has(r.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}
                    />
                    <span className={likedIds.has(r.id) ? "text-destructive font-semibold" : "text-muted-foreground"}>
                      {r.likes_count}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Community;
