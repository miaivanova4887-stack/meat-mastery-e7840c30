import { ArrowLeft, Heart, Settings, LogOut, Loader2, Clock, Flame, Pencil, Check, X as XIcon, UtensilsCrossed, ChevronRight, ChevronDown, BookOpen, Zap, Newspaper, ThumbsUp, ThumbsDown, Trophy, TrendingUp, Target, Activity, Share2, Mail, Copy, MessageCircle, Users, Bell, BarChart3, Globe, Crosshair, Crown } from "lucide-react";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import ConsentBanner from "@/components/ConsentBanner";
import CommunityFeed from "@/components/CommunityFeed";
import { useFavorites } from "@/hooks/useFavorites";
import { recipes } from "@/data/recipes";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { METRICS, CATEGORY_META, type ProgressCategory } from "@/hooks/useProgress";
import { useUserProfile, type Goal, type Experience, type ActivityLevel, type Struggle, type Interest, type Sex } from "@/contexts/UserProfileContext";
import NotificationConsentSheet from "@/components/NotificationConsentSheet";
import { CoachingReminderSettings } from "@/components/CoachingReminderSettings";
import DeleteAccountSection from "@/components/DeleteAccountSection";
// Push consent fallback now lives in PushConsentFallbackHost (App-level shell).

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

