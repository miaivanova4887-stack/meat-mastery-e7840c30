import { ArrowLeft, Heart, ChefHat, Settings, LogOut, Loader2, Clock, Flame, Pencil, Check, X, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Profile {
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  diet_tier: string | null;
}

interface CommunityRecipe {
  id: string;
  name: string;
  time: string;
  cal: string;
  protein: string;
  fat: string;
  likes_count: number;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myRecipes, setMyRecipes] = useState<CommunityRecipe[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<CommunityRecipe[]>([]);
  const [tab, setTab] = useState<"recipes" | "likes" | "settings">("recipes");
  const [loading, setLoading] = useState(true);

  // Settings editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ display_name: "", bio: "", diet_tier: "" });

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setProfile(data);
      setEditValues({
        display_name: data.display_name || "",
        bio: data.bio || "",
        diet_tier: data.diet_tier || "strict",
      });
    }
  }, [user]);

  const fetchMyRecipes = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("community_recipes")
      .select("id, name, time, cal, protein, fat, likes_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setMyRecipes(data);
  }, [user]);

  const fetchLikedRecipes = useCallback(async () => {
    if (!user) return;
    const { data: likes } = await (supabase as any)
      .from("recipe_likes")
      .select("recipe_id")
      .eq("user_id", user.id);
    if (!likes || likes.length === 0) { setLikedRecipes([]); return; }
    const ids = likes.map((l: any) => l.recipe_id);
    const { data } = await (supabase as any)
      .from("community_recipes")
      .select("id, name, time, cal, protein, fat, likes_count, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (data) setLikedRecipes(data);
  }, [user]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    Promise.all([fetchProfile(), fetchMyRecipes(), fetchLikedRecipes()]).finally(() => setLoading(false));
  }, [user, navigate, fetchProfile, fetchMyRecipes, fetchLikedRecipes]);

  const saveField = async (field: string) => {
    if (!user) return;
    const value = editValues[field as keyof typeof editValues];
    const { error } = await (supabase as any).from("profiles").update({ [field]: value }).eq("id", user.id);
    if (error) { toast.error("Failed to save"); return; }
    setProfile((prev) => prev ? { ...prev, [field]: value } : prev);
    setEditingField(null);
    toast.success("Updated!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
    toast.success("Signed out");
  };

  const tierLabels: Record<string, string> = { strict: "🥩 Strict Carnivore", lion: "🦁 Lion Diet", animal_based: "🍳 Animal-Based" };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const RecipeCard = ({ r }: { r: CommunityRecipe }) => (
    <div className="ios-card p-4">
      <h3 className="font-display font-bold text-foreground text-[15px] leading-tight">{r.name}</h3>
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock size={11} /> {r.time}</span>
        <span className="flex items-center gap-1"><Flame size={11} /> {r.cal} cal</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-primary">{r.protein} P</span>
          <span className="text-[11px] text-muted-foreground">{r.fat} F</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Heart size={12} />
          <span>{r.likes_count}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 ios-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">Profile</h1>
      </div>

      {/* Profile header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {(profile?.display_name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-foreground text-lg truncate">
              {profile?.display_name || "Carnivore"}
            </h2>
            {profile?.bio && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{profile.bio}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] text-muted-foreground">
                <strong className="text-foreground">{myRecipes.length}</strong> recipes
              </span>
              <span className="text-[11px] text-muted-foreground">
                <strong className="text-foreground">{likedRecipes.length}</strong> likes
              </span>
              {profile?.diet_tier && (
                <span className="text-[11px] text-muted-foreground">
                  {tierLabels[profile.diet_tier] || profile.diet_tier}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-3">
        {([
          { key: "recipes", label: "My Recipes", icon: ChefHat },
          { key: "likes", label: "Liked", icon: Heart },
          { key: "settings", label: "Settings", icon: Settings },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              tab === key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {/* My Recipes */}
        {tab === "recipes" && (
          myRecipes.length === 0 ? (
            <div className="text-center py-12">
              <ChefHat size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No shared recipes yet</p>
              <button
                onClick={() => navigate("/create-recipe?share=true")}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
              >
                Share Your First Recipe
              </button>
            </div>
          ) : myRecipes.map((r) => <RecipeCard key={r.id} r={r} />)
        )}

        {/* Liked Recipes */}
        {tab === "likes" && (
          likedRecipes.length === 0 ? (
            <div className="text-center py-12">
              <Heart size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No liked recipes yet</p>
              <button
                onClick={() => navigate("/community")}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
              >
                Browse Community
              </button>
            </div>
          ) : likedRecipes.map((r) => <RecipeCard key={r.id} r={r} />)
        )}

        {/* Settings */}
        {tab === "settings" && (
          <div className="space-y-3">
            {/* Display Name */}
            <div className="ios-card p-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display Name</label>
                {editingField === "display_name" ? (
                  <div className="flex gap-1">
                    <button onClick={() => saveField("display_name")} className="text-primary"><Check size={14} /></button>
                    <button onClick={() => setEditingField(null)} className="text-muted-foreground"><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditingField("display_name")} className="text-muted-foreground"><Pencil size={14} /></button>
                )}
              </div>
              {editingField === "display_name" ? (
                <input
                  value={editValues.display_name}
                  onChange={(e) => setEditValues((v) => ({ ...v, display_name: e.target.value }))}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  maxLength={50}
                  autoFocus
                />
              ) : (
                <p className="text-sm text-foreground">{profile?.display_name || "—"}</p>
              )}
            </div>

            {/* Bio */}
            <div className="ios-card p-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bio</label>
                {editingField === "bio" ? (
                  <div className="flex gap-1">
                    <button onClick={() => saveField("bio")} className="text-primary"><Check size={14} /></button>
                    <button onClick={() => setEditingField(null)} className="text-muted-foreground"><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setEditingField("bio")} className="text-muted-foreground"><Pencil size={14} /></button>
                )}
              </div>
              {editingField === "bio" ? (
                <textarea
                  value={editValues.bio}
                  onChange={(e) => setEditValues((v) => ({ ...v, bio: e.target.value }))}
                  className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                  maxLength={200}
                  rows={3}
                  autoFocus
                />
              ) : (
                <p className="text-sm text-foreground">{profile?.bio || "—"}</p>
              )}
            </div>

            {/* Diet Tier */}
            <div className="ios-card p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Diet Tier</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(tierLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={async () => {
                      setEditValues((v) => ({ ...v, diet_tier: key }));
                      await (supabase as any).from("profiles").update({ diet_tier: key }).eq("id", user!.id);
                      setProfile((p) => p ? { ...p, diet_tier: key } : p);
                      toast.success("Diet tier updated!");
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      (profile?.diet_tier || "strict") === key
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Meals Per Day */}
            <div className="ios-card p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                <UtensilsCrossed size={11} className="inline mr-1" />
                Meals Per Day
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => {
                  const current = parseInt(localStorage.getItem("carnivore-meals-per-day") || "3") || 3;
                  const labels: Record<number, string> = { 1: "1 meal", 2: "2 meals", 3: "3 meals", 4: "4 meals" };
                  const descs: Record<number, string> = { 1: "OMAD", 2: "Lunch + Dinner", 3: "Breakfast, Lunch, Dinner", 4: "3 meals + Snack" };
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        localStorage.setItem("carnivore-meals-per-day", String(n));
                        window.dispatchEvent(new Event("storage"));
                        toast.success(`Updated to ${n} meals/day`);
                      }}
                      className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        current === n ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <span>{labels[n]}</span>
                      <span className={`text-[9px] font-normal ${current === n ? "text-background/70" : "text-muted-foreground/70"}`}>{descs[n]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="ios-card p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email</label>
              <p className="text-sm text-foreground">{user?.email}</p>
            </div>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full ios-card p-4 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut size={18} />
              <span className="text-sm font-semibold">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
