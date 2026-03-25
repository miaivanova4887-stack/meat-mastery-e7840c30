import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { reloadContentOverrides } from "@/hooks/useContentOverrides";
import { Search, Save, Loader2, ChevronDown, ChevronRight, Globe, Image as ImageIcon, Link as LinkIcon, Type } from "lucide-react";
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

// Flatten i18n JSON to page/section/key format
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

// Type icon
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
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Build complete content map from i18n defaults + DB overrides
  const allContent = useMemo(() => {
    const map = new Map<string, { en: string; fr: string; type: string; dbId?: { en?: string; fr?: string } }>();

    // Add all i18n keys
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

    // Override with DB values
    for (const block of dbBlocks) {
      const mapKey = `${block.page}|${block.section}|${block.key}`;
      const existing = map.get(mapKey) || { en: "", fr: "", type: block.type };
      existing.type = block.type;
      if (block.locale === "en") {
        existing.en = block.value;
        if (!existing.dbId) existing.dbId = {};
        existing.dbId.en = block.id;
      } else {
        existing.fr = block.value;
        if (!existing.dbId) existing.dbId = {};
        existing.dbId.fr = block.id;
      }
      map.set(mapKey, existing);
    }

    return map;
  }, [dbBlocks]);

  // Group by page → section
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

  const pages = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("content_blocks")
      .select("*")
      .order("page");
    if (!error && data) setDbBlocks(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  const togglePage = (page: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      next.has(page) ? next.delete(page) : next.add(page);
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getEditKey = (mapKey: string, locale: string) => `${mapKey}|${locale}`;

  const getDisplayValue = (mapKey: string, locale: string, original: string) => {
    const ek = getEditKey(mapKey, locale);
    return ek in edits ? edits[ek] : original;
  };

  const handleEdit = (mapKey: string, locale: string, value: string) => {
    setEdits(prev => ({ ...prev, [getEditKey(mapKey, locale)]: value }));
  };

  const saveField = async (mapKey: string, locale: string) => {
    const [page, section, key] = mapKey.split("|");
    const ek = getEditKey(mapKey, locale);
    const value = edits[ek];
    if (value === undefined) return;

    const fieldType = allContent.get(mapKey)?.type || "text";

    // Validate URLs
    if (fieldType === "link" || fieldType === "image_url") {
      try {
        if (value.trim()) new URL(value.trim());
      } catch {
        toast({ title: "Invalid URL", description: "Please enter a valid URL.", variant: "destructive" });
        return;
      }
    }

    setSaving(ek);

    const existing = dbBlocks.find(b => b.page === page && b.section === section && b.key === key && b.locale === locale);

    if (existing) {
      const { error } = await (supabase as any)
        .from("content_blocks")
        .update({ value, type: fieldType, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Saved!" });
        setEdits(prev => { const n = { ...prev }; delete n[ek]; return n; });
        await fetchBlocks();
        await reloadContentOverrides();
      }
    } else {
      const { error } = await (supabase as any)
        .from("content_blocks")
        .insert({ page, section, key, type: fieldType, locale, value });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Saved!" });
        setEdits(prev => { const n = { ...prev }; delete n[ek]; return n; });
        await fetchBlocks();
        await reloadContentOverrides();
      }
    }

    setSaving(null);
  };

  const saveSection = async (page: string, section: string) => {
    const prefix = `${page}|${section}|`;
    const relevantEdits = Object.keys(edits).filter(ek => ek.startsWith(prefix));
    if (relevantEdits.length === 0) return;

    for (const ek of relevantEdits) {
      const parts = ek.split("|");
      const locale = parts[3];
      const mapKey = parts.slice(0, 3).join("|");
      await saveField(mapKey, locale);
    }
  };

  const hasUnsavedInSection = (page: string, section: string) => {
    const prefix = `${page}|${section}|`;
    return Object.keys(edits).some(ek => ek.startsWith(prefix) && edits[ek] !== undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {allContent.size} fields across {pages.length} pages
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {pages.map(page => {
            const isPageExpanded = expandedPages.has(page) || !!search;
            const sections = Object.keys(grouped[page]).sort();
            const totalKeys = sections.reduce((sum, s) => sum + grouped[page][s].length, 0);

            return (
              <div key={page} className="border border-border rounded-md bg-card overflow-hidden">
                {/* Page header */}
                <button
                  onClick={() => togglePage(page)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors"
                >
                  {isPageExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">{page}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{totalKeys} fields</span>
                </button>

                {isPageExpanded && (
                  <div className="border-t border-border">
                    {sections.map(section => {
                      const sectionId = `${page}|${section}`;
                      const isSectionExpanded = expandedSections.has(sectionId) || !!search;
                      const items = grouped[page][section];
                      const hasUnsaved = hasUnsavedInSection(page, section);

                      return (
                        <div key={section} className="border-b border-border last:border-b-0">
                          {/* Section header */}
                          <button
                            onClick={() => toggleSection(sectionId)}
                            className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-accent/30 transition-colors"
                          >
                            {isSectionExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-[11px] font-semibold text-foreground/80">{section}</span>
                            <span className="text-[10px] text-muted-foreground">{items.length}</span>
                            {hasUnsaved && (
                              <Button
                                size="sm"
                                variant="default"
                                className="ml-auto h-5 text-[10px] px-2"
                                onClick={e => { e.stopPropagation(); saveSection(page, section); }}
                              >
                                <Save className="h-2.5 w-2.5 mr-1" /> Save Section
                              </Button>
                            )}
                          </button>

                          {isSectionExpanded && (
                            <div className="px-4 pb-2 space-y-2">
                              {/* Table header */}
                              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                                <span>Key</span>
                                <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> EN</span>
                                <span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> FR</span>
                                <span></span>
                              </div>

                              {items.map(item => {
                                const enVal = getDisplayValue(item.mapKey, "en", item.en);
                                const frVal = getDisplayValue(item.mapKey, "fr", item.fr);
                                const enDirty = getEditKey(item.mapKey, "en") in edits;
                                const frDirty = getEditKey(item.mapKey, "fr") in edits;
                                const isLong = item.en.length > 80 || item.fr.length > 80;

                                return (
                                  <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)_auto] gap-2 items-start">
                                    <div className="flex items-center gap-1 pt-1.5">
                                      <TypeIcon type={item.type} />
                                      <span className="text-[10px] text-muted-foreground truncate" title={item.key}>{item.key}</span>
                                    </div>

                                    {isLong ? (
                                      <>
                                        <Textarea
                                          value={enVal}
                                          onChange={e => handleEdit(item.mapKey, "en", e.target.value)}
                                          className={`text-[11px] min-h-[60px] resize-y ${enDirty ? "border-primary" : ""}`}
                                        />
                                        <Textarea
                                          value={frVal}
                                          onChange={e => handleEdit(item.mapKey, "fr", e.target.value)}
                                          className={`text-[11px] min-h-[60px] resize-y ${frDirty ? "border-primary" : ""}`}
                                        />
                                      </>
                                    ) : (
                                      <>
                                        <Input
                                          type={item.type === "link" || item.type === "image_url" ? "url" : "text"}
                                          value={enVal}
                                          onChange={e => handleEdit(item.mapKey, "en", e.target.value)}
                                          className={`h-7 text-[11px] ${enDirty ? "border-primary" : ""}`}
                                        />
                                        <Input
                                          type={item.type === "link" || item.type === "image_url" ? "url" : "text"}
                                          value={frVal}
                                          onChange={e => handleEdit(item.mapKey, "fr", e.target.value)}
                                          className={`h-7 text-[11px] ${frDirty ? "border-primary" : ""}`}
                                        />
                                      </>
                                    )}

                                    <div className="flex gap-0.5 pt-1">
                                      {(enDirty || frDirty) && (
                                        <>
                                          {enDirty && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5"
                                              disabled={saving === getEditKey(item.mapKey, "en")}
                                              onClick={() => saveField(item.mapKey, "en")}
                                            >
                                              {saving === getEditKey(item.mapKey, "en") ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                                            </Button>
                                          )}
                                          {frDirty && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5"
                                              disabled={saving === getEditKey(item.mapKey, "fr")}
                                              onClick={() => saveField(item.mapKey, "fr")}
                                            >
                                              {saving === getEditKey(item.mapKey, "fr") ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                                            </Button>
                                          )}
                                        </>
                                      )}
                                    </div>

                                    {/* Image preview for image_url type */}
                                    {item.type === "image_url" && enVal && (
                                      <div className="col-span-4 flex gap-2">
                                        <img src={enVal} alt="EN preview" className="h-12 rounded border border-border object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                                        {frVal && <img src={frVal} alt="FR preview" className="h-12 rounded border border-border object-cover" onError={e => (e.currentTarget.style.display = "none")} />}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
