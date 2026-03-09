import { ArrowLeft, Heart, ChefHat, Settings, LogOut, Loader2, Clock, Flame, Pencil, Check, X as XIcon, UtensilsCrossed, ChevronRight, ChevronDown, BookOpen, Zap, Newspaper, ThumbsUp, ThumbsDown } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { recipes } from "@/data/recipes";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myRecipes, setMyRecipes] = useState<CommunityRecipe[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<CommunityRecipe[]>([]);
  const [tab, setTab] = useState<"feed" | "recipes" | "likes" | "settings">("feed");
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const favoriteRecipes = useMemo(() => recipes.filter(r => favorites.has(r.name)), [favorites]);
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "yes" | "no">>(() => {
    try {
      const stored = localStorage.getItem("carnivore-feed-feedback");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });

  const handleFeedback = (itemId: string, value: "yes" | "no") => {
    setFeedbackMap((prev) => {
      const next = { ...prev, [itemId]: value };
      localStorage.setItem("carnivore-feed-feedback", JSON.stringify(next));
      return next;
    });
    toast.success(value === "yes" ? "We'll show more like this!" : "Noted — we'll adjust your feed");
  };

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const stored = localStorage.getItem("carnivore-notif-prefs");
      return stored ? JSON.parse(stored) : {
        enabled: true,
        dailyReminder: true,
        reminderTime: "19:00",
        streakReminder: true,
        weeklySummary: true,
        scienceNews: true,
        motivationNews: true,
        caseStudyNews: false,
        tipNews: true,
      };
    } catch { return { enabled: true, dailyReminder: true, reminderTime: "19:00", streakReminder: true, weeklySummary: true, scienceNews: true, motivationNews: true, caseStudyNews: false, tipNews: true }; }
  });

  const updateNotifPref = (key: string, value: boolean | string) => {
    setNotifPrefs((prev: any) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("carnivore-notif-prefs", JSON.stringify(next));
      window.dispatchEvent(new Event("profile-update"));
      return next;
    });
    toast.success("Notification preference updated");
  };
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
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">{t("profile.title")}</h1>
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
                <strong className="text-foreground">{likedRecipes.length + favoriteRecipes.length}</strong> likes
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
          { key: "feed", label: t("profile.yourFeed"), icon: Newspaper },
          { key: "recipes", label: t("profile.myRecipes"), icon: ChefHat },
          { key: "likes", label: t("profile.liked"), icon: Heart },
          { key: "settings", label: t("profile.settings"), icon: Settings },
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
          (likedRecipes.length === 0 && favoriteRecipes.length === 0) ? (
            <div className="text-center py-12">
              <Heart size={32} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No liked recipes yet</p>
              <p className="text-xs text-muted-foreground mt-1">Tap the ♥ on any recipe to save it here</p>
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => navigate("/recipes")}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Browse Recipes
                </button>
                <button
                  onClick={() => navigate("/community")}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
                >
                  Community
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Local favorites */}
              {favoriteRecipes.length > 0 && (
                <>
                  {favoriteRecipes.map((r) => (
                    <div key={r.name} className="ios-card p-3.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Clock size={11} /> {r.time}</span>
                          <span className="flex items-center gap-0.5"><Flame size={11} /> {r.cal} cal</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleFavorite(r.name)}
                        className="p-1.5 rounded-lg active:scale-90 transition-all"
                      >
                        <Heart size={16} className="fill-destructive text-destructive" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {/* Community liked recipes */}
              {likedRecipes.map((r) => <RecipeCard key={r.id} r={r} />)}
            </div>
          )
        )}

        {/* Your Feed */}
        {tab === "feed" && (() => {
                const newsItems = [
                { id: "1", title: "Red Meat and Heart Health: New Meta-Analysis Challenges Old Assumptions", summary: "A 2025 meta-analysis of 14 studies found no significant link between unprocessed red meat consumption and cardiovascular disease risk.", body: "The comprehensive meta-analysis reviewed data from over 1.2 million participants across 14 prospective cohort studies. Researchers found that consuming up to 100g of unprocessed red meat daily showed no statistically significant association with cardiovascular disease, stroke, or all-cause mortality.\n\nThis challenges decades of dietary advice that broadly categorized all red meat as harmful. The key distinction appears to be between processed and unprocessed meats.\n\nDr. Sarah Mitchell, lead author, noted: \"Our findings suggest that the relationship between red meat and heart health is far more nuanced than previous guidelines indicated.\"", category: "scienceNews", catLabel: "Science", catIcon: BookOpen, catColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400", feedbackQ: "Did you find this research interesting?", date: "2026-03-08" },
                { id: "2", title: "From Chronic Fatigue to Competitive Athlete: Mark's 18-Month Journey", summary: "After years of battling autoimmune symptoms, Mark adopted a strict carnivore diet and documented his transformation to completing his first marathon.", body: "Mark Reynolds, 34, spent five years battling Hashimoto's thyroiditis, chronic fatigue, and debilitating brain fog. After conventional treatments provided limited relief, he decided to try strict carnivore.\n\n\"The first two weeks were rough,\" Mark recalls. \"But by week three, the fog started lifting. By month two, I had energy I hadn't felt since my twenties.\"\n\nOver 18 months, Mark lost 45 pounds, saw his thyroid antibodies drop by 60%, and went from barely walking a mile to completing the Chicago Marathon.", category: "caseStudyNews", catLabel: "Case Study", catIcon: Heart, catColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", feedbackQ: "Would you like to see more stories like this?", date: "2026-03-07" },
                { id: "3", title: "The Power of Organ Meats: Why Liver is Nature's Multivitamin", summary: "Gram for gram, beef liver contains more bioavailable nutrients than any plant food. Here's how to incorporate it weekly.", body: "A single 100g serving of beef liver provides 1,049% of your daily Vitamin B12, 860% of Vitamin A, and 338% of riboflavin.\n\nIf you can't stand the taste, try these strategies:\n\n1. Frozen liver pills — Cut raw liver into pea-sized pieces, freeze, then swallow like supplements.\n2. Blend into ground beef — Mix 20% liver with 80% ground beef for burgers.\n3. Pâté — A classic preparation with butter and herbs.\n4. Desiccated liver capsules — High-quality supplements provide many of the same benefits.", category: "tipNews", catLabel: "Tip", catIcon: Zap, catColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400", feedbackQ: "Have you tried this? Would you like more tips like it?", date: "2026-03-07" },
                { id: "4", title: "You Are Stronger Than You Think: Embrace the Journey", summary: "Every day on the carnivore diet is a step toward reclaiming your health. The cravings fade, the energy rises, and the results speak for themselves.", body: "The carnivore journey isn't always easy — but nothing worthwhile ever is.\n\nIn the first weeks, your body is adapting. You might feel tired, irritable, or miss your old comfort foods. This is normal.\n\nBut here's what happens on the other side: mental clarity that feels like a superpower, steady energy without crashes, deeper sleep, reduced inflammation, and a sense of control over your health.\n\nEvery person who has succeeded on this path once stood exactly where you are now. They kept going. You can too.", category: "motivationNews", catLabel: "Motivation", catIcon: Zap, catColor: "bg-primary/10 text-primary", feedbackQ: "Was this helpful for your journey?", date: "2026-03-06" },
                { id: "5", title: "Carnivore Diet and Gut Microbiome: Latest Research", summary: "Emerging research suggests bile-tolerant bacteria thrive on carnivore, potentially reducing systemic inflammation.", body: "A new study examined the intestinal flora of 200 long-term carnivore dieters compared to matched omnivore controls.\n\nKey findings: overall microbial diversity decreased, but bile-tolerant species like Bilophila and Alistipes increased significantly. These species are associated with improved bile acid metabolism and reduced intestinal permeability.\n\nMarkers of systemic inflammation (CRP, IL-6) were 23% lower in the carnivore group.", category: "scienceNews", catLabel: "Science", catIcon: BookOpen, catColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400", feedbackQ: "Want to see more on gut health research?", date: "2026-03-06" },
                { id: "6", title: "Budget Carnivore: Feed a Family of Four for Under $100/Week", summary: "Ground beef, eggs, and strategic bulk buying can make the carnivore diet surprisingly affordable.", body: "Weekly Shopping List:\n• 10 lbs ground beef — ~$35\n• 5 dozen eggs — ~$15\n• 2 lbs butter — ~$8\n• 4 lbs chicken thighs — ~$10\n• 2 lbs beef liver — ~$5\n• Salt, tallow — ~$5\n• Bone broth ingredients — ~$3\n\nTotal: ~$81. Buy in bulk, shop at warehouse clubs, and ask your butcher for organ meats and bones.", category: "tipNews", catLabel: "Tip", catIcon: Zap, catColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400", feedbackQ: "Is budget eating something you'd like more tips on?", date: "2026-03-05" },
              ];
              const filtered = newsItems.filter((n) => notifPrefs[n.category]);
              if (filtered.length === 0) return (
                <div className="text-center py-10 text-muted-foreground">
                  <Newspaper size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Enable categories in Settings → News Preferences</p>
                </div>
              );
              const formatDate = (ds: string) => {
                const diff = Math.floor((Date.now() - new Date(ds).getTime()) / 86400000);
                if (diff === 0) return "Today";
                if (diff === 1) return "Yesterday";
                if (diff < 7) return `${diff}d ago`;
                return new Date(ds).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              };
              return (
                <div className="space-y-3">
                  {filtered.map((item) => {
                    const CatIcon = item.catIcon;
                    const isExpanded = expandedNewsId === item.id;
                    return (
                      <article
                        key={item.id}
                        onClick={() => setExpandedNewsId(isExpanded ? null : item.id)}
                        className="ios-card p-4 space-y-2 cursor-pointer active:scale-[0.99] transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${item.catColor}`}>
                            <CatIcon size={10} />
                            {item.catLabel}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{formatDate(item.date)}</span>
                            <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
                        {!isExpanded && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.summary}</p>
                        )}
                        {isExpanded && (
                          <div className="animate-fade-in-up">
                            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{item.summary}</p>
                            <div className="border-t border-border/40 pt-3 space-y-2">
                              {item.body.split("\n\n").map((paragraph, i) => (
                                <p key={i} className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">{paragraph}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {isExpanded && (
                          <div className="border-t border-border/40 pt-3 mt-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[11px] text-muted-foreground mb-2">{item.feedbackQ}</p>
                            {feedbackMap[item.id] ? (
                              <span className="text-[11px] text-primary font-medium">
                                {feedbackMap[item.id] === "yes" ? "👍 Thanks! We'll show more like this." : "👌 Got it — we'll adjust."}
                              </span>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleFeedback(item.id, "yes")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold transition-all active:scale-95"
                                >
                                  <ThumbsUp size={12} />
                                  Yes
                                </button>
                                <button
                                  onClick={() => handleFeedback(item.id, "no")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-semibold transition-all active:scale-95"
                                >
                                  <ThumbsDown size={12} />
                                  Not really
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              );
            })()}

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
                    <button onClick={() => setEditingField(null)} className="text-muted-foreground"><XIcon size={14} /></button>
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
                    <button onClick={() => setEditingField(null)} className="text-muted-foreground"><XIcon size={14} /></button>
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
                        window.dispatchEvent(new Event("profile-update"));
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

            {/* Alerts / Notification Settings */}
            <h2 className="text-lg font-display font-bold text-foreground pt-3">Alerts</h2>

            {/* Enable Notifications */}
            <div className="ios-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <h3 className="font-display font-bold text-foreground text-[15px]">Enable Notifications</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow Vore to send you helpful reminders</p>
                </div>
                <Switch checked={notifPrefs.enabled} onCheckedChange={(v) => updateNotifPref("enabled", v)} />
              </div>
            </div>

            <div className={`space-y-3 transition-opacity ${!notifPrefs.enabled ? "opacity-50 pointer-events-none" : ""}`}>
              {/* Daily Reminder */}
              <div className="ios-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <h3 className="font-display font-bold text-foreground text-[15px]">Daily Reminder</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Get reminded to log your meals every day</p>
                  </div>
                  <Switch checked={notifPrefs.dailyReminder} onCheckedChange={(v) => updateNotifPref("dailyReminder", v)} />
                </div>
                {notifPrefs.dailyReminder && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                    <span className="text-sm text-muted-foreground">Reminder Time</span>
                    <input
                      type="time"
                      value={notifPrefs.reminderTime}
                      onChange={(e) => updateNotifPref("reminderTime", e.target.value)}
                      className="bg-transparent text-primary text-sm font-semibold focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Streak Reminders */}
              <div className="ios-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <h3 className="font-display font-bold text-foreground text-[15px]">Streak Reminders</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Get notified at 8 PM if your streak is at risk</p>
                  </div>
                  <Switch checked={notifPrefs.streakReminder} onCheckedChange={(v) => updateNotifPref("streakReminder", v)} />
                </div>
              </div>

              {/* Weekly Progress Summary */}
              <div className="ios-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <h3 className="font-display font-bold text-foreground text-[15px]">Weekly Progress Summary</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Receive your weekly stats every Monday morning</p>
                  </div>
                  <Switch checked={notifPrefs.weeklySummary} onCheckedChange={(v) => updateNotifPref("weeklySummary", v)} />
                </div>
              </div>

              {/* News Preferences */}
              <h3 className="text-sm font-display font-bold text-foreground pt-2">News Feed Preferences</h3>
              <div className="ios-card p-4 space-y-4">
                {[
                  { key: "scienceNews", label: "🔬 Science & Research", desc: "Latest carnivore diet studies and findings" },
                  { key: "motivationNews", label: "⚡ Motivation", desc: "Daily inspiration and success mindset" },
                  { key: "caseStudyNews", label: "❤️ Case Studies", desc: "Real transformation stories" },
                  { key: "tipNews", label: "💡 Tips & Tricks", desc: "Practical advice for your journey" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <h3 className="font-display font-bold text-foreground text-[14px]">{label}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <Switch checked={notifPrefs[key]} onCheckedChange={(v) => updateNotifPref(key, v)} />
                  </div>
                ))}
              </div>
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
