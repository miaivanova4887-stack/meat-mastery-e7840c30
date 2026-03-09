import { ArrowLeft, BarChart3, Users, Eye, Heart, TrendingUp, FileText, Loader2, Shield, Activity, Radio, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(142 76% 36%)", "hsl(45 93% 47%)", "hsl(221 83% 53%)"];

interface Stats {
  totalUsers: number;
  newUsersThisWeek: number;
  totalRecipes: number;
  totalLikes: number;
  totalProgressEntries: number;
  totalCmsPages: number;
  publishedCmsPages: number;
}

interface LiveEvent {
  id: string;
  event_type: string;
  page_path: string | null;
  created_at: string;
  user_id: string | null;
}

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pageViews, setPageViews] = useState<{ date: string; views: number }[]>([]);
  const [topPages, setTopPages] = useState<{ page: string; views: number }[]>([]);
  const [dailySignups, setDailySignups] = useState<{ date: string; count: number }[]>([]);
  const [dietDistribution, setDietDistribution] = useState<{ name: string; value: number }[]>([]);
  const [cmsPageStats, setCmsPageStats] = useState<{ title: string; slug: string; views: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  // Real-time state
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [eventsPerMinute, setEventsPerMinute] = useState(0);
  const recentSessionsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user, navigate]);

  const fetchAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    const since = new Date(Date.now() - period * 86400000).toISOString();

    // Aggregate stats from existing tables
    const [profilesRes, recipesRes, likesRes, progressRes, cmsRes] = await Promise.all([
      (supabase as any).from("profiles").select("id, created_at, diet_tier"),
      (supabase as any).from("community_recipes").select("id", { count: "exact", head: true }),
      (supabase as any).from("recipe_likes").select("id", { count: "exact", head: true }),
      (supabase as any).from("progress_entries").select("id", { count: "exact", head: true }),
      (supabase as any).from("cms_pages").select("id, title, slug, published"),
    ]);

    const profiles = profilesRes.data || [];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const newThisWeek = profiles.filter((p: any) => p.created_at >= weekAgo).length;

    // Diet distribution
    const dietCounts: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const tier = p.diet_tier || "strict";
      dietCounts[tier] = (dietCounts[tier] || 0) + 1;
    });
    const dietLabels: Record<string, string> = { strict: "Strict Carnivore", lion: "Lion Diet", animal_based: "Animal-Based" };
    setDietDistribution(Object.entries(dietCounts).map(([k, v]) => ({ name: dietLabels[k] || k, value: v })));

    // Daily signups
    const signupsByDay: Record<string, number> = {};
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      signupsByDay[d] = 0;
    }
    profiles.forEach((p: any) => {
      const d = p.created_at.slice(0, 10);
      if (signupsByDay[d] !== undefined) signupsByDay[d]++;
    });
    setDailySignups(Object.entries(signupsByDay).map(([date, count]) => ({ date: date.slice(5), count })));

    const cmsPages = cmsRes.data || [];
    setStats({
      totalUsers: profiles.length,
      newUsersThisWeek: newThisWeek,
      totalRecipes: recipesRes.count || 0,
      totalLikes: likesRes.count || 0,
      totalProgressEntries: progressRes.count || 0,
      totalCmsPages: cmsPages.length,
      publishedCmsPages: cmsPages.filter((p: any) => p.published).length,
    });

    // Analytics events: page views
    const { data: events } = await (supabase as any)
      .from("analytics_events")
      .select("event_type, page_path, created_at")
      .eq("event_type", "page_view")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (events && events.length > 0) {
      // Daily page views
      const viewsByDay: Record<string, number> = {};
      for (let i = period - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        viewsByDay[d] = 0;
      }
      events.forEach((e: any) => {
        const d = e.created_at.slice(0, 10);
        if (viewsByDay[d] !== undefined) viewsByDay[d]++;
      });
      setPageViews(Object.entries(viewsByDay).map(([date, views]) => ({ date: date.slice(5), views })));

      // Top pages
      const pageCounts: Record<string, number> = {};
      events.forEach((e: any) => {
        const p = e.page_path || "/";
        pageCounts[p] = (pageCounts[p] || 0) + 1;
      });
      setTopPages(
        Object.entries(pageCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([page, views]) => ({ page, views }))
      );

      // CMS page views
      const cmsViews = events.filter((e: any) => e.page_path?.startsWith("/p/"));
      const cmsViewCounts: Record<string, number> = {};
      cmsViews.forEach((e: any) => {
        const slug = e.page_path.replace("/p/", "");
        cmsViewCounts[slug] = (cmsViewCounts[slug] || 0) + 1;
      });
      setCmsPageStats(
        cmsPages.map((p: any) => ({
          title: p.title,
          slug: p.slug,
          views: cmsViewCounts[p.slug] || 0,
        })).sort((a: any, b: any) => b.views - a.views)
      );
    } else {
      setPageViews([]);
      setTopPages([]);
      setCmsPageStats(cmsPages.map((p: any) => ({ title: p.title, slug: p.slug, views: 0 })));
    }

    setLoading(false);
  }, [isAdmin, period]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Real-time subscription for live events
  useEffect(() => {
    if (!isAdmin) return;

    // Fetch recent events for initial live feed
    (async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      const { data } = await (supabase as any)
        .from("analytics_events")
        .select("id, event_type, page_path, created_at, user_id, session_id")
        .gte("created_at", fiveMinAgo)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) {
        setLiveEvents(data);
        // Count unique sessions in last 5 min
        const sessions = new Map<string, number>();
        data.forEach((e: any) => {
          if (e.session_id) sessions.set(e.session_id, Date.now());
        });
        recentSessionsRef.current = sessions;
        setActiveUsers(sessions.size);
        // Events per minute
        const oneMinAgo = Date.now() - 60000;
        const recentCount = data.filter((e: any) => new Date(e.created_at).getTime() > oneMinAgo).length;
        setEventsPerMinute(recentCount);
      }
    })();

    const channel = supabase
      .channel("live-analytics")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "analytics_events" },
        (payload: any) => {
          const newEvent: LiveEvent = payload.new;
          setLiveEvents((prev) => [newEvent, ...prev].slice(0, 50));

          // Update active users
          if (payload.new.session_id) {
            recentSessionsRef.current.set(payload.new.session_id, Date.now());
            setActiveUsers(recentSessionsRef.current.size);
          }

          // Update events per minute counter
          setEventsPerMinute((prev) => prev + 1);
        }
      )
      .subscribe();

    // Decay active users every 30s (remove sessions older than 5 min)
    const decayInterval = setInterval(() => {
      const cutoff = Date.now() - 5 * 60000;
      const sessions = recentSessionsRef.current;
      for (const [sid, ts] of sessions) {
        if (ts < cutoff) sessions.delete(sid);
      }
      setActiveUsers(sessions.size);
    }, 30000);

    // Reset events-per-minute every 60s
    const epmInterval = setInterval(() => {
      setEventsPerMinute(0);
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(decayInterval);
      clearInterval(epmInterval);
    };
  }, [isAdmin]);

  if (isAdmin === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-lg font-display font-bold tracking-tight">Analytics</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <Shield size={48} className="text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-display font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">Admin privileges required.</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, sub, color = "text-primary" }: { icon: any; label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="ios-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <div className="text-xl font-bold text-foreground leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-primary font-medium">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-40 bg-card/85 ios-blur border-b border-border/30 shadow-xs px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></button>
        <BarChart3 size={18} className="text-primary" />
        <h1 className="text-lg font-display font-bold tracking-tight flex-1">Analytics</h1>
        <button onClick={() => navigate("/admin/notifications")} className="text-xs text-primary font-semibold">Notifications</button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <Tabs defaultValue="overview">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
            <TabsTrigger value="live" className="flex-1 text-xs gap-1">
              <Radio size={12} className="text-emerald-500" /> Live
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-4 mt-4">
            {/* Live metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="ios-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center relative">
                  <Users size={18} className="text-emerald-600" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground leading-none">{activeUsers}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Active Users</div>
                  <div className="text-[10px] text-emerald-600 font-medium">last 5 min</div>
                </div>
              </div>
              <div className="ios-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap size={18} className="text-primary" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground leading-none">{eventsPerMinute}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Events/min</div>
                </div>
              </div>
            </div>

            {/* Live event stream */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <Radio size={14} className="text-emerald-500 animate-pulse" /> Live Event Stream
              </h3>
              {liveEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Waiting for events…</p>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {liveEvents.map((e, i) => {
                    const time = new Date(e.created_at);
                    const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                    const isPageView = e.event_type === "page_view";
                    return (
                      <div key={e.id || i} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                        <span className="text-[10px] text-muted-foreground font-mono w-16 flex-shrink-0">{timeStr}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${isPageView ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                          {e.event_type}
                        </span>
                        <span className="text-xs text-foreground truncate flex-1">{e.page_path || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="overview" className="space-y-4 mt-4">
        {/* Period selector */}
        <div className="flex gap-2">
          {([7, 14, 30] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${period === p ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
            >{p}d</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label="Total Users" value={stats?.totalUsers || 0} sub={`+${stats?.newUsersThisWeek || 0} this week`} />
              <StatCard icon={Heart} label="Community Recipes" value={stats?.totalRecipes || 0} color="text-destructive" />
              <StatCard icon={TrendingUp} label="Progress Entries" value={stats?.totalProgressEntries || 0} color="text-emerald-600" />
              <StatCard icon={FileText} label="CMS Pages" value={`${stats?.publishedCmsPages || 0}/${stats?.totalCmsPages || 0}`} sub="published" color="text-blue-600" />
            </div>

            {/* Page views chart */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <Eye size={14} className="text-primary" /> Page Views
              </h3>
              {pageViews.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={pageViews}>
                    <defs>
                      <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" fill="url(#pvGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">No page view data yet. Events are tracked as users browse.</p>
              )}
            </div>

            {/* Daily signups */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <Users size={14} className="text-primary" /> Daily Signups
              </h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailySignups}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={20} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Diet distribution */}
            {dietDistribution.length > 0 && (
              <div className="ios-card p-4">
                <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                  <Activity size={14} className="text-primary" /> Diet Distribution
                </h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={dietDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} strokeWidth={2}>
                        {dietDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {dietDistribution.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-foreground font-medium flex-1">{d.name}</span>
                        <span className="text-muted-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top pages */}
            {topPages.length > 0 && (
              <div className="ios-card p-4">
                <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                  <Eye size={14} className="text-muted-foreground" /> Top Pages
                </h3>
                <div className="space-y-2">
                  {topPages.map((p, i) => (
                    <div key={p.page} className="flex items-center gap-2">
                      <span className="text-[10px] w-5 text-muted-foreground font-medium">{i + 1}</span>
                      <span className="text-xs text-foreground font-medium flex-1 truncate">{p.page}</span>
                      <span className="text-xs text-muted-foreground font-semibold">{p.views}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CMS Pages */}
            {cmsPageStats.length > 0 && (
              <div className="ios-card p-4">
                <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                  <FileText size={14} className="text-blue-600" /> CMS Page Analytics
                </h3>
                <div className="space-y-2">
                  {cmsPageStats.map((p) => (
                    <div key={p.slug} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-foreground font-medium block truncate">{p.title}</span>
                        <span className="text-[10px] text-muted-foreground">/p/{p.slug}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-semibold flex-shrink-0">{p.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement stats */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-2 flex items-center gap-2">
                <Heart size={14} className="text-destructive" /> Engagement
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{stats?.totalLikes || 0}</div>
                  <div className="text-[11px] text-muted-foreground">Total Likes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{stats?.totalRecipes || 0}</div>
                  <div className="text-[11px] text-muted-foreground">Community Recipes</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;
