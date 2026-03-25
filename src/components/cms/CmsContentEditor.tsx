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
};

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

export default function CmsContentEditor() {
  const [dbBlocks, setDbBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sectionStatus, setSectionStatus] = useState<Record<string, "success" | "error" | null>>({});
  const { toast } = useToast();

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
    return result;
  }, [allContent, search]);

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

  const currentSections = selectedPage && grouped[selectedPage] ? Object.keys(grouped[selectedPage]).sort((a, b) => sectionName(a).localeCompare(sectionName(b))) : [];

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
              const fieldCount = sections.reduce((s, sec) => s + grouped[page][sec].length, 0);
              return (
                <button
                  key={page}
                  onClick={() => setSelectedPage(page)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                    selectedPage === page ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50 text-foreground"
                  }`}
                >
                  <div className="font-medium">{pageName(page)}</div>
                  <div className="text-[10px] text-muted-foreground">{fieldCount} fields</div>
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
              <p className="text-[10px] text-muted-foreground">{currentSections.length} sections · Edit content for English and French</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {currentSections.map(section => {
                  const items = grouped[selectedPage][section];
                  const sectionKey = `${selectedPage}|${section}`;
                  const hasUnsaved = hasUnsavedInSection(selectedPage, section);
                  const status = sectionStatus[sectionKey];
                  const isSaving = saving === sectionKey;

                  return (
                    <div key={section} className="border border-border rounded-lg bg-card overflow-hidden">
                      {/* Section header */}
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

                      {/* Fields */}
                      <div className="divide-y divide-border">
                        {/* Column headers */}
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

                              {/* Image preview */}
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
