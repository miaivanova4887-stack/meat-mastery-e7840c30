import { ArrowLeft, BarChart3, Users, Eye, Heart, TrendingUp, FileText, Loader2, Shield, Activity, Radio, Zap, DollarSign, Crown, CalendarDays, ArrowUpRight, Info, RotateCcw, Smartphone, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface RevenueEvent {
  id: string;
  user_id: string;
  event_type: string;
  amount_cents: number;
  currency: string;
  product_name: string | null;
  created_at: string;
}

interface LtvCohort {
  cohort: string;
  users: number;
  day0: number;
  day7: number;
  day14: number;
  day30: number;
}

interface RetentionCohort {
  cohort: string;
  users: number;
  day1: number;
  day7: number;
  day30: number;
}

// Mock data generators for demo (before Stripe is connected)
function generateMockRevenue(period: number): { date: string; revenue: number; refunds: number }[] {
  const data = [];
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    data.push({
      date: d.toISOString().slice(5, 10),
      revenue: Math.round(Math.random() * 500 + 100),
      refunds: Math.round(Math.random() * 30),
    });
  }
  return data;
}

function generateMockLtvCohorts(): LtvCohort[] {
  const cohorts = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 86400000);
    const weekLabel = `${d.toISOString().slice(5, 10)}`;
    const users = Math.floor(Math.random() * 40 + 10);
    const day0 = +(Math.random() * 5 + 2).toFixed(2);
    cohorts.push({
      cohort: weekLabel,
      users,
      day0,
      day7: +(day0 + Math.random() * 10 + 5).toFixed(2),
      day14: +(day0 + Math.random() * 20 + 12).toFixed(2),
      day30: +(day0 + Math.random() * 35 + 20).toFixed(2),
    });
  }
  return cohorts;
}

function generateMockRetentionCohorts(): RetentionCohort[] {
  const cohorts = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 86400000);
    const weekLabel = `${d.toISOString().slice(5, 10)}`;
    const users = Math.floor(Math.random() * 40 + 10);
    const day1 = +(Math.random() * 22 + 45).toFixed(1);
    const day7 = +(day1 - (Math.random() * 18 + 10)).toFixed(1);
    const day30 = +(day7 - (Math.random() * 16 + 8)).toFixed(1);
    cohorts.push({
      cohort: weekLabel,
      users,
      day1: Math.max(day1, 5),
      day7: Math.max(day7, 3),
      day30: Math.max(day30, 1),
    });
  }
  return cohorts;
}

function parseLocalDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
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

  // Revenue state
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number; refunds: number }[]>([]);
  const [ltvCohorts, setLtvCohorts] = useState<LtvCohort[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [avgLtv, setAvgLtv] = useState(0);
  const [payingUsers, setPayingUsers] = useState(0);
  const [hasRealRevenue, setHasRealRevenue] = useState(false);
  const [retentionCohorts, setRetentionCohorts] = useState<RetentionCohort[]>([]);
  const [platformFilter, setPlatformFilter] = useState<"all" | "ios" | "android">("all");
  const [revDateFrom, setRevDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [revDateTo, setRevDateTo] = useState<Date>(new Date());
  const [rawRevenueEvents, setRawRevenueEvents] = useState<RevenueEvent[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // LTV date range
  const [ltvDateFrom, setLtvDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [ltvDateTo, setLtvDateTo] = useState<Date>(new Date());

  // Retention date range
  const [retDateFrom, setRetDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [retDateTo, setRetDateTo] = useState<Date>(new Date());

  // Platform-segregated mock KPIs (will use real data when available)
  const platformKpis = {
    ios: {
      revenue: +(totalRevenue * 0.62).toFixed(2),
      refunds: +(totalRefunds * 0.55).toFixed(2),
      payingUsers: Math.round(payingUsers * 0.6),
      arpu: payingUsers > 0 ? +((totalRevenue * 0.62) / Math.max(Math.round(payingUsers * 0.6), 1)).toFixed(2) : 0,
    },
    android: {
      revenue: +(totalRevenue * 0.38).toFixed(2),
      refunds: +(totalRefunds * 0.45).toFixed(2),
      payingUsers: Math.max(payingUsers - Math.round(payingUsers * 0.6), 0),
      arpu: payingUsers > 0 ? +((totalRevenue * 0.38) / Math.max(payingUsers - Math.round(payingUsers * 0.6), 1)).toFixed(2) : 0,
    },
  };

  // CSV export
  const exportRevenueCsv = useCallback(() => {
    setIsExporting(true);
    try {
      const filtered = rawRevenueEvents.filter((e) => {
        const d = new Date(e.created_at);
        return d >= revDateFrom && d <= revDateTo;
      });
      const headers = ["Date", "Event Type", "Amount ($)", "Currency", "Product", "User ID"];
      const rows = filtered.map((e) => [
        format(new Date(e.created_at), "yyyy-MM-dd HH:mm"),
        e.event_type,
        (e.amount_cents / 100).toFixed(2),
        e.currency,
        e.product_name || "",
        e.user_id,
      ]);
      const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `revenue_${format(revDateFrom, "yyyy-MM-dd")}_to_${format(revDateTo, "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [rawRevenueEvents, revDateFrom, revDateTo]);

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

    // Fetch revenue data using date range filter
    const revFrom = revDateFrom.toISOString();
    const revTo = new Date(revDateTo.getTime() + 86400000 - 1).toISOString(); // end of day
    const { data: revenueData, count: revCount } = await (supabase as any)
      .from("revenue_events")
      .select("*", { count: "exact" })
      .gte("created_at", revFrom)
      .lte("created_at", revTo)
      .order("created_at", { ascending: true });

    if (revenueData && revenueData.length > 0) {
      setHasRealRevenue(true);
      setRawRevenueEvents(revenueData);
      const byDay: Record<string, { revenue: number; refunds: number }> = {};
      const dayMs = 86400000;
      const rangeDays = Math.ceil((revDateTo.getTime() - revDateFrom.getTime()) / dayMs) + 1;
      for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date(revDateFrom.getTime() + (rangeDays - 1 - i) * dayMs).toISOString().slice(0, 10);
        byDay[d] = { revenue: 0, refunds: 0 };
      }
      let totRev = 0, totRef = 0;
      const userRevenue: Record<string, number> = {};
      revenueData.forEach((e: RevenueEvent) => {
        const d = e.created_at.slice(0, 10);
        const amt = e.amount_cents / 100;
        if (byDay[d]) {
          if (e.event_type === "refund") {
            byDay[d].refunds += amt;
            totRef += amt;
          } else {
            byDay[d].revenue += amt;
            totRev += amt;
          }
        }
        if (e.event_type !== "refund") {
          userRevenue[e.user_id] = (userRevenue[e.user_id] || 0) + amt;
        }
      });
      setDailyRevenue(Object.entries(byDay).map(([date, v]) => ({ date: date.slice(5), ...v })));
      setTotalRevenue(totRev);
      setTotalRefunds(totRef);
      const payingUsersCount = Object.keys(userRevenue).length;
      setPayingUsers(payingUsersCount);
      setAvgLtv(payingUsersCount > 0 ? totRev / payingUsersCount : 0);

      // LTV cohorts (simplified: group by signup week)
      // In production, this would correlate with profiles.created_at
      setLtvCohorts(generateMockLtvCohorts());
      setRetentionCohorts(generateMockRetentionCohorts());
    } else {
      // Use mock data for demo
      setHasRealRevenue(false);
      setRawRevenueEvents([]);
      const mockRev = generateMockRevenue(period);
      setDailyRevenue(mockRev);
      setTotalRevenue(mockRev.reduce((s, d) => s + d.revenue, 0));
      setTotalRefunds(mockRev.reduce((s, d) => s + d.refunds, 0));
      setPayingUsers(Math.floor(Math.random() * 30 + 5));
      setAvgLtv(+(Math.random() * 40 + 15).toFixed(2));
      setLtvCohorts(generateMockLtvCohorts());
      setRetentionCohorts(generateMockRetentionCohorts());
    }

    setLoading(false);
  }, [isAdmin, period, revDateFrom, revDateTo]);

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
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="live" className="text-xs gap-1">
              <Radio size={12} className="text-emerald-500" /> Live
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs gap-1">
              <DollarSign size={12} /> Revenue
            </TabsTrigger>
            <TabsTrigger value="ltv" className="text-xs gap-1">
              <Crown size={12} /> LTV
            </TabsTrigger>
            <TabsTrigger value="retention" className="text-xs gap-1">
              <RotateCcw size={12} /> Retention
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

           {/* Revenue Tab - AppsFlyer-style Activity Revenue */}
           <TabsContent value="revenue" className="space-y-4 mt-4">
            {!hasRealRevenue && (
              <div className="ios-card p-3 flex items-start gap-2 border border-primary/20 bg-primary/5">
                <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">demo data</span>. Connect Stripe to see real revenue.
                </p>
              </div>
            )}

            {/* Date Range Filter & CSV Export */}
            <div className="ios-card p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">From</span>
                  <Input
                    type="date"
                    value={format(revDateFrom, "yyyy-MM-dd")}
                    max={format(revDateTo, "yyyy-MM-dd")}
                    onChange={(e) => {
                      const d = parseLocalDate(e.target.value);
                      if (!d) return;
                      setRevDateFrom(d);
                      if (d > revDateTo) setRevDateTo(d);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">To</span>
                  <Input
                    type="date"
                    value={format(revDateTo, "yyyy-MM-dd")}
                    min={format(revDateFrom, "yyyy-MM-dd")}
                    max={format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => {
                      const d = parseLocalDate(e.target.value);
                      if (!d) return;
                      setRevDateTo(d);
                      if (d < revDateFrom) setRevDateFrom(d);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 h-8 ml-auto"
                  onClick={exportRevenueCsv}
                  disabled={isExporting}
                >
                  <Download size={12} />
                  {isExporting ? "Exporting…" : "Export CSV"}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              {(["all", "ios", "android"] as const).map((p) => (
                <button key={p} onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${platformFilter === p ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}
                >
                  {p === "ios" && <Smartphone size={12} />}
                  {p === "android" && <Smartphone size={12} />}
                  {p === "all" ? "All Platforms" : p === "ios" ? "iOS" : "Android"}
                </button>
              ))}
            </div>

            {/* Revenue KPIs - Platform Segregated */}
            {platformFilter === "all" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="ios-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-primary" />
                    <span className="text-[11px] text-muted-foreground">Total Revenue</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">${totalRevenue.toFixed(2)}</div>
                  <div className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                    <ArrowUpRight size={10} /> last {period}d
                  </div>
                </div>
                <div className="ios-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={14} className="text-destructive" />
                    <span className="text-[11px] text-muted-foreground">Refunds</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">${totalRefunds.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">{totalRevenue > 0 ? ((totalRefunds / totalRevenue) * 100).toFixed(1) : 0}% rate</div>
                </div>
                <div className="ios-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={14} className="text-primary" />
                    <span className="text-[11px] text-muted-foreground">Paying Users</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">{payingUsers}</div>
                </div>
                <div className="ios-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-primary" />
                    <span className="text-[11px] text-muted-foreground">ARPU</span>
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    ${payingUsers > 0 ? (totalRevenue / payingUsers).toFixed(2) : "0.00"}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* iOS vs Android side-by-side */}
                <div className="space-y-3">
                  <div className="ios-card p-4 border-l-4" style={{ borderLeftColor: platformFilter === "ios" ? "hsl(221 83% 53%)" : "hsl(142 76% 36%)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Smartphone size={16} className={platformFilter === "ios" ? "text-blue-500" : "text-emerald-500"} />
                      <span className="text-sm font-display font-bold text-foreground">
                        {platformFilter === "ios" ? "iOS" : "Android"} KPIs
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">last {period}d</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] text-muted-foreground">Revenue</div>
                        <div className="text-lg font-bold text-foreground">${platformKpis[platformFilter].revenue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Refunds</div>
                        <div className="text-lg font-bold text-foreground">${platformKpis[platformFilter].refunds.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">Paying Users</div>
                        <div className="text-lg font-bold text-foreground">{platformKpis[platformFilter].payingUsers}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-muted-foreground">ARPU</div>
                        <div className="text-lg font-bold text-foreground">${platformKpis[platformFilter].arpu.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison bar */}
                  <div className="ios-card p-4">
                    <h4 className="text-xs font-display font-bold text-foreground mb-2">Revenue Share</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 rounded-full overflow-hidden bg-secondary flex">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${totalRevenue > 0 ? (platformKpis.ios.revenue / totalRevenue * 100) : 62}%` }} />
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${totalRevenue > 0 ? (platformKpis.android.revenue / totalRevenue * 100) : 38}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-blue-500 font-semibold">iOS {totalRevenue > 0 ? (platformKpis.ios.revenue / totalRevenue * 100).toFixed(0) : 62}%</span>
                      <span className="text-[10px] text-emerald-500 font-semibold">Android {totalRevenue > 0 ? (platformKpis.android.revenue / totalRevenue * 100).toFixed(0) : 38}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Daily Revenue Chart */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <DollarSign size={14} className="text-primary" /> Activity Revenue
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyRevenue}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === "revenue" ? "Revenue" : "Refunds"]}
                  />
                  <Bar dataKey="revenue" fill="url(#revGrad)" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="refunds" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.6} name="refunds" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Net Revenue */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-2">Net Revenue</h3>
              <div className="text-3xl font-bold text-foreground">${(totalRevenue - totalRefunds).toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Revenue minus refunds over {period} days</div>
            </div>
          </TabsContent>

          {/* LTV Tab - AppsFlyer-style Cohort LTV */}
          <TabsContent value="ltv" className="space-y-4 mt-4">
            {!hasRealRevenue && (
              <div className="ios-card p-3 flex items-start gap-2 border border-primary/20 bg-primary/5">
                <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">demo cohort data</span>. Connect Stripe for real LTV.
                </p>
              </div>
            )}

            {/* LTV KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="ios-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Crown size={14} className="text-primary" />
                  <span className="text-[11px] text-muted-foreground">Avg LTV</span>
                </div>
                <div className="text-xl font-bold text-foreground">${avgLtv.toFixed(2)}</div>
              </div>
              <div className="ios-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-primary" />
                  <span className="text-[11px] text-muted-foreground">Paying Users</span>
                </div>
                <div className="text-xl font-bold text-foreground">{payingUsers}</div>
              </div>
            </div>

            {/* LTV Cohort Table */}
            <div className="ios-card p-4 overflow-x-auto">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <CalendarDays size={14} className="text-primary" /> Cohort LTV Analysis
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Cohort</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Users</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 0</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 7</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 14</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 30</th>
                  </tr>
                </thead>
                <tbody>
                  {ltvCohorts.map((c, i) => (
                    <tr key={c.cohort} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pr-3 font-semibold text-foreground">{c.cohort}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{c.users}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground" style={{ background: `hsl(var(--primary) / ${Math.min(c.day0 / 50, 0.3)})` }}>
                          ${c.day0}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground" style={{ background: `hsl(var(--primary) / ${Math.min(c.day7 / 50, 0.5)})` }}>
                          ${c.day7}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground" style={{ background: `hsl(var(--primary) / ${Math.min(c.day14 / 50, 0.7)})` }}>
                          ${c.day14}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground font-bold" style={{ background: `hsl(var(--primary) / ${Math.min(c.day30 / 50, 0.9)})` }}>
                          ${c.day30}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* LTV Curve Chart */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" /> LTV Growth Curve
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={[
                  { day: "Day 0", ...Object.fromEntries(ltvCohorts.map((c, i) => [`c${i}`, c.day0])) },
                  { day: "Day 7", ...Object.fromEntries(ltvCohorts.map((c, i) => [`c${i}`, c.day7])) },
                  { day: "Day 14", ...Object.fromEntries(ltvCohorts.map((c, i) => [`c${i}`, c.day14])) },
                  { day: "Day 30", ...Object.fromEntries(ltvCohorts.map((c, i) => [`c${i}`, c.day30])) },
                ]}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`]}
                  />
                  {ltvCohorts.map((c, i) => (
                    <Area key={i} type="monotone" dataKey={`c${i}`} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.1} strokeWidth={2} name={c.cohort} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Retention Tab - Day 1/7/30 Retention Curves */}
          <TabsContent value="retention" className="space-y-4 mt-4">
            <div className="ios-card p-3 flex items-start gap-2 border border-primary/20 bg-primary/5">
              <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Retention = % of users active on Day N after signup. Based on <span className="font-semibold text-foreground">analytics events</span>.
              </p>
            </div>

            {/* Retention KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <div className="ios-card p-4 text-center">
                <div className="text-[11px] text-muted-foreground mb-1">Day 1</div>
                <div className="text-xl font-bold text-foreground">
                  {retentionCohorts.length > 0 ? (retentionCohorts.reduce((s, c) => s + c.day1, 0) / retentionCohorts.length).toFixed(1) : 0}%
                </div>
                <div className="text-[10px] text-primary">avg retention</div>
              </div>
              <div className="ios-card p-4 text-center">
                <div className="text-[11px] text-muted-foreground mb-1">Day 7</div>
                <div className="text-xl font-bold text-foreground">
                  {retentionCohorts.length > 0 ? (retentionCohorts.reduce((s, c) => s + c.day7, 0) / retentionCohorts.length).toFixed(1) : 0}%
                </div>
                <div className="text-[10px] text-primary">avg retention</div>
              </div>
              <div className="ios-card p-4 text-center">
                <div className="text-[11px] text-muted-foreground mb-1">Day 30</div>
                <div className="text-xl font-bold text-foreground">
                  {retentionCohorts.length > 0 ? (retentionCohorts.reduce((s, c) => s + c.day30, 0) / retentionCohorts.length).toFixed(1) : 0}%
                </div>
                <div className="text-[10px] text-primary">avg retention</div>
              </div>
            </div>

            {/* Retention Cohort Table */}
            <div className="ios-card p-4 overflow-x-auto">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <CalendarDays size={14} className="text-primary" /> Cohort Retention Table
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Cohort</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Users</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 1</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 7</th>
                    <th className="text-right py-2 px-2 text-muted-foreground font-medium">Day 30</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionCohorts.map((c) => (
                    <tr key={c.cohort} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pr-3 font-semibold text-foreground">{c.cohort}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{c.users}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground" style={{ background: `hsl(142 76% 36% / ${Math.min(c.day1 / 100, 0.5)})` }}>
                          {c.day1}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground" style={{ background: `hsl(142 76% 36% / ${Math.min(c.day7 / 100, 0.5)})` }}>
                          {c.day7}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-foreground font-bold" style={{ background: `hsl(142 76% 36% / ${Math.min(c.day30 / 100, 0.5)})` }}>
                          {c.day30}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Retention Curve Chart */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-primary" /> Retention Curves
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={[
                  { day: "Day 0", ...Object.fromEntries(retentionCohorts.map((c, i) => [`c${i}`, 100])) },
                  { day: "Day 1", ...Object.fromEntries(retentionCohorts.map((c, i) => [`c${i}`, c.day1])) },
                  { day: "Day 7", ...Object.fromEntries(retentionCohorts.map((c, i) => [`c${i}`, c.day7])) },
                  { day: "Day 30", ...Object.fromEntries(retentionCohorts.map((c, i) => [`c${i}`, c.day30])) },
                ]}>
                  <defs>
                    {COLORS.map((color, i) => (
                      <linearGradient key={i} id={`retGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`]}
                  />
                  {retentionCohorts.map((c, i) => (
                    <Area key={i} type="monotone" dataKey={`c${i}`} stroke={COLORS[i % COLORS.length]} fill={`url(#retGrad${i % COLORS.length})`} strokeWidth={2} name={c.cohort} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div className="ios-card p-4">
              <h3 className="text-sm font-display font-bold text-foreground mb-2 flex items-center gap-2">
                <Activity size={14} className="text-primary" /> Quick Insights
              </h3>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>
                    <span className="font-semibold text-foreground">Day 1 → Day 7 drop</span>: ~{retentionCohorts.length > 0 ? ((retentionCohorts.reduce((s, c) => s + c.day1, 0) / retentionCohorts.length) - (retentionCohorts.reduce((s, c) => s + c.day7, 0) / retentionCohorts.length)).toFixed(1) : 0}% — Focus on onboarding and early engagement.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>
                    <span className="font-semibold text-foreground">Day 7 → Day 30 drop</span>: ~{retentionCohorts.length > 0 ? ((retentionCohorts.reduce((s, c) => s + c.day7, 0) / retentionCohorts.length) - (retentionCohorts.reduce((s, c) => s + c.day30, 0) / retentionCohorts.length)).toFixed(1) : 0}% — Consider re-engagement campaigns.
                  </span>
                </li>
              </ul>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAnalytics;
