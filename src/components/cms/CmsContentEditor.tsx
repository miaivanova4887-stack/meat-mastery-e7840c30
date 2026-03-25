import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { reloadContentOverrides } from "@/hooks/useContentOverrides";
import { Search, Save, Loader2, Globe, Image as ImageIcon, Link as LinkIcon, Type, CheckCircle2, XCircle } from "lucide-react";
import en from "@/i18n/en.json";
import fr from "@/i18n/fr.json";

interface ContentBlock {
  id?: string;
  page: string;
  section: string;
  key: string;
  type: string;
  locale: string;
  value: string;
}

const PAGE_NAMES: Record<string, string> = {
  nav: "Navigation",
  home: "Home",
  auth: "Authentication",
  onboarding: "Onboarding",
  recipes: "Recipes",
  mealPlan: "Meal Plan",
  progress: "Progress",
  profile: "Profile",
  benefits: "Benefits",
  myths: "Myths Busted",
  guide: "Complete Guide",
  cravings: "Cravings",
  sustain: "Sustain Results",
  gettingStarted: "First 30 Days",
  budget: "Budget Eating",
  athletic: "Athletic Performance",
  exercise: "Exercise",
  ingredients: "Ingredients",
  ketosis: "Ketosis Timer",
  timer: "Ketosis Timer",
  stories: "Success Stories",
  community: "Community",
  shopping: "Shopping Bag",
  quotes: "Quotes",
};

const SECTION_NAMES: Record<string, string> = {
  general: "General",
  features: "Features",
  greetings: "Greetings",
  subtitles: "Subtitles",
  tips: "Tips",
  steps: "Steps",
  items: "Items",
  categories: "Categories",
  metrics: "Metrics",
  tiers: "Diet Tiers",
  cuisines: "Cuisines",
  cravings: "Cravings",
  options: "Options",
  moodLabels: "Mood Labels",
  mealLabels: "Meal Labels",
  mealDescs: "Meal Descriptions",
  quiz: "Quiz",
  links: "Links & Buttons",
  phases: "Ketosis Phases",
  science: "Science Descriptions",
  tips: "Tips",
  controls: "Controls & Labels",
  coaching_cta: "Coaching CTA",
};