function SubscriptionBadge() {
  const { tier, subscriptionEnd } = useSubscription();
  const navigate = useNavigate();

  const tierConfig = {
    free: { label: "Free Plan", color: "bg-secondary text-muted-foreground", icon: Zap },
    pro: { label: "Pro Plan", color: "bg-primary/15 text-primary", icon: Zap },
    elite: { label: "Elite Plan", color: "bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))]", icon: Crown },
  };

  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <div className="px-4 pb-2">
      <button
        onClick={() => navigate("/pricing")}
        className="w-full ios-card p-3 flex items-center gap-3 hover:bg-secondary/60 transition-colors"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-foreground">{config.label}</p>
          {subscriptionEnd && (
            <p className="text-[10px] text-muted-foreground">
              Renews {new Date(subscriptionEnd).toLocaleDateString()}
            </p>
          )}
        </div>
        <ChevronRight size={14} className="text-muted-foreground" />
      </button>
    </div>
  );
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  // Local UI-only shadow of the profile row — reads initialize from the
  // React Query cache so the first paint is instant on revisits; writes
  // stay optimistic via saveField + query invalidation.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPushConsent, setShowPushConsent] = useState(false);
  const [tab, setTab] = useState<"feed" | "goals" | "community" | "settings">("feed");
  const userProfile = useUserProfile();
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
    toast.success(value === "yes" ? t("profile.feedbackYes") : t("profile.feedbackNo"));
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

  // Mirror these UI keys → server-side notification_preferences JSONB keys
  // that the push-reconcile / push-scheduler edge functions read.
  const SERVER_PREF_KEYS: Record<string, string> = {
    dailyReminder: "daily_meal_reminder",
    streakReminder: "streak_reminder",
    weeklySummary: "weekly_summary",
    reminderTime: "reminder_time",
  };

  const updateNotifPref = (key: string, value: boolean | string) => {
    setNotifPrefs((prev: any) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("carnivore-notif-prefs", JSON.stringify(next));
      window.dispatchEvent(new Event("profile-update"));
      return next;
    });
    toast.success(t("profile.notifPrefUpdated"));

    // Persist scheduled-push-relevant keys to profiles.notification_preferences.
    const serverKey = SERVER_PREF_KEYS[key];
    if (serverKey && user) {
      (async () => {
        try {
          const { data: row } = await supabase
            .from("profiles")
            .select("notification_preferences")
            .eq("id", user.id)
            .maybeSingle();
          const merged = {
            ...((row?.notification_preferences as Record<string, unknown>) || {}),
            [serverKey]: value,
          };
          await supabase
            .from("profiles")
            .update({ notification_preferences: merged as any })
            .eq("id", user.id);
        } catch (e) {
          console.warn("[Profile] notification_preferences sync failed", e);
        }
      })();
    }
  };
  const [loading, setLoading] = useState(true);

  // Settings editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ display_name: "", bio: "", diet_tier: "" });

  const toLocalDayKey = useCallback((value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const getLocalDayDiff = useCallback((value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const targetStart = new Date(d);
    targetStart.setHours(0, 0, 0, 0);
    return Math.floor((todayStart.getTime() - targetStart.getTime()) / 86400000);
  }, []);

  // ---- React Query data layer --------------------------------------------
  //
  // Each fetch below is cached for 2 minutes (staleTime). On revisit, the
  // page paints immediately from cache and a silent refetch updates in the
  // background. Mutations (saveField, diet tier change, etc.) invalidate
  // the relevant key.
  //
  // Note: the original implementation used setState + useEffect + Promise.all
  // which forced every swipe-to-Profile to block on a network waterfall.

  const STALE_MS = 2 * 60 * 1000;

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    staleTime: STALE_MS,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("profiles").select("*").eq("id", user.id).single();
      return (data as Profile) || null;
    },
  });

  // Mirror the query result into local state so existing optimistic update
  // code paths (saveField, diet-tier change) keep working unchanged.
  useEffect(() => {
    if (profileQuery.data) {
      setProfile(profileQuery.data);
      setEditValues({
        display_name: profileQuery.data.display_name || "",
        bio: profileQuery.data.bio || "",
        diet_tier: profileQuery.data.diet_tier || "strict",
      });
    }
  }, [profileQuery.data]);

  const myRecipesQuery = useQuery({
    queryKey: ["my-community-recipes", user?.id],
    enabled: !!user,
    staleTime: STALE_MS,
    queryFn: async () => {
      if (!user) return [] as CommunityRecipe[];
      const { data } = await (supabase as any)
        .from("community_recipes")
        .select("id, name, time, cal, protein, fat, likes_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return (data as CommunityRecipe[]) || [];
    },
  });
  const myRecipes = myRecipesQuery.data ?? [];

  const myPostsQuery = useQuery({
    queryKey: ["my-community-posts", user?.id],
    enabled: !!user,
    staleTime: STALE_MS,
    queryFn: async () => {
      if (!user) return [] as { id: string }[];
      const { data } = await (supabase as any)
        .from("community_posts")
        .select("id")
        .eq("user_id", user.id);
      return (data as { id: string }[]) || [];
    },
  });
  const myPosts = myPostsQuery.data ?? [];

  const likedRecipesQuery = useQuery({
    queryKey: ["liked-community-recipes", user?.id],
    enabled: !!user,
    staleTime: STALE_MS,
    queryFn: async () => {
      if (!user) return [] as CommunityRecipe[];
      const { data: likes } = await (supabase as any)
        .from("recipe_likes").select("recipe_id").eq("user_id", user.id);
      if (!likes || likes.length === 0) return [] as CommunityRecipe[];
      const ids = likes.map((l: any) => l.recipe_id);
      const { data } = await (supabase as any)
        .from("community_recipes")
        .select("id, name, time, cal, protein, fat, likes_count, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return (data as CommunityRecipe[]) || [];
    },
  });
  const likedRecipes = likedRecipesQuery.data ?? [];

  const isAdminQuery = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // admin role rarely changes
    queryFn: async () => {
      if (!user) return false;
      const { data } = await (supabase as any)
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });
  useEffect(() => { setIsAdmin(!!isAdminQuery.data); }, [isAdminQuery.data]);

  // Progress-milestones derivation runs inside the queryFn rather than at
  // render time — keeps the render cheap and lets React Query cache the
  // computed milestones alongside the raw fetches.
  const milestonesQuery = useQuery({
    queryKey: ["progress-milestones", user?.id],
    enabled: !!user,
    staleTime: STALE_MS,
    queryFn: async () => {
    // Get recent entries (last 30 days) and goals
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data: entries }, { data: goals }] = await Promise.all([
      supabase.from("progress_entries").select("*").eq("user_id", user.id).gte("recorded_at", since).order("recorded_at", { ascending: false }).limit(100),
      supabase.from("progress_goals").select("*").eq("user_id", user.id),
    ]);

    const nowTs = Date.now();
    const validEntries = (entries || []).filter((e: any) => {
      const ts = new Date(e.recorded_at).getTime();
      const note = (e.notes || "").trim().toLowerCase();
      return Number.isFinite(ts) && ts <= nowTs && note !== "sample";
    });

    const milestones: any[] = [];

    if (validEntries.length > 0) {
      // Group entries by metric to detect streaks and records
      const byMetric: Record<string, any[]> = {};
      validEntries.forEach((e: any) => {
        if (!byMetric[e.metric]) byMetric[e.metric] = [];
        byMetric[e.metric].push(e);
      });

      // Check for goal achievements
      if (goals && goals.length > 0) {
        goals.forEach((goal: any) => {
          const metricEntries = byMetric[goal.metric] || [];
          const latest = metricEntries[0];
          if (latest && latest.value >= goal.target_value) {
            // Only show goal_reached if the entry is within the last 24 hours
            const entryAge = Date.now() - new Date(latest.recorded_at).getTime();
            if (entryAge > 24 * 60 * 60 * 1000) return;
            const metricInfo = Object.values(METRICS).flat().find(m => m.key === goal.metric);
            milestones.push({
              id: `goal-${goal.metric}`,
              type: "goal_reached",
              icon: "🎯",
              title: `Goal Reached: ${metricInfo?.label || goal.metric}`,
              desc: `You hit your target of ${goal.target_value}${goal.unit}! Current: ${latest.value}${latest.unit}`,
              date: latest.recorded_at,
              color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            });
          }
        });
      }

      // Personal records (highest value for key metrics)
      const prMetrics = ["weight", "calories", "protein"];
      prMetrics.forEach((key) => {
        const metricEntries = byMetric[key];
        if (!metricEntries || metricEntries.length < 2) return;
        const metricInfo = Object.values(METRICS).flat().find(m => m.key === key);
        const latest = metricEntries[0];
        const prev = metricEntries.slice(1);
        const isHighest = key !== "weight"
          ? !prev.some((e: any) => e.value >= latest.value)
          : !prev.some((e: any) => e.value <= latest.value); // For weight, lower is a record
        if (isHighest) {
          milestones.push({
            id: `pr-${key}`,
            type: "personal_record",
            icon: "🏆",
            title: `New ${key === "weight" ? "Low" : "High"}: ${metricInfo?.label || key}`,
            desc: `${latest.value}${latest.unit} — your best in the last 30 days!`,
            date: latest.recorded_at,
            color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          });
        }
      });

      // Logging streak — count unique days logged
      const uniqueDays = new Set(validEntries.map((e: any) => toLocalDayKey(e.recorded_at)).filter(Boolean));
      if (uniqueDays.size >= 7) {
        milestones.push({
          id: "streak-7",
          type: "streak",
          icon: "🔥",
          title: `${uniqueDays.size}-Day Logging Streak`,
          desc: `You've tracked your progress on ${uniqueDays.size} days this month. Keep it up!`,
          date: validEntries[0].recorded_at,
          color: "bg-primary/10 text-primary",
        });
      }

      // Total entries milestone
      if (validEntries.length >= 10) {
        milestones.push({
          id: "entries-count",
          type: "volume",
          icon: "📊",
          title: `${validEntries.length} Entries This Month`,
          desc: "You're building a strong data foundation for your health journey.",
          date: validEntries[0].recorded_at,
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        });
      }
    }

      return milestones;
    },
  });
  const progressMilestones = milestonesQuery.data ?? [];

  // Redirect unauthenticated users. The queries above are gated on `user`
  // so they won’t actually fire before this redirect runs.
  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  // Only show the big splash loader on the first-ever load when we truly
  // have nothing to paint. On revisits, cached data is already present so
  // we render instantly and any background refetch is invisible.
  useEffect(() => {
    if (!user) return;
    if (profileQuery.data !== undefined) setLoading(false);
  }, [user, profileQuery.data]);

  const saveField = async (field: string) => {
    if (!user) return;
    const value = editValues[field as keyof typeof editValues];
    const { error } = await (supabase as any).from("profiles").update({ [field]: value }).eq("id", user.id);
    if (error) { toast.error("Failed to save"); return; }
    setProfile((prev) => prev ? { ...prev, [field]: value } : prev);
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
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
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      <NotificationConsentSheet
        open={showPushConsent}
        onClose={() => setShowPushConsent(false)}
      />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 dark:border-transparent shadow-xs px-4 pb-3 flex items-center gap-3 page-header" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-display font-bold tracking-tight">{t("profile.title")}</h1>
      </div>

      <ConsentBanner />

      {/* Profile header */}
      <div className="mx-auto w-full max-w-3xl lg:max-w-5xl px-4 pt-5 pb-3">
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
                <strong className="text-foreground">{myRecipes.length}</strong> {t("profile.recipes")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                <strong className="text-foreground">{myPosts.length}</strong> {t("profile.posts", "posts")}
              </span>
              <span className="text-[11px] text-muted-foreground">
                <strong className="text-foreground">{likedRecipes.length + favoriteRecipes.length}</strong> {t("profile.likes")}
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

      {/* Subscription badge */}
      <SubscriptionBadge />

      {/* Tabs */}
      {/*
       * Horizontally-scrollable pill row. The four tabs (Feed / My Goals /
       * Community / Settings) used to sit in a plain flex row and pushed
       * off the right edge of narrow iPhones (≤ 375pt) when translations
       * expanded. `overflow-x-auto` + `shrink-0` pills keeps every pill at
       * its natural, readable size — and matching the rest of the app we
       * hide the scrollbar so it reads as a single swipeable strip.
       */}
      <div
        className="px-4 flex gap-2 mb-3 overflow-x-auto -mx-0 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {([
          { key: "feed", label: t("profile.yourFeed"), icon: Newspaper },
          { key: "goals", label: "My Goals", icon: Crosshair },
          { key: "community", label: "Community", icon: Users },
          { key: "settings", label: t("profile.settings"), icon: Settings },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`shrink-0 snap-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              tab === key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {/* Community */}
        {tab === "community" && <CommunityFeed />}

        {/* My Goals — editable onboarding data */}
        {tab === "goals" && (() => {
          const goalLabels: Record<Goal, string> = { lose_weight: "Lose Weight", build_muscle: "Build Muscle", maintain: "Maintain", improve_health: "Improve Health" };
          const expLabels: Record<Experience, string> = { beginner: "Beginner", tried_briefly: "Tried Briefly", months_in: "Months In", veteran: "Veteran" };
          const actLabels: Record<ActivityLevel, string> = { sedentary: "Sedentary", light: "Light", moderate: "Moderate", very_active: "Very Active" };
          const strugLabels: Record<Struggle, string> = { sugar_cravings: "Sugar Cravings", low_energy: "Low Energy", digestive: "Digestive Issues", social_pressure: "Social Pressure", recipe_ideas: "Need Recipe Ideas", discipline: "Discipline" };
          const interestLabels: Record<Interest, string> = { recipes: "Recipes", exercise: "Exercise", ketosis: "Ketosis", mental_clarity: "Mental Clarity", progress_tracking: "Progress Tracking", motivation: "Motivation" };
          const sexLabels: Record<Sex, string> = { male: "Male", female: "Female", unspecified: "Not Set" };

          const saveOnboarding = (key: string, value: any) => {
            localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
            window.dispatchEvent(new Event("profile-update"));
            toast.success("Updated!");
          };

          const updateAnswer = (index: number, value: any) => {
            try {
              const raw = localStorage.getItem("carnivore-onboarding-answers");
              const answers = raw ? JSON.parse(raw) : [0, 0, [], 1, []];
              answers[index] = value;
              saveOnboarding("carnivore-onboarding-answers", answers);
            } catch { /* ignore */ }
          };

          const updateBody = (field: string, value: any) => {
            try {
              const raw = localStorage.getItem("carnivore-onboarding-body");
              const body = raw ? JSON.parse(raw) : {};
              body[field] = value;
              saveOnboarding("carnivore-onboarding-body", body);
            } catch { /* ignore */ }
          };

          const GOAL_MAP: Goal[] = ["lose_weight", "build_muscle", "maintain", "improve_health"];
          const EXP_MAP: Experience[] = ["beginner", "tried_briefly", "months_in", "veteran"];
          const ACTIVITY_MAP: ActivityLevel[] = ["sedentary", "light", "moderate", "very_active"];
          const STRUGGLE_MAP: Struggle[] = ["sugar_cravings", "low_energy", "digestive", "social_pressure", "recipe_ideas", "discipline"];
          const INTEREST_MAP: Interest[] = ["recipes", "exercise", "ketosis", "mental_clarity", "progress_tracking", "motivation"];
          const SEX_MAP: Sex[] = ["male", "female", "unspecified"];

          return (
            <div className="space-y-3">

              {/* Primary Goal */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">🎯 Primary Goal</label>
                <div className="flex gap-2 flex-wrap">
                  {GOAL_MAP.map((g, i) => (
                    <button key={g} onClick={() => updateAnswer(0, i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${userProfile.goal === g ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                      {goalLabels[g]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">📊 Experience Level</label>
                <div className="flex gap-2 flex-wrap">
                  {EXP_MAP.map((e, i) => (
                    <button key={e} onClick={() => updateAnswer(1, i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${userProfile.experience === e ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                      {expLabels[e]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Level */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">🏃 Activity Level</label>
                <div className="flex gap-2 flex-wrap">
                  {ACTIVITY_MAP.map((a, i) => (
                    <button key={a} onClick={() => updateAnswer(3, i)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${userProfile.activityLevel === a ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                      {actLabels[a]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body Stats */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3">🧍 Body Stats</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground w-16">Sex</span>
                    {SEX_MAP.map((s, i) => (
                      <button key={s} onClick={() => updateBody("sex", i)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${userProfile.body.sex === s ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                        {sexLabels[s]}
                      </button>
                    ))}
                  </div>
                  {([
                    { label: "Age", field: "age", unit: "years", val: userProfile.body.age },
                    { label: "Height", field: "height", unit: "cm", val: userProfile.body.height },
                    { label: "Weight", field: "weight", unit: "kg", val: userProfile.body.weight },
                    { label: "Goal Weight", field: "goalWeight", unit: "kg", val: userProfile.body.goalWeight },
                  ] as const).map(({ label, field, unit, val }) => (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16">{label}</span>
                      <input
                        type="number"
                        defaultValue={val ?? ""}
                        onBlur={(e) => updateBody(field, e.target.value ? Number(e.target.value) : null)}
                        className="flex-1 bg-secondary rounded-lg px-3 py-1.5 text-sm text-foreground border border-border/40 focus:outline-none focus:ring-1 focus:ring-primary/30 max-w-[120px]"
                      />
                      <span className="text-xs text-muted-foreground">{unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Struggles */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">💪 Struggles</label>
                <div className="flex gap-2 flex-wrap">
                  {STRUGGLE_MAP.map((s, i) => {
                    const active = userProfile.struggles.includes(s);
                    return (
                      <button key={s} onClick={() => {
                        try {
                          const raw = localStorage.getItem("carnivore-onboarding-answers");
                          const answers = raw ? JSON.parse(raw) : [0, 0, [], 1, []];
                          const current: number[] = answers[2] || [];
                          answers[2] = active ? current.filter((x: number) => x !== i) : [...current, i];
                          saveOnboarding("carnivore-onboarding-answers", answers);
                        } catch { /* ignore */ }
                      }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                        {strugLabels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interests */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">⭐ Interests</label>
                <div className="flex gap-2 flex-wrap">
                  {INTEREST_MAP.map((s, i) => {
                    const active = userProfile.interests.includes(s);
                    return (
                      <button key={s} onClick={() => {
                        try {
                          const raw = localStorage.getItem("carnivore-onboarding-answers");
                          const answers = raw ? JSON.parse(raw) : [0, 0, [], 1, []];
                          const current: number[] = answers[4] || [];
                          answers[4] = active ? current.filter((x: number) => x !== i) : [...current, i];
                          saveOnboarding("carnivore-onboarding-answers", answers);
                        } catch { /* ignore */ }
                      }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
                        {interestLabels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nutrition Targets (computed, read-only) */}
              <div className="ios-card p-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">🥩 Daily Nutrition Targets</label>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-lg font-bold text-foreground">{userProfile.nutritionTargets.calories}</p>
                    <p className="text-[10px] text-muted-foreground">kcal</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-lg font-bold text-primary">{userProfile.nutritionTargets.protein}g</p>
                    <p className="text-[10px] text-muted-foreground">protein</p>
                  </div>
                  <div className="bg-secondary rounded-xl p-3">
                    <p className="text-lg font-bold text-foreground">{userProfile.nutritionTargets.fat}g</p>
                    <p className="text-[10px] text-muted-foreground">fat</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Auto-calculated from your body stats, goal & activity level</p>
              </div>
            </div>
          );
        })()}

        {/* Your Feed */}
        {tab === "feed" && (() => {
                const newsItems = [
                { id: "1", title: t("feed.article1.title"), summary: t("feed.article1.summary"), body: t("feed.article1.body"), category: "scienceNews", catLabel: "Science", catIcon: BookOpen, catColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400", feedbackQ: t("feed.article1.feedbackQ"), date: "2026-03-08" },
                { id: "2", title: t("feed.article2.title"), summary: t("feed.article2.summary"), body: t("feed.article2.body"), category: "caseStudyNews", catLabel: "Case Study", catIcon: Heart, catColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", feedbackQ: t("feed.article2.feedbackQ"), date: "2026-03-07" },
                { id: "3", title: t("feed.article3.title"), summary: t("feed.article3.summary"), body: t("feed.article3.body"), category: "tipNews", catLabel: "Tip", catIcon: Zap, catColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400", feedbackQ: t("feed.article3.feedbackQ"), date: "2026-03-07" },
                { id: "4", title: t("feed.article4.title"), summary: t("feed.article4.summary"), body: t("feed.article4.body"), category: "motivationNews", catLabel: "Motivation", catIcon: Zap, catColor: "bg-primary/10 text-primary", feedbackQ: t("feed.article4.feedbackQ"), date: "2026-03-06" },
                { id: "5", title: t("feed.article5.title"), summary: t("feed.article5.summary"), body: t("feed.article5.body"), category: "scienceNews", catLabel: "Science", catIcon: BookOpen, catColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400", feedbackQ: t("feed.article5.feedbackQ"), date: "2026-03-06" },
                { id: "6", title: t("feed.article6.title"), summary: t("feed.article6.summary"), body: t("feed.article6.body"), category: "tipNews", catLabel: "Tip", catIcon: Zap, catColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400", feedbackQ: t("feed.article6.feedbackQ"), date: "2026-03-05" },
              ];
              const filtered = newsItems.filter((n) => notifPrefs[n.category]);
               if (filtered.length === 0) return (
                <div className="text-center py-10 text-muted-foreground">
                  <Newspaper size={36} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t("profile.enableCategoriesHint")}</p>
                </div>
              );
              const formatDate = (ds: string) => {
                const diff = getLocalDayDiff(ds);
                if (diff === null) return "";
                if (diff === 0) return t("profile.today");
                if (diff === 1) return t("profile.yesterday");
                if (diff > 1 && diff < 7) return t("profile.daysAgo", { count: diff });
                return new Date(ds).toLocaleDateString(undefined, { month: "short", day: "numeric" });
              };
              return (
                <div className="space-y-3">
                  {/* Progress Milestones */}
                  {progressMilestones.length > 0 && (
                    <>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("profile.progressMilestones")}</p>
                      {progressMilestones.map((m) => (
                        <div key={m.id} className="ios-card p-4 flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${m.color}`}>
                            {m.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground leading-snug">{m.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
                          </div>
                          <button
                            onClick={() => navigate("/progress")}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      ))}
                      {filtered.length > 0 && <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">{t("profile.newsTips")}</p>}
                    </>
                  )}
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
                          <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
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
                                {feedbackMap[item.id] === "yes" ? t("profile.feedbackYesReply") : t("profile.feedbackNoReply")}
                              </span>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleFeedback(item.id, "yes")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold transition-all active:scale-95"
                                >
                                  <ThumbsUp size={12} />
                                  {t("feed.feedbackYes")}
                                </button>
                                <button
                                  onClick={() => handleFeedback(item.id, "no")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-semibold transition-all active:scale-95"
                                >
                                  <ThumbsDown size={12} />
                                  {t("feed.feedbackNo")}
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
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("profile.displayName")}</label>
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
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("profile.bio")}</label>
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">{t("profile.dietTier")}</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(tierLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={async () => {
                      setEditValues((v) => ({ ...v, diet_tier: key }));
                      await (supabase as any).from("profiles").update({ diet_tier: key }).eq("id", user!.id);
                      setProfile((p) => p ? { ...p, diet_tier: key } : p);
                      if (user) qc.invalidateQueries({ queryKey: ["profile", user.id] });
                      toast.success(t("profile.dietTierUpdated"));
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
                {t("profile.mealsPerDay")}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => {
                  const current = parseInt(localStorage.getItem("carnivore-meals-per-day") || "3") || 3;
                  const labels: Record<number, string> = { 1: t("profile.mealLabels.1"), 2: t("profile.mealLabels.2"), 3: t("profile.mealLabels.3"), 4: t("profile.mealLabels.4") };
                  const descs: Record<number, string> = { 1: t("profile.mealDescs.1"), 2: t("profile.mealDescs.2"), 3: t("profile.mealDescs.3"), 4: t("profile.mealDescs.4") };
                  return (
                    <button
                      key={n}
                      onClick={() => {
                        localStorage.setItem("carnivore-meals-per-day", String(n));
                        window.dispatchEvent(new Event("profile-update"));
                        toast.success(t("profile.mealsUpdated", { count: n }));
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
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{t("profile.email")}</label>
              <p className="text-sm text-foreground">{user?.email}</p>
            </div>

            {/* Alerts / Notification Settings */}
            <h2 className="text-lg font-display font-bold text-foreground pt-3">{t("profile.alerts")}</h2>

            {/* Enable Notifications */}
            <div className="ios-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                   <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.enableNotifications")}</h3>
                   <p className="text-xs text-muted-foreground mt-0.5">{t("profile.enableNotificationsDesc")}</p>
                </div>
                <Switch checked={notifPrefs.enabled} onCheckedChange={(v) => updateNotifPref("enabled", v)} />
              </div>
            </div>

            <div className={`space-y-3 transition-opacity ${!notifPrefs.enabled ? "opacity-50 pointer-events-none" : ""}`}>
              {/* Daily Reminder */}
              <div className="ios-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.dailyReminder")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("profile.dailyReminderDesc")}</p>
                  </div>
                  <Switch checked={notifPrefs.dailyReminder} onCheckedChange={(v) => updateNotifPref("dailyReminder", v)} />
                </div>
                {notifPrefs.dailyReminder && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                    <span className="text-sm text-muted-foreground">{t("profile.reminderTime")}</span>
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
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.streakReminders")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("profile.streakRemindersDesc")}</p>
                  </div>
                  <Switch checked={notifPrefs.streakReminder} onCheckedChange={(v) => updateNotifPref("streakReminder", v)} />
                </div>
              </div>

              {/* Weekly Progress Summary */}
              <div className="ios-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.weeklySummary")}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("profile.weeklySummaryDesc")}</p>
                  </div>
                  <Switch checked={notifPrefs.weeklySummary} onCheckedChange={(v) => updateNotifPref("weeklySummary", v)} />
                </div>
              </div>

              {/* Coaching Call Reminders */}
              <CoachingReminderSettings />

              {/* News Preferences */}
              <h3 className="text-sm font-display font-bold text-foreground pt-2">{t("profile.newsFeedPrefs")}</h3>
              <div className="ios-card p-4 space-y-4">
                {[
                  { key: "scienceNews", label: t("profile.scienceNews"), desc: t("profile.scienceNewsDesc") },
                  { key: "motivationNews", label: t("profile.motivationNews"), desc: t("profile.motivationNewsDesc") },
                  { key: "caseStudyNews", label: t("profile.caseStudyNews"), desc: t("profile.caseStudyNewsDesc") },
                  { key: "tipNews", label: t("profile.tipNews"), desc: t("profile.tipNewsDesc") },
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


            {/* User Notification Preferences */}
            <button
              onClick={async () => {
                console.info("[PushDecision] source=profile-settings branch=manual-tap");
                try {
                  const { auditPushDecision } = await import("@/lib/pushDecision");
                  const decision = await auditPushDecision("profile-settings", { ignoreSessionFlag: true });
                  if (decision.show) {
                    setShowPushConsent(true);
                  } else {
                    console.info("[PushDecision] source=profile-settings branch=suppress-open reason=", decision.reason);
                    toast.info(
                      decision.reason === "os-already-granted"
                        ? "Notifications are already enabled."
                        : "Notification preferences already saved.",
                    );
                  }
                } catch (e) {
                  console.error("[PushDecision] source=profile-settings audit-threw — opening anyway", e);
                  setShowPushConsent(true);
                }
              }}
              className="w-full ios-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell size={18} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.notifPrefTitle")}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t("profile.notifPrefDesc")}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>

            {/* Admin Panel */}
            {isAdmin && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{t("profile.adminTools")}</p>
                <button
                  onClick={() => navigate("/admin/analytics")}
                  className="w-full ios-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.analyticsDashboard")}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t("profile.analyticsDesc")}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => navigate("/admin/notifications")}
                  className="w-full ios-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bell size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.notifications")}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t("profile.notificationsDesc")}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => navigate("/cms")}
                  className="w-full ios-card p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Globe size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.cmsEditor")}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t("profile.cmsEditorDesc")}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Invite a Friend */}
            <div className="ios-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.inviteFriend")}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t("profile.inviteFriendDesc")}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(() => {
                  // TODO: replace with the App Store URL when available
                  const shareUrl = "https://carnivorex.app";
                  const shareTitle = "CarnivoreX";
                  const shareText = "Join me on CarnivoreX — recipes, tracking, coaching, and carnivore tools in one app.";

                  const handleShare = async () => {
                    try {
                      if (Capacitor.isNativePlatform()) {
                        // Keep text and url as separate fields for iOS compatibility
                        await Share.share({
                          title: shareTitle,
                          text: shareText,
                          url: shareUrl,
                          dialogTitle: shareTitle,
                        });
                        return;
                      }
                      if (typeof navigator !== "undefined" && (navigator as any).share) {
                        await (navigator as any).share({ title: shareTitle, text: shareText, url: shareUrl });
                        return;
                      }
                      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                      toast.success(t("profile.linkCopied"));
                    } catch (err: any) {
                      if (err?.name === "AbortError") return;
                      try {
                        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
                        toast.success(t("profile.linkCopied"));
                      } catch {
                        toast.error("Unable to share");
                      }
                    }
                  };

                  const handleCopy = async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success(t("profile.linkCopied"));
                    } catch {
                      toast.error("Unable to copy");
                    }
                  };

                  return (
                    <>
                      <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 bg-primary/10 text-primary"
                      >
                        <Share2 size={14} />
                        {t("profile.inviteFriend")}
                      </button>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 bg-secondary text-muted-foreground"
                      >
                        <Copy size={14} />
                        {t("profile.copyLink")}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>


            {/* Language */}
            <div className="ios-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-muted-foreground" />
                  <div>
                    <h3 className="font-display font-bold text-foreground text-[15px]">{t("profile.language")}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t("profile.languageDesc")}</p>
                  </div>
                </div>
                <LanguageSwitcher />
              </div>
            </div>

            {/* Legal */}
            <div className="ios-card overflow-hidden">
              <button
                onClick={() => navigate("/privacy")}
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors"
              >
                <span className="text-sm font-semibold text-foreground">{t("profile.privacyPolicy")}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
              <div className="h-px bg-border/40 mx-4" />
              <button
                onClick={() => navigate("/terms")}
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors"
              >
                <span className="text-sm font-semibold text-foreground">{t("profile.termsOfUse")}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
              <div className="h-px bg-border/40 mx-4" />
              <button
                onClick={() => navigate("/disclaimer")}
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/40 transition-colors"
              >
                <span className="text-sm font-semibold text-foreground">{t("profile.wellnessDisclaimer")}</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Delete Account — Apple Guideline 5.1.1(v) */}
            <DeleteAccountSection />

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full ios-card p-4 flex items-center gap-3 text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut size={18} />
              <span className="text-sm font-semibold">{t("profile.signOut")}</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default Profile;
