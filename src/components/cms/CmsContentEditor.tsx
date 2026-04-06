import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { reloadContentOverrides } from "@/hooks/useContentOverrides";
import { Search, Save, Loader2, Globe, Image as ImageIcon, Link as LinkIcon, Type, CheckCircle2, XCircle, FileText, Layout, AlertCircle } from "lucide-react";
import en from "@/i18n/en.json";
import fr from "@/i18n/fr.json";
import { type CmsPageRecord, slugToContentKey } from "./cmsPages";
import { normalizeLayoutBlocks } from "./cmsLayout";

interface ContentBlock {
  id?: string;
  page: string;
  section: string;
  key: string;
  type: string;
  locale: string;
  value: string;
}

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
  controls: "Controls & Labels",
  coaching_cta: "Coaching CTA",
  footer_legal: "Footer / Legal",
  main: "Main",
};

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
  if (!str.trim()) return true;
  if (str.startsWith("/") || str.startsWith("#")) return true;
  try { new URL(str.trim()); return true; } catch { return false; }
}

interface CmsContentEditorProps {
  pages: CmsPageRecord[];
  activePage: CmsPageRecord | null;
  onSelectPage: (page: CmsPageRecord) => void;
  refreshPages: () => Promise<void>;
}

export default function CmsContentEditor({ pages, activePage, onSelectPage, refreshPages }: CmsContentEditorProps) {
  const [dbBlocks, setDbBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sectionStatus, setSectionStatus] = useState<Record<string, "success" | "error" | null>>({});
  const [linkEdits, setLinkEdits] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Fetch content_blocks from DB
  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("content_blocks").select("*").order("page");
    if (!error && data) setDbBlocks(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  useEffect(() => {
    setEdits({});
    setLinkEdits({});
    setSectionStatus({});
    setSaving(null);
  }, [activePage?.slug]);

  // Build i18n content map keyed by contentKey (for app pages)
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

  const linkPairsByPage = useMemo(() => {
    const result: Record<string, Array<{ labelKey: string; labelEn: string; labelFr: string; urlEn: string; urlFr: string }>> = {};
    for (const lp of LINK_PAIRS) {
      if (!result[lp.page]) result[lp.page] = [];
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

  // Resolve selected page's contentKey for i18n lookup
  const selectedContentKey = activePage ? slugToContentKey(activePage.slug) : null;

  // Build grouped content for app pages via i18n
  const appGrouped = useMemo(() => {
    if (!selectedContentKey || activePage?.source !== "app") return null;
    const result: Record<string, Array<{ key: string; en: string; fr: string; type: string; mapKey: string }>> = {};
    const searchLower = search.toLowerCase();
    for (const [mapKey, data] of allContent) {
      const [page, section, key] = mapKey.split("|");
      if (page !== selectedContentKey) continue;
      if (searchLower && !mapKey.toLowerCase().includes(searchLower) && !data.en.toLowerCase().includes(searchLower) && !data.fr.toLowerCase().includes(searchLower)) continue;
      if (!result[section]) result[section] = [];
      result[section].push({ key, en: data.en, fr: data.fr, type: data.type, mapKey });
    }
    return result;
  }, [allContent, selectedContentKey, activePage, search]);

  // Build block-instance content for custom pages — keyed by blockId
  const customBlockFields = useMemo(() => {
    if (!activePage || activePage.source !== "custom") return null;
    const blocks = normalizeLayoutBlocks(activePage.blocks || [], activePage.slug);
    if (blocks.length === 0) return [];
    return blocks.map((block) => ({
      blockId: block.id,
      blockName: block.name || block.blockType || "Block",
      blockType: block.blockType,
      fields: (block.fields || []).map((f) => ({
        key: f.key,
        label: f.label || humanize(f.key),
        type: f.type || "text",
        en: block.content?.[f.key]?.en || "",
        fr: block.content?.[f.key]?.fr || "",
      })),
    }));
  }, [activePage]);

  // Edit key helpers
  const getEditKey = (mapKey: string, locale: string) => `${mapKey}|${locale}`;
  const getDisplayValue = (mapKey: string, locale: string, original: string) => {
    const ek = getEditKey(mapKey, locale);
    return ek in edits ? edits[ek] : original;
  };
  const handleEdit = (mapKey: string, locale: string, value: string) => {
    setEdits(prev => ({ ...prev, [getEditKey(mapKey, locale)]: value }));
  };

  // Custom page block edits — keyed by blockId|fieldKey|locale
  const getBlockEditKey = (blockId: string, fieldKey: string, locale: string) => `block|${blockId}|${fieldKey}|${locale}`;
  const getBlockDisplayValue = (blockId: string, fieldKey: string, locale: string, original: string) => {
    const ek = getBlockEditKey(blockId, fieldKey, locale);
    return ek in edits ? edits[ek] : original;
  };
  const handleBlockEdit = (blockId: string, fieldKey: string, locale: string, value: string) => {
    setEdits(prev => ({ ...prev, [getBlockEditKey(blockId, fieldKey, locale)]: value }));
  };

  // Link pair helpers
  const getLinkEditKey = (page: string, labelKey: string, field: string, locale: string) =>
    `${page}|links|${labelKey}|${field}|${locale}`;
  const getLinkDisplayValue = (page: string, labelKey: string, field: string, locale: string, original: string) => {
    const ek = getLinkEditKey(page, labelKey, field, locale);
    return ek in linkEdits ? linkEdits[ek] : original;
  };
  const handleLinkEdit = (page: string, labelKey: string, field: string, locale: string, value: string) => {
    setLinkEdits(prev => ({ ...prev, [getLinkEditKey(page, labelKey, field, locale)]: value }));
  };
  const hasUnsavedLinks = (page: string) => Object.keys(linkEdits).some(ek => ek.startsWith(`${page}|links|`));

  const saveLinkSection = async (contentKey: string) => {
    const sectionKey = `${contentKey}|links`;
    setSaving(sectionKey);
    let hasError = false;
    const relevantKeys = Object.keys(linkEdits).filter(ek => ek.startsWith(`${contentKey}|links|`));
    for (const ek of relevantKeys) {
      const parts = ek.split("|");
      const field = parts[3];
      if (field === "url" && !isValidUrl(linkEdits[ek])) {
        toast({ title: "Invalid URL", description: "URL must be valid", variant: "destructive" });
        hasError = true;
        break;
      }
    }
    if (!hasError) {
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
          const existing = dbBlocks.find(b => b.page === contentKey && b.section === "links" && b.key === dbKey && b.locale === locale);
          const type = field === "url" ? "link" : "text";
          const result = existing
            ? await (supabase as any).from("content_blocks").update({ value, type, updated_at: new Date().toISOString() }).eq("id", existing.id)
            : await (supabase as any).from("content_blocks").insert({ page: contentKey, section: "links", key: dbKey, type, locale, value });
          if (result.error) { hasError = true; toast({ title: "Save failed", description: result.error.message, variant: "destructive" }); }
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

  // Save app page section
  const saveAppSection = async (contentKey: string, section: string) => {
    const sectionKey = `${contentKey}|${section}`;
    const prefix = `${contentKey}|${section}|`;
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
      const existing = dbBlocks.find(b => b.page === p && b.section === s && b.key === k && b.locale === locale);
      const result = existing
        ? await (supabase as any).from("content_blocks").update({ value, type: fieldType, updated_at: new Date().toISOString() }).eq("id", existing.id)
        : await (supabase as any).from("content_blocks").insert({ page: p, section: s, key: k, type: fieldType, locale, value });
      if (result.error) { hasError = true; toast({ title: "Save failed", description: result.error.message, variant: "destructive" }); }
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

  // Save custom page blocks
  const saveCustomBlocks = async () => {
    if (!activePage?.pageLayoutId) return;
    const prefix = "block|";
    const relevantEdits = Object.keys(edits).filter(ek => ek.startsWith(prefix));
    if (relevantEdits.length === 0) return;
    setSaving("custom-blocks");
    const updatedBlocks = normalizeLayoutBlocks(activePage.blocks || [], activePage.slug);
    for (const ek of relevantEdits) {
      const parts = ek.split("|");
      const blockId = parts[1];
      const fieldKey = parts[2];
      const locale = parts[3] as "en" | "fr";
      const value = edits[ek];
      const block = updatedBlocks.find((b) => b.id === blockId);
      if (block) {
        if (!block.content) block.content = {};
        if (!block.content[fieldKey]) block.content[fieldKey] = { en: "", fr: "" };
        block.content[fieldKey][locale] = value;
      }
    }
    const { error } = await (supabase as any).from("page_layouts")
      .update({ blocks: updatedBlocks, updated_at: new Date().toISOString() })
      .eq("id", activePage.pageLayoutId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      setSectionStatus(prev => ({ ...prev, ["custom-blocks"]: "error" }));
    } else {
      const cleanEdits = { ...edits };
      relevantEdits.forEach(ek => delete cleanEdits[ek]);
      setEdits(cleanEdits);
      await refreshPages();
      setSectionStatus(prev => ({ ...prev, ["custom-blocks"]: "success" }));
      setTimeout(() => setSectionStatus(prev => ({ ...prev, ["custom-blocks"]: null })), 3000);
    }
    setSaving(null);
  };

  const hasUnsavedInSection = (contentKey: string, section: string) => {
    const prefix = `${contentKey}|${section}|`;
    return Object.keys(edits).some(ek => ek.startsWith(prefix) && edits[ek] !== undefined);
  };

  const hasUnsavedBlockEdits = Object.keys(edits).some(ek => ek.startsWith("block|"));

  // Filter sidebar pages by search
  const filteredPages = useMemo(() => {
    if (!search) return pages;
    const s = search.toLowerCase();
    return pages.filter(p => p.title.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s));
  }, [pages, search]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const currentLinkPairs = selectedContentKey ? (linkPairsByPage[selectedContentKey] || []) : [];
  const currentSections = appGrouped
    ? Object.keys(appGrouped).filter(s => s !== "links").sort((a, b) => sectionName(a).localeCompare(sectionName(b)))
    : [];

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-52 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1">App Pages</p>
            {filteredPages.filter(p => p.source === "app").map(page => (
              <button
                key={page.slug}
                onClick={() => onSelectPage(page)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                  activePage?.slug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50 text-foreground"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layout className="h-3 w-3 shrink-0" />
                  <span className="truncate">{page.title}</span>
                </div>
              </button>
            ))}

            {filteredPages.some(p => p.source === "custom") && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-3 pb-1">Custom Pages</p>
                {filteredPages.filter(p => p.source === "custom").map(page => (
                  <button
                    key={page.slug}
                    onClick={() => onSelectPage(page)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                      activePage?.slug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{page.title}</span>
                      {page.isPublished && <Globe className="h-2.5 w-2.5 text-green-500 ml-auto shrink-0" />}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activePage ? (
          <>
            <div className="px-5 py-3 border-b border-border bg-card/50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">{activePage.title}</h2>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${activePage.source === "app" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                  {activePage.source === "app" ? "App" : "Custom"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {activePage.source === "app"
                  ? `${currentSections.length} sections${currentLinkPairs.length > 0 ? ` · ${currentLinkPairs.length} link pairs` : ""} · Edit content for English and French`
                  : `${activePage.blocks.length} block${activePage.blocks.length !== 1 ? "s" : ""} · Edit block content`
                }
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* ---- APP PAGE CONTENT ---- */}
                {activePage.source === "app" && (
                  <>
                    {/* Link pairs */}
                    {currentLinkPairs.length > 0 && (
                      <div className="border border-blue-500/30 rounded-lg bg-card overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-500/5 border-b border-blue-500/20">
                          <div className="flex items-center gap-2">
                            <LinkIcon className="h-3.5 w-3.5 text-blue-400" />
                            <div>
                              <h3 className="text-xs font-bold text-foreground">Links & Buttons</h3>
                              <p className="text-[10px] text-muted-foreground">{currentLinkPairs.length} link pairs</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {sectionStatus[`${selectedContentKey}|links`] === "success" && <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                            {hasUnsavedLinks(selectedContentKey!) && (
                              <Button size="sm" className="h-7 text-[10px] px-3 gap-1" onClick={() => saveLinkSection(selectedContentKey!)} disabled={saving === `${selectedContentKey}|links`}>
                                {saving === `${selectedContentKey}|links` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save All Links
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="divide-y divide-border">
                          {currentLinkPairs.map(pair => {
                            const labelEn = getLinkDisplayValue(selectedContentKey!, pair.labelKey, "label", "en", pair.labelEn);
                            const labelFr = getLinkDisplayValue(selectedContentKey!, pair.labelKey, "label", "fr", pair.labelFr);
                            const urlEn = getLinkDisplayValue(selectedContentKey!, pair.labelKey, "url", "en", pair.urlEn);
                            const urlFr = getLinkDisplayValue(selectedContentKey!, pair.labelKey, "url", "fr", pair.urlFr);
                            const labelEnDirty = getLinkEditKey(selectedContentKey!, pair.labelKey, "label", "en") in linkEdits;
                            const labelFrDirty = getLinkEditKey(selectedContentKey!, pair.labelKey, "label", "fr") in linkEdits;
                            const urlEnDirty = getLinkEditKey(selectedContentKey!, pair.labelKey, "url", "en") in linkEdits;
                            const urlFrDirty = getLinkEditKey(selectedContentKey!, pair.labelKey, "url", "fr") in linkEdits;
                            return (
                              <div key={pair.labelKey} className="px-4 py-3 space-y-2">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <LinkIcon className="h-3 w-3 text-blue-400" />
                                  <span className="text-[11px] font-semibold text-foreground">{humanize(pair.labelKey)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">Button Label</span>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5 block flex items-center gap-1"><Globe className="h-2 w-2" /> EN</span>
                                      <Input value={labelEn} onChange={e => handleLinkEdit(selectedContentKey!, pair.labelKey, "label", "en", e.target.value)} className={`h-8 text-[11px] ${labelEnDirty ? "ring-1 ring-primary" : ""}`} />
                                    </div>
                                    <div>
                                      <span className="text-[9px] text-muted-foreground uppercase mb-0.5 block flex items-center gap-1"><Globe className="h-2 w-2" /> FR</span>
                                      <Input value={labelFr} onChange={e => handleLinkEdit(selectedContentKey!, pair.labelKey, "label", "fr", e.target.value)} className={`h-8 text-[11px] ${labelFrDirty ? "ring-1 ring-primary" : ""}`} />
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">URL / Route</span>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input type="url" value={urlEn} onChange={e => handleLinkEdit(selectedContentKey!, pair.labelKey, "url", "en", e.target.value)} className={`h-8 text-[11px] ${urlEnDirty ? "ring-1 ring-primary" : ""}`} placeholder="/path or https://..." />
                                    <Input type="url" value={urlFr} onChange={e => handleLinkEdit(selectedContentKey!, pair.labelKey, "url", "fr", e.target.value)} className={`h-8 text-[11px] ${urlFrDirty ? "ring-1 ring-primary" : ""}`} placeholder="/path or https://..." />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Regular i18n sections */}
                    {currentSections.map(section => {
                      const items = appGrouped![section];
                      if (!items || items.length === 0) return null;
                      const sectionKey = `${selectedContentKey}|${section}`;
                      const hasUnsaved = hasUnsavedInSection(selectedContentKey!, section);
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
                                <Button size="sm" className="h-7 text-[10px] px-3 gap-1" onClick={() => saveAppSection(selectedContentKey!, section)} disabled={isSaving}>
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
                                      <span className="text-[11px] text-foreground font-medium leading-tight" title={item.key}>{fieldLabel(item.key)}</span>
                                    </div>
                                    {isLong ? (
                                      <>
                                        <Textarea value={enVal} onChange={e => handleEdit(item.mapKey, "en", e.target.value)} className={`text-[11px] min-h-[60px] resize-y ${enDirty ? "ring-1 ring-primary" : ""}`} />
                                        <Textarea value={frVal} onChange={e => handleEdit(item.mapKey, "fr", e.target.value)} className={`text-[11px] min-h-[60px] resize-y ${frDirty ? "ring-1 ring-primary" : ""}`} />
                                      </>
                                    ) : (
                                      <>
                                        <Input value={enVal} onChange={e => handleEdit(item.mapKey, "en", e.target.value)} className={`h-8 text-[11px] ${enDirty ? "ring-1 ring-primary" : ""}`} />
                                        <Input value={frVal} onChange={e => handleEdit(item.mapKey, "fr", e.target.value)} className={`h-8 text-[11px] ${frDirty ? "ring-1 ring-primary" : ""}`} />
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

                    {currentSections.length === 0 && currentLinkPairs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">No editable content found</p>
                        <p className="text-xs text-muted-foreground">This app page has no i18n strings. Content is likely hardcoded.</p>
                      </div>
                    )}
                  </>
                )}

                {/* ---- CUSTOM PAGE CONTENT ---- */}
                {activePage.source === "custom" && (
                  <>
                    {customBlockFields && customBlockFields.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{customBlockFields.length} block{customBlockFields.length !== 1 ? "s" : ""} — edit content below</p>
                          <div className="flex items-center gap-2">
                            {sectionStatus["custom-blocks"] === "success" && <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                            {hasUnsavedBlockEdits && (
                              <Button size="sm" className="h-7 text-[10px] px-3 gap-1" onClick={saveCustomBlocks} disabled={saving === "custom-blocks"}>
                                {saving === "custom-blocks" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save All Blocks
                              </Button>
                            )}
                          </div>
                        </div>

                        {customBlockFields.map((block: any) => (
                          <div key={block.blockId} className="border border-border rounded-lg bg-card overflow-hidden">
                            <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
                              <h3 className="text-xs font-bold text-foreground">{block.blockName}</h3>
                              {block.blockType && <p className="text-[10px] text-muted-foreground">{block.blockType}</p>}
                            </div>
                            <div className="p-3 space-y-2">
                              {block.fields.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic">No editable fields (e.g. spacer)</p>
                              ) : (
                                block.fields.map((field: any) => {
                                  const enVal = getBlockDisplayValue(block.blockId, field.key, "en", field.en);
                                  const frVal = getBlockDisplayValue(block.blockId, field.key, "fr", field.fr);
                                  const enDirty = getBlockEditKey(block.blockId, field.key, "en") in edits;
                                  const frDirty = getBlockEditKey(block.blockId, field.key, "fr") in edits;
                                  const isLong = field.en.length > 80 || field.fr.length > 80;
                                  return (
                                    <div key={field.key}>
                                      <label className="text-[10px] font-medium text-foreground mb-0.5 block">{field.label}</label>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div>
                                          <span className="text-[8px] text-muted-foreground uppercase block">EN</span>
                                          {isLong ? (
                                            <Textarea value={enVal} onChange={e => handleBlockEdit(block.blockId, field.key, "en", e.target.value)} className={`text-[10px] min-h-[40px] resize-y ${enDirty ? "ring-1 ring-primary" : ""}`} placeholder="English..." />
                                          ) : (
                                            <Input value={enVal} onChange={e => handleBlockEdit(block.blockId, field.key, "en", e.target.value)} className={`h-7 text-[10px] ${enDirty ? "ring-1 ring-primary" : ""}`} placeholder="EN..." />
                                          )}
                                        </div>
                                        <div>
                                          <span className="text-[8px] text-muted-foreground uppercase block">FR</span>
                                          {isLong ? (
                                            <Textarea value={frVal} onChange={e => handleBlockEdit(block.blockId, field.key, "fr", e.target.value)} className={`text-[10px] min-h-[40px] resize-y ${frDirty ? "ring-1 ring-primary" : ""}`} placeholder="French..." />
                                          ) : (
                                            <Input value={frVal} onChange={e => handleBlockEdit(block.blockId, field.key, "fr", e.target.value)} className={`h-7 text-[10px] ${frDirty ? "ring-1 ring-primary" : ""}`} placeholder="FR..." />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">This page has no editable content yet</p>
                        <p className="text-xs text-muted-foreground">Create layout blocks in the Layout Builder tab, then return here to edit content.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Select a page to edit content</p>
          </div>
        )}
      </div>
    </div>
  );
}