// Known link/button pairs per page: { page, section, label_key (i18n path), url }
const LINK_PAIRS: Array<{ page: string; section: string; labelKey: string; labelEn: string; labelFr: string; url: string }> = [
  { page: "home", section: "links", labelKey: "motivationTitle", labelEn: "Need extra motivation?", labelFr: "Besoin de motivation ?", url: "#motivation" },
  { page: "home", section: "links", labelKey: "benefits_link", labelEn: "Benefits", labelFr: "Bienfaits", url: "/benefits" },
  { page: "home", section: "links", labelKey: "recipes_link", labelEn: "Recipes", labelFr: "Recettes", url: "/recipes" },
  { page: "home", section: "links", labelKey: "timer_link", labelEn: "Ketosis Timer", labelFr: "Minuterie Cétose", url: "/timer" },
  { page: "home", section: "links", labelKey: "ingredients_link", labelEn: "Ingredients", labelFr: "Ingrédients", url: "/ingredients" },
  { page: "home", section: "links", labelKey: "exercise_link", labelEn: "Exercise", labelFr: "Exercice", url: "/exercise" },
  { page: "home", section: "links", labelKey: "cravings_link", labelEn: "Cravings", labelFr: "Envies", url: "/cravings" },
  { page: "home", section: "links", labelKey: "sustain_link", labelEn: "Sustain Results", labelFr: "Maintenir les résultats", url: "/sustain" },
  { page: "home", section: "links", labelKey: "myths_link", labelEn: "Myths Busted", labelFr: "Mythes démystifiés", url: "/myths" },
  { page: "home", section: "links", labelKey: "guide_link", labelEn: "Complete Guide", labelFr: "Guide complet", url: "/guide" },
  { page: "home", section: "links", labelKey: "getting_started_link", labelEn: "First 30 Days", labelFr: "30 premiers jours", url: "/getting-started" },
  { page: "home", section: "links", labelKey: "budget_link", labelEn: "Budget Eating", labelFr: "Manger petit budget", url: "/budget" },
  { page: "home", section: "links", labelKey: "athletic_link", labelEn: "Athletic Fuel", labelFr: "Carburant athlétique", url: "/athletic" },
  { page: "recipes", section: "links", labelKey: "shopping_bag_link", labelEn: "Shopping Bag", labelFr: "Panier", url: "/shopping-bag" },
  { page: "recipes", section: "links", labelKey: "create_recipe_link", labelEn: "Create Recipe", labelFr: "Créer une recette", url: "/create-recipe" },
  { page: "recipes", section: "links", labelKey: "recipe_coach_link", labelEn: "Recipe Coach", labelFr: "Coach Recettes", url: "/recipe-coach" },
  { page: "shopping", section: "links", labelKey: "browse_ingredients_link", labelEn: "Browse Ingredients", labelFr: "Parcourir ingrédients", url: "/ingredients" },
  { page: "progress", section: "links", labelKey: "health_sync_link", labelEn: "Health Sync", labelFr: "Sync Santé", url: "/progress/sync" },
  { page: "progress", section: "links", labelKey: "sign_in_link", labelEn: "Sign In", labelFr: "Se connecter", url: "/auth" },
  { page: "community", section: "links", labelKey: "stories_link", labelEn: "Success Stories", labelFr: "Témoignages", url: "/stories" },
  { page: "nav", section: "links", labelKey: "home_link", labelEn: "Home", labelFr: "Accueil", url: "/" },
  { page: "nav", section: "links", labelKey: "recipes_link", labelEn: "Recipes", labelFr: "Recettes", url: "/recipes" },
  { page: "nav", section: "links", labelKey: "plan_link", labelEn: "Plan", labelFr: "Plan", url: "/meal-plan" },
  { page: "nav", section: "links", labelKey: "progress_link", labelEn: "Progress", labelFr: "Progrès", url: "/progress" },
  { page: "nav", section: "links", labelKey: "profile_link", labelEn: "Profile", labelFr: "Profil", url: "/profile" },
];

function humanize(str: string): string {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\./g, " › ")
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function pageName(key: string): string {
  return PAGE_NAMES[key] || humanize(key);
}

function sectionName(key: string): string {
  return SECTION_NAMES[key] || humanize(key);
}

function fieldLabel(key: string): string {
  return humanize(key.split(".").pop() || key);
}

function flattenI18n(obj: any, prefix = ""): Array<{ path: string; value: string }> {
  const items: Array<{ path: string; value: string }> = [];
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      items.push(...flattenI18n(v, prefix ? `${prefix}.${k}` : k));
    }
  } else if (Array.isArray(obj)) {
    items.push({ path: prefix, value: JSON.stringify(obj) });
  } else {
    items.push({ path: prefix, value: String(obj) });
  }
  return items;
}

function splitKey(flatKey: string): { page: string; section: string; key: string } {
  const parts = flatKey.split(".");
  if (parts.length === 1) return { page: parts[0], section: "general", key: "value" };
  if (parts.length === 2) return { page: parts[0], section: "general", key: parts[1] };
  return { page: parts[0], section: parts[1], key: parts.slice(2).join(".") };
}

function TypeIcon({ type }: { type: string }) {
  if (type === "link") return <LinkIcon className="h-3 w-3 text-blue-400" />;
  if (type === "image_url") return <ImageIcon className="h-3 w-3 text-green-400" />;
  return <Type className="h-3 w-3 text-muted-foreground" />;
}

function isValidUrl(str: string): boolean {
  if (!str.trim()) return true; // allow empty
  if (str.startsWith("/") || str.startsWith("#")) return true; // relative / anchor
  try { new URL(str.trim()); return true; } catch { return false; }
}

