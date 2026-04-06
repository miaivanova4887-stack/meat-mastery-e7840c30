import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Newspaper, Heart, Zap, BookOpen, RefreshCw, ExternalLink, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type NewsCategory = "all" | "science" | "motivation" | "case_study" | "tip";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: Exclude<NewsCategory, "all">;
  source?: string;
  date: string;
}

const categoryConfig: Record<Exclude<NewsCategory, "all">, { label: string; icon: typeof Newspaper; color: string; prefKey: string }> = {
  science: { label: "Science", icon: BookOpen, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", prefKey: "scienceNews" },
  motivation: { label: "Motivation", icon: Zap, color: "bg-primary/10 text-primary", prefKey: "motivationNews" },
  case_study: { label: "Case Study", icon: Heart, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", prefKey: "caseStudyNews" },
  tip: { label: "Tip", icon: Zap, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", prefKey: "tipNews" },
};

function getNotifPrefs() {
  try {
    const stored = localStorage.getItem("carnivore-notif-prefs");
    return stored ? JSON.parse(stored) : { scienceNews: true, motivationNews: true, caseStudyNews: false, tipNews: true };
  } catch {
    return { scienceNews: true, motivationNews: true, caseStudyNews: false, tipNews: true };
  }
}

const allNews: NewsItem[] = [
  {
    id: "1",
    title: "Red Meat and Heart Health: New Meta-Analysis Challenges Old Assumptions",
    summary: "A 2025 meta-analysis of 14 studies found no significant link between unprocessed red meat consumption and cardiovascular disease risk, prompting researchers to revisit dietary guidelines.",
    category: "science",
    source: "Journal of Nutrition",
    date: "2026-03-08",
  },
  {
    id: "2",
    title: "From Chronic Fatigue to Competitive Athlete: Mark's 18-Month Carnivore Journey",
    summary: "After years of battling autoimmune symptoms and chronic fatigue, Mark adopted a strict carnivore diet and documented his transformation from couch-bound to completing his first marathon.",
    category: "case_study",
    date: "2026-03-07",
  },
  {
    id: "3",
    title: "The Power of Organ Meats: Why Liver is Nature's Multivitamin",
    summary: "Gram for gram, beef liver contains more bioavailable nutrients than any plant food. Here's how to incorporate it into your weekly routine even if you hate the taste.",
    category: "tip",
    date: "2026-03-07",
  },
  {
    id: "4",
    title: "You Are Stronger Than You Think: Embrace the Journey",
    summary: "Every day on the carnivore diet is a step toward reclaiming your health. The cravings fade, the energy rises, and the results speak for themselves. Keep going — your future self will thank you.",
    category: "motivation",
    date: "2026-03-06",
  },
  {
    id: "5",
    title: "Carnivore Diet and Gut Microbiome: What the Latest Research Shows",
    summary: "Emerging research suggests that while plant fiber diversity decreases on a carnivore diet, beneficial bile-tolerant bacteria thrive, potentially reducing systemic inflammation.",
    category: "science",
    source: "Gut Microbiome Journal",
    date: "2026-03-06",
  },
  {
    id: "6",
    title: "Budget Carnivore: Feed a Family of Four for Under $100/Week",
    summary: "Ground beef, eggs, and strategic bulk buying can make the carnivore diet surprisingly affordable. Here are the exact shopping lists and meal plans that make it work.",
    category: "tip",
    date: "2026-03-05",
  },
];

const NewsFeed = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<NewsCategory>("all");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading] = useState(false);

  const prefs = getNotifPrefs();

  const enabledCategories = useMemo(() => {
    return (Object.entries(categoryConfig) as [Exclude<NewsCategory, "all">, typeof categoryConfig[keyof typeof categoryConfig]][])
      .filter(([, cfg]) => prefs[cfg.prefKey] !== false)
      .map(([key]) => key);
  }, [prefs]);

  const availableFilters = useMemo(() => {
    const base: { value: NewsCategory; label: string }[] = [{ value: "all", label: "All" }];
    if (enabledCategories.includes("science")) base.push({ value: "science", label: "Science" });
    if (enabledCategories.includes("motivation")) base.push({ value: "motivation", label: "Motivation" });
    if (enabledCategories.includes("case_study")) base.push({ value: "case_study", label: "Case Studies" });
    if (enabledCategories.includes("tip")) base.push({ value: "tip", label: "Tips" });
    return base;
  }, [enabledCategories]);

  const filtered = useMemo(() => {
    const byPrefs = allNews.filter((n) => enabledCategories.includes(n.category));
    if (activeFilter === "all") return byPrefs;
    return byPrefs.filter((n) => n.category === activeFilter);
  }, [activeFilter, enabledCategories]);

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/40" <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/40" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>>
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1 text-muted-foreground">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Daily Feed</h1>
            <p className="text-[11px] text-muted-foreground">
              {enabledCategories.length === 4 ? "All categories" : `${enabledCategories.length} categories active`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => navigate("/profile")}>
            <Settings2 size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <RefreshCw size={18} />
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {availableFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        {enabledCategories.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Settings2 size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No categories enabled</p>
            <p className="text-xs mt-1">Go to Profile → Alerts to choose your news preferences</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/profile")}>
              Open Settings
            </Button>
          </div>
        ) : loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Newspaper size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No articles in this category yet</p>
          </div>
        ) : (
          filtered.map((item) => {
            const cat = categoryConfig[item.category];
            const CatIcon = cat.icon;
            return (
              <article
                key={item.id}
                className="bg-card border border-border rounded-xl p-4 space-y-2.5 animate-fade-in-up"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className={`text-[10px] font-medium gap-1 ${cat.color}`}>
                    <CatIcon size={10} />
                    {cat.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{formatDate(item.date)}</span>
                </div>

                <h2 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h2>

                <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>

                <div className="flex items-center justify-between pt-1">
                  {item.source ? (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ExternalLink size={10} />
                      {item.source}
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => toggleLike(item.id)}
                    className="p-1.5 rounded-full transition-colors hover:bg-muted"
                  >
                    <Heart
                      size={16}
                      className={likedIds.has(item.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}
                    />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NewsFeed;