export default function CmsContentEditor() {
  const [dbBlocks, setDbBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sectionStatus, setSectionStatus] = useState<Record<string, "success" | "error" | null>>({});
  const { toast } = useToast();

  // Link pair edits: keyed by `page|section|labelKey|field|locale`
  const [linkEdits, setLinkEdits] = useState<Record<string, string>>({});

  const allContent = useMemo(() => {
    const map = new Map<string, { en: string; fr: string; type: string }>();
    for (const { path, value } of flattenI18n(en)) {
      const { page, section, key } = splitKey(path);
      const mapKey = `${page}|${section}|${key}`;
      const existing = map.get(mapKey) || { en: "", fr: "", type: "text" };
      existing.en = value;
      map.set(mapKey, existing);
    }
    for (const { path, value } of flattenI18n(fr)) {
      const { page, section, key } = splitKey(path);
      const mapKey = `${page}|${section}|${key}`;
      const existing = map.get(mapKey) || { en: "", fr: "", type: "text" };
      existing.fr = value;
      map.set(mapKey, existing);
    }
    for (const block of dbBlocks) {
      const mapKey = `${block.page}|${block.section}|${block.key}`;
      const existing = map.get(mapKey) || { en: "", fr: "", type: block.type };
      existing.type = block.type;
      if (block.locale === "en") existing.en = block.value;
      else existing.fr = block.value;
      map.set(mapKey, existing);
    }
    return map;
  }, [dbBlocks]);

  // Build link pairs from DB + defaults
  const linkPairsByPage = useMemo(() => {
    const result: Record<string, Array<{ labelKey: string; labelEn: string; labelFr: string; urlEn: string; urlFr: string }>> = {};
    for (const lp of LINK_PAIRS) {
      if (!result[lp.page]) result[lp.page] = [];
      // Check DB overrides
      const labelEnDb = dbBlocks.find(b => b.page === lp.page && b.section === "links" && b.key === `${lp.labelKey}_label` && b.locale === "en");
      const labelFrDb = dbBlocks.find(b => b.page === lp.page && b.section === "links" && b.key === `${lp.labelKey}_label` && b.locale === "fr");
      const urlEnDb = dbBlocks.find(b => b.page === lp.page && b.section === "links" && b.key === `${lp.labelKey}_url` && b.locale === "en");
      const urlFrDb = dbBlocks.find(b => b.page === lp.page && b.section === "links" && b.key === `${lp.labelKey}_url` && b.locale === "fr");
      result[lp.page].push({
        labelKey: lp.labelKey,
        labelEn: labelEnDb?.value ?? lp.labelEn,
        labelFr: labelFrDb?.value ?? lp.labelFr,
        urlEn: urlEnDb?.value ?? lp.url,
        urlFr: urlFrDb?.value ?? lp.url,
      });
    }
    return result;
  }, [dbBlocks]);

  const grouped = useMemo(() => {
    const result: Record<string, Record<string, Array<{ key: string; en: string; fr: string; type: string; mapKey: string }>>> = {};
    const searchLower = search.toLowerCase();
    for (const [mapKey, data] of allContent) {
      const [page, section, key] = mapKey.split("|");
      if (searchLower && !mapKey.toLowerCase().includes(searchLower) && !data.en.toLowerCase().includes(searchLower) && !data.fr.toLowerCase().includes(searchLower)) continue;
      if (!result[page]) result[page] = {};
      if (!result[page][section]) result[page][section] = [];
      result[page][section].push({ key, en: data.en, fr: data.fr, type: data.type, mapKey });
    }
    // Ensure pages with link pairs appear even if they have no i18n fields matching search
    for (const page of Object.keys(linkPairsByPage)) {
      if (!result[page]) result[page] = {};
    }
    return result;
  }, [allContent, search, linkPairsByPage]);

  const pages = useMemo(() => Object.keys(grouped).sort((a, b) => pageName(a).localeCompare(pageName(b))), [grouped]);

  useEffect(() => {
    if (pages.length > 0 && !selectedPage) setSelectedPage(pages[0]);
  }, [pages, selectedPage]);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("content_blocks").select("*").order("page");
    if (!error && data) setDbBlocks(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const getEditKey = (mapKey: string, locale: string) => `${mapKey}|${locale}`;
  const getDisplayValue = (mapKey: string, locale: string, original: string) => {
    const ek = getEditKey(mapKey, locale);
    return ek in edits ? edits[ek] : original;
  };
  const handleEdit = (mapKey: string, locale: string, value: string) => {
    setEdits(prev => ({ ...prev, [getEditKey(mapKey, locale)]: value }));
  };

  const getLinkEditKey = (page: string, labelKey: string, field: string, locale: string) =>
    `${page}|links|${labelKey}|${field}|${locale}`;

  const getLinkDisplayValue = (page: string, labelKey: string, field: string, locale: string, original: string) => {
    const ek = getLinkEditKey(page, labelKey, field, locale);
    return ek in linkEdits ? linkEdits[ek] : original;
  };

  const handleLinkEdit = (page: string, labelKey: string, field: string, locale: string, value: string) => {
    setLinkEdits(prev => ({ ...prev, [getLinkEditKey(page, labelKey, field, locale)]: value }));
  };

  const hasUnsavedLinks = (page: string) => {
    return Object.keys(linkEdits).some(ek => ek.startsWith(`${page}|links|`));
  };

  const saveLinkSection = async (page: string) => {
    const sectionKey = `${page}|links`;
    setSaving(sectionKey);
    let hasError = false;

    const relevantKeys = Object.keys(linkEdits).filter(ek => ek.startsWith(`${page}|links|`));

    // Validate URLs first
    for (const ek of relevantKeys) {
      const parts = ek.split("|");
      const field = parts[3]; // "label" or "url"
      if (field === "url") {
        const val = linkEdits[ek];
        if (!isValidUrl(val)) {
          toast({ title: "Invalid URL", description: `URL must be valid (e.g. /path or https://...)`, variant: "destructive" });
          hasError = true;
          break;
        }
      }
    }

    if (!hasError) {
      // Group by labelKey and save label+url together
      const pairEdits = new Map<string, { field: string; locale: string; value: string }[]>();
      for (const ek of relevantKeys) {
        const parts = ek.split("|");
        const labelKey = parts[2];
        const field = parts[3];
        const locale = parts[4];
        if (!pairEdits.has(labelKey)) pairEdits.set(labelKey, []);
        pairEdits.get(labelKey)!.push({ field, locale, value: linkEdits[ek] });
      }

      for (const [labelKey, fieldEdits] of pairEdits) {
        for (const { field, locale, value } of fieldEdits) {
          const dbKey = `${labelKey}_${field}`;
          const existing = dbBlocks.find(b => b.page === page && b.section === "links" && b.key === dbKey && b.locale === locale);
          const type = field === "url" ? "link" : "text";

          const result = existing
            ? await (supabase as any).from("content_blocks").update({ value, type, updated_at: new Date().toISOString() }).eq("id", existing.id)
            : await (supabase as any).from("content_blocks").insert({ page, section: "links", key: dbKey, type, locale, value });

          if (result.error) {
            hasError = true;
            toast({ title: "Save failed", description: result.error.message, variant: "destructive" });
          }
        }
      }
    }

    if (!hasError) {
      const clean = { ...linkEdits };
      relevantKeys.forEach(ek => delete clean[ek]);
      setLinkEdits(clean);
      await fetchBlocks();
      await reloadContentOverrides();
      setSectionStatus(prev => ({ ...prev, [sectionKey]: "success" }));
      setTimeout(() => setSectionStatus(prev => ({ ...prev, [sectionKey]: null })), 3000);
    } else {
      setSectionStatus(prev => ({ ...prev, [sectionKey]: "error" }));
      setTimeout(() => setSectionStatus(prev => ({ ...prev, [sectionKey]: null })), 3000);
    }
    setSaving(null);
  };

  const saveSection = async (page: string, section: string) => {
    const sectionKey = `${page}|${section}`;
    const prefix = `${page}|${section}|`;
    const relevantEdits = Object.keys(edits).filter(ek => ek.startsWith(prefix));
    if (relevantEdits.length === 0) return;

    setSaving(sectionKey);
    let hasError = false;

    for (const ek of relevantEdits) {
      const parts = ek.split("|");
      const locale = parts[3];
      const [p, s, k] = [parts[0], parts[1], parts[2]];
      const value = edits[ek];
      if (value === undefined) continue;

      const fieldType = allContent.get(`${p}|${s}|${k}`)?.type || "text";

      if (fieldType === "link" || fieldType === "image_url") {
        try {
          if (value.trim()) new URL(value.trim());
        } catch {
          toast({ title: "Invalid URL", description: `"${fieldLabel(k)}" must be a valid URL.`, variant: "destructive" });
          hasError = true;
          continue;
        }
      }

      const existing = dbBlocks.find(b => b.page === p && b.section === s && b.key === k && b.locale === locale);
      const result = existing
        ? await (supabase as any).from("content_blocks").update({ value, type: fieldType, updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await (supabase as any).from("content_blocks").insert({ page: p, section: s, key: k, type: fieldType, locale, value });

      if (result.error) {
        hasError = true;
        toast({ title: "Save failed", description: result.error.message, variant: "destructive" });
      }
    }

    if (!hasError) {
      const cleanEdits = { ...edits };
      relevantEdits.forEach(ek => delete cleanEdits[ek]);
      setEdits(cleanEdits);
      await fetchBlocks();
      await reloadContentOverrides();
      setSectionStatus(prev => ({ ...prev, [sectionKey]: "success" }));
      setTimeout(() => setSectionStatus(prev => ({ ...prev, [sectionKey]: null })), 3000);
    } else {
      setSectionStatus(prev => ({ ...prev, [sectionKey]: "error" }));
      setTimeout(() => setSectionStatus(prev => ({ ...prev, [sectionKey]: null })), 3000);
    }
    setSaving(null);
  };

  const hasUnsavedInSection = (page: string, section: string) => {
    const prefix = `${page}|${section}|`;
    return Object.keys(edits).some(ek => ek.startsWith(prefix) && edits[ek] !== undefined);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const currentSections = selectedPage && grouped[selectedPage]
    ? Object.keys(grouped[selectedPage]).filter(s => s !== "links").sort((a, b) => sectionName(a).localeCompare(sectionName(b)))
    : [];

  const currentLinkPairs = selectedPage ? (linkPairsByPage[selectedPage] || []) : [];

  return (
    <div className="flex h-full">
      {/* Left sidebar - page list */}
      <div className="w-52 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {pages.map(page => {
              const sections = Object.keys(grouped[page]);
              const fieldCount = sections.reduce((s, sec) => s + (grouped[page][sec]?.length || 0), 0);
              const linkCount = (linkPairsByPage[page] || []).length;
              return (
                <button
                  key={page}
                  onClick={() => setSelectedPage(page)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    selectedPage === page ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  <div className="font-medium">{pageName(page)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {fieldCount} fields{linkCount > 0 ? ` · ${linkCount} links` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right area - sections and fields */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPage ? (
          <>
            <div className="px-5 py-3 border-b border-border bg-card/50">
              <h2 className="text-sm font-bold text-foreground">{pageName(selectedPage)}</h2>
              <p className="text-[10px] text-muted-foreground">
                {currentSections.length} sections{currentLinkPairs.length > 0 ? ` · ${currentLinkPairs.length} link pairs` : ""} · Edit content for English and French
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Link pairs section */}
                {currentLinkPairs.length > 0 && (
                  <div className="border border-blue-500/30 rounded-lg bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/5 border-b border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-3.5 w-3.5 text-blue-400" />
                        <div>
                          <h3 className="text-xs font-bold text-foreground">Links & Buttons</h3>
                          <p className="text-[10px] text-muted-foreground">{currentLinkPairs.length} link pairs — label + URL</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sectionStatus[`${selectedPage}|links`] === "success" && <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                        {sectionStatus[`${selectedPage}|links`] === "error" && <span className="flex items-center gap-1 text-[10px] text-destructive font-medium"><XCircle className="h-3 w-3" /> Error</span>}
                        {hasUnsavedLinks(selectedPage) && (
                          <Button size="sm" className="h-7 text-[10px] px-3 gap-1" onClick={() => saveLinkSection(selectedPage)} disabled={saving === `${selectedPage}|links`}>
                            {saving === `${selectedPage}|links` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save All Links
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-border">
                      {currentLinkPairs.map(pair => {
                        const labelEn = getLinkDisplayValue(selectedPage, pair.labelKey, "label", "en", pair.labelEn);
                        const labelFr = getLinkDisplayValue(selectedPage, pair.labelKey, "label", "fr", pair.labelFr);
                        const urlEn = getLinkDisplayValue(selectedPage, pair.labelKey, "url", "en", pair.urlEn);
                        const urlFr = getLinkDisplayValue(selectedPage, pair.labelKey, "url", "fr", pair.urlFr);
                        const labelEnDirty = getLinkEditKey(selectedPage, pair.labelKey, "label", "en") in linkEdits;
                        const labelFrDirty = getLinkEditKey(selectedPage, pair.labelKey, "label", "fr") in linkEdits;
                        const urlEnDirty = getLinkEditKey(selectedPage, pair.labelKey, "url", "en") in linkEdits;
                        const urlFrDirty = getLinkEditKey(selectedPage, pair.labelKey, "url", "fr") in linkEdits;
                        const urlEnValid = isValidUrl(urlEn);
                        const urlFrValid = isValidUrl(urlFr);

                        return (
                          <div key={pair.labelKey} className="px-4 py-3 space-y-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <LinkIcon className="h-3 w-3 text-blue-400" />
                              <span className="text-[11px] font-semibold text-foreground">{humanize(pair.labelKey)}</span>
                            </div>

                            {/* Label row */}
                            <div>
                              <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">Button Label</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[9px] text-muted-foreground uppercase mb-0.5 block flex items-center gap-1"><Globe className="h-2 w-2" /> EN</span>
                                  <Input value={labelEn} onChange={e => handleLinkEdit(selectedPage, pair.labelKey, "label", "en", e.target.value)} className={`h-8 text-[11px] ${labelEnDirty ? "ring-1 ring-primary" : ""}`} />
                                </div>
                                <div>
                                  <span className="text-[9px] text-muted-foreground uppercase mb-0.5 block flex items-center gap-1"><Globe className="h-2 w-2" /> FR</span>
                                  <Input value={labelFr} onChange={e => handleLinkEdit(selectedPage, pair.labelKey, "label", "fr", e.target.value)} className={`h-8 text-[11px] ${labelFrDirty ? "ring-1 ring-primary" : ""}`} />
                                </div>
                              </div>
                            </div>

                            {/* URL row */}
                            <div>
                              <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">URL / Route</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Input type="url" value={urlEn} onChange={e => handleLinkEdit(selectedPage, pair.labelKey, "url", "en", e.target.value)} className={`h-8 text-[11px] ${urlEnDirty ? "ring-1 ring-primary" : ""} ${!urlEnValid ? "border-destructive ring-1 ring-destructive" : ""}`} placeholder="/path or https://..." />
                                  {!urlEnValid && <p className="text-[9px] text-destructive mt-0.5">Invalid URL format</p>}
                                </div>
                                <div>
                                  <Input type="url" value={urlFr} onChange={e => handleLinkEdit(selectedPage, pair.labelKey, "url", "fr", e.target.value)} className={`h-8 text-[11px] ${urlFrDirty ? "ring-1 ring-primary" : ""} ${!urlFrValid ? "border-destructive ring-1 ring-destructive" : ""}`} placeholder="/path or https://..." />
                                  {!urlFrValid && <p className="text-[9px] text-destructive mt-0.5">Invalid URL format</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Regular content sections */}
                {currentSections.map(section => {
                  const items = grouped[selectedPage][section];
                  if (!items || items.length === 0) return null;
                  const sectionKey = `${selectedPage}|${section}`;
                  const hasUnsaved = hasUnsavedInSection(selectedPage, section);
                  const status = sectionStatus[sectionKey];
                  const isSaving = saving === sectionKey;

                  return (
                    <div key={section} className="border border-border rounded-lg bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
                        <div>
                          <h3 className="text-xs font-bold text-foreground">{sectionName(section)}</h3>
                          <p className="text-[10px] text-muted-foreground">{items.length} fields</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === "success" && <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                          {status === "error" && <span className="flex items-center gap-1 text-[10px] text-destructive font-medium"><XCircle className="h-3 w-3" /> Error</span>}
                          {hasUnsaved && (
                            <Button size="sm" className="h-7 text-[10px] px-3 gap-1" onClick={() => saveSection(selectedPage, section)} disabled={isSaving}>
                              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save Section
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-border">
                        <div className="grid grid-cols-[180px_1fr_1fr] gap-3 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          <span>Field</span>
                          <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> English</span>
                          <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> French</span>
                        </div>

                        {items.map(item => {
                          const enVal = getDisplayValue(item.mapKey, "en", item.en);
                          const frVal = getDisplayValue(item.mapKey, "fr", item.fr);
                          const enDirty = getEditKey(item.mapKey, "en") in edits;
                          const frDirty = getEditKey(item.mapKey, "fr") in edits;
                          const isLong = item.en.length > 80 || item.fr.length > 80;

                          return (
                            <div key={item.key} className="px-4 py-2.5">
                              <div className="grid grid-cols-[180px_1fr_1fr] gap-3 items-start">
                                <div className="flex items-center gap-1.5 pt-1.5">
                                  <TypeIcon type={item.type} />
                                  <span className="text-[11px] text-foreground font-medium leading-tight" title={item.key}>
                                    {fieldLabel(item.key)}
                                  </span>
                                </div>

                                {isLong ? (
                                  <>
                                    <Textarea value={enVal} onChange={e => handleEdit(item.mapKey, "en", e.target.value)} className={`text-[11px] min-h-[60px] resize-y ${enDirty ? "ring-1 ring-primary" : ""}`} />
                                    <Textarea value={frVal} onChange={e => handleEdit(item.mapKey, "fr", e.target.value)} className={`text-[11px] min-h-[60px] resize-y ${frDirty ? "ring-1 ring-primary" : ""}`} />
                                  </>
                                ) : (
                                  <>
                                    <Input type={item.type === "link" || item.type === "image_url" ? "url" : "text"} value={enVal} onChange={e => handleEdit(item.mapKey, "en", e.target.value)} className={`h-8 text-[11px] ${enDirty ? "ring-1 ring-primary" : ""}`} />
                                    <Input type={item.type === "link" || item.type === "image_url" ? "url" : "text"} value={frVal} onChange={e => handleEdit(item.mapKey, "fr", e.target.value)} className={`h-8 text-[11px] ${frDirty ? "ring-1 ring-primary" : ""}`} />
                                  </>
                                )}
                              </div>

                              {item.type === "image_url" && (enVal || frVal) && (
                                <div className="mt-2 ml-[192px] flex gap-3">
                                  {enVal && <img src={enVal} alt="EN" className="h-16 rounded border border-border object-cover" onError={e => (e.currentTarget.style.display = "none")} />}
                                  {frVal && frVal !== enVal && <img src={frVal} alt="FR" className="h-16 rounded border border-border object-cover" onError={e => (e.currentTarget.style.display = "none")} />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a page to edit content
          </div>
        )}
      </div>
    </div>
  );
}