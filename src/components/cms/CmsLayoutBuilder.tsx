import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, GripVertical, Layout, FileText, Globe, CheckCircle2, Eye } from "lucide-react";

interface BlockField {
  key: string;
  label: string;
  type: "text" | "link" | "image_url";
}

interface LayoutBlock {
  id: string;
  name: string;
  fields: BlockField[];
  content?: Record<string, { en: string; fr: string }>;
}

interface PageLayout {
  id?: string;
  page_slug: string;
  title: string;
  blocks: LayoutBlock[];
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

const APP_PAGES = [
  { title: "Home", slug: "home", route: "/" },
  { title: "Benefits", slug: "benefits", route: "/benefits" },
  { title: "Recipes", slug: "recipes", route: "/recipes" },
  { title: "Ketosis Timer", slug: "timer", route: "/timer" },
  { title: "Meal Plan", slug: "meal-plan", route: "/meal-plan" },
  { title: "Ingredients", slug: "ingredients", route: "/ingredients" },
  { title: "Exercise", slug: "exercise", route: "/exercise" },
  { title: "Cravings", slug: "cravings", route: "/cravings" },
  { title: "Sustain Results", slug: "sustain", route: "/sustain" },
  { title: "Myths Busted", slug: "myths", route: "/myths" },
  { title: "Complete Guide", slug: "guide", route: "/guide" },
  { title: "First 30 Days", slug: "getting-started", route: "/getting-started" },
  { title: "Budget Eating", slug: "budget", route: "/budget" },
  { title: "Athletic Performance", slug: "athletic", route: "/athletic" },
  { title: "Community", slug: "community", route: "/community" },
  { title: "Progress", slug: "progress", route: "/progress" },
  { title: "News Feed", slug: "news", route: "/news" },
  { title: "Profile", slug: "profile", route: "/profile" },
];

let blockIdCounter = 0;
function newBlockId() { return `block_${Date.now()}_${blockIdCounter++}`; }

export default function CmsLayoutBuilder() {
  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [currentBlocks, setCurrentBlocks] = useState<LayoutBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockFields, setNewBlockFields] = useState<BlockField[]>([{ key: "title", label: "Title", type: "text" }]);
  const [saved, setSaved] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchLayouts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("page_layouts").select("*").order("title");
    if (!error && data) setLayouts(data.map((l: any) => ({ ...l, blocks: l.blocks || [] })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchLayouts(); }, [fetchLayouts]);

  const selectPage = async (slug: string) => {
    setSelectedSlug(slug);
    setInsertIndex(null);

    // Load blocks from content_blocks table grouped by section
    const { data: cbData } = await (supabase as any)
      .from("content_blocks")
      .select("section, key, type, locale, value")
      .eq("page", slug)
      .order("section");

    const layout = layouts.find(l => l.page_slug === slug);
    const layoutBlocks: LayoutBlock[] = layout?.blocks || [];

    if (cbData && cbData.length > 0) {
      // Group by section
      const sectionMap: Record<string, { fields: Map<string, { type: string; en: string; fr: string }>; }> = {};
      for (const row of cbData) {
        if (!sectionMap[row.section]) sectionMap[row.section] = { fields: new Map() };
        const sec = sectionMap[row.section];
        if (!sec.fields.has(row.key)) sec.fields.set(row.key, { type: row.type, en: "", fr: "" });
        const f = sec.fields.get(row.key)!;
        if (row.locale === "en") f.en = row.value;
        else if (row.locale === "fr") f.fr = row.value;
      }

      // Build blocks from content_blocks, merging with any existing layout blocks
      const existingIds = new Set(layoutBlocks.map(b => b.name));
      const contentBlocks: LayoutBlock[] = [];

      for (const [section, data] of Object.entries(sectionMap)) {
        // Check if layout already has this block
        const existing = layoutBlocks.find(b => b.name === section);
        const fields: BlockField[] = [];
        const content: Record<string, { en: string; fr: string }> = {};

        for (const [key, val] of data.fields.entries()) {
          const label = key.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          fields.push({ key, label, type: val.type as any });
          content[key] = { en: val.en, fr: val.fr };
        }

        contentBlocks.push({
          id: existing?.id || `cb_${section}`,
          name: section,
          fields,
          content,
        });
      }

      // Add any layout-only blocks that aren't in content_blocks
      for (const lb of layoutBlocks) {
        if (!sectionMap[lb.name]) contentBlocks.push(lb);
      }

      setCurrentBlocks(contentBlocks);
    } else {
      setCurrentBlocks(layoutBlocks);
    }
  };

  const allPages = useMemo(() => [
    ...APP_PAGES.map(p => ({ ...p, isApp: true, layout: layouts.find(l => l.page_slug === p.slug) })),
    ...layouts.filter(l => !APP_PAGES.some(ap => ap.slug === l.page_slug)).map(l => ({ title: l.title, slug: l.page_slug, route: `/p/${l.page_slug}`, isApp: false, layout: l })),
  ], [layouts]);

  const previewRoute = useMemo(() => {
    if (!selectedSlug) return null;
    const page = allPages.find(p => p.slug === selectedSlug);
    return page?.route || `/p/${selectedSlug}`;
  }, [selectedSlug, allPages]);

  // Build a key that changes when blocks change to force iframe reload
  const previewKey = useMemo(() => {
    return `${selectedSlug}-${currentBlocks.length}-${currentBlocks.map(b => b.id).join(",")}`;
  }, [selectedSlug, currentBlocks]);

  const moveBlock = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= currentBlocks.length) return;
    const updated = [...currentBlocks];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setCurrentBlocks(updated);
  };

  const removeBlock = (index: number) => {
    setCurrentBlocks(prev => prev.filter((_, i) => i !== index));
    setInsertIndex(null);
  };

  const addBlock = () => {
    if (!newBlockName.trim() || newBlockFields.length === 0) return;
    const block: LayoutBlock = {
      id: newBlockId(),
      name: newBlockName.trim(),
      fields: newBlockFields.map(f => ({ ...f, key: f.key || f.label.toLowerCase().replace(/\s+/g, "_") })),
      content: {},
    };
    newBlockFields.forEach(f => {
      block.content![f.key] = { en: "", fr: "" };
    });
    if (insertIndex !== null && insertIndex <= currentBlocks.length) {
      setCurrentBlocks(prev => [...prev.slice(0, insertIndex), block, ...prev.slice(insertIndex)]);
    } else {
      setCurrentBlocks(prev => [...prev, block]);
    }
    setNewBlockName("");
    setNewBlockFields([{ key: "title", label: "Title", type: "text" }]);
    setShowAddBlock(false);
    setInsertIndex(null);
  };

  const updateBlockContent = (blockIndex: number, fieldKey: string, locale: "en" | "fr", value: string) => {
    setCurrentBlocks(prev => prev.map((block, i) => {
      if (i !== blockIndex) return block;
      const content = { ...block.content };
      if (!content[fieldKey]) content[fieldKey] = { en: "", fr: "" };
      content[fieldKey] = { ...content[fieldKey], [locale]: value };
      return { ...block, content };
    }));
  };

  const saveLayout = async () => {
    if (!selectedSlug) return;
    setSaving(true);
    const existing = layouts.find(l => l.page_slug === selectedSlug);

    if (existing) {
      const { error } = await (supabase as any).from("page_layouts")
        .update({ blocks: currentBlocks, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } else {
      const appPage = APP_PAGES.find(p => p.slug === selectedSlug);
      const { error } = await (supabase as any).from("page_layouts")
        .insert({ page_slug: selectedSlug, title: appPage?.title || selectedSlug, blocks: currentBlocks });
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    }
    setSaving(false);
    await fetchLayouts();
  };

  const createPage = async () => {
    if (!newPageTitle.trim() || !newPageSlug.trim()) return;
    const slug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const { error } = await (supabase as any).from("page_layouts")
      .insert({ page_slug: slug, title: newPageTitle.trim(), blocks: [], is_published: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Page created" });
      setShowNewPage(false);
      setNewPageTitle("");
      setNewPageSlug("");
      await fetchLayouts();
      setSelectedSlug(slug);
      setCurrentBlocks([]);
    }
  };

  const togglePublish = async (slug: string) => {
    const layout = layouts.find(l => l.page_slug === slug);
    if (!layout) return;
    await (supabase as any).from("page_layouts").update({ is_published: !layout.is_published }).eq("id", layout.id);
    await fetchLayouts();
  };

  const addFieldToNewBlock = () => {
    setNewBlockFields(prev => [...prev, { key: "", label: "", type: "text" }]);
  };

  const updateNewBlockField = (index: number, field: Partial<BlockField>) => {
    setNewBlockFields(prev => prev.map((f, i) => i === index ? { ...f, ...field, key: field.label ? field.label.toLowerCase().replace(/\s+/g, "_") : f.key } : f));
  };

  const removeNewBlockField = (index: number) => {
    setNewBlockFields(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <div className="w-48 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pages</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewPage(!showNewPage)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showNewPage && (
          <div className="p-3 border-b border-border space-y-2">
            <Input placeholder="Page title" value={newPageTitle} onChange={e => { setNewPageTitle(e.target.value); setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ +/g, "-")); }} className="h-7 text-xs" />
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span>/p/</span>
              <Input placeholder="slug" value={newPageSlug} onChange={e => setNewPageSlug(e.target.value)} className="h-6 text-[10px] flex-1" />
            </div>
            <Button size="sm" className="w-full h-7 text-xs" onClick={createPage}>Create Page</Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1">App Pages</p>
            {allPages.filter(p => p.isApp).map(page => (
              <button
                key={page.slug}
                onClick={() => selectPage(page.slug)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                  selectedSlug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layout className="h-3 w-3 shrink-0" />
                  <span className="truncate">{page.title}</span>
                  {page.layout?.is_published && <Globe className="h-2.5 w-2.5 text-green-500 ml-auto shrink-0" />}
                </div>
              </button>
            ))}

            {allPages.some(p => !p.isApp) && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-3 pb-1">Custom Pages</p>
                {allPages.filter(p => !p.isApp).map(page => (
                  <button
                    key={page.slug}
                    onClick={() => selectPage(page.slug)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                      selectedSlug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{page.title}</span>
                      {page.layout?.is_published && <Globe className="h-2.5 w-2.5 text-green-500 ml-auto shrink-0" />}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Builder panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSlug ? (
          <>
            <div className="px-4 py-2.5 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  {allPages.find(p => p.slug === selectedSlug)?.title || selectedSlug}
                </h2>
                <p className="text-[10px] text-muted-foreground">{currentBlocks.length} blocks</p>
              </div>
              <div className="flex items-center gap-2">
                {saved && <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                {layouts.find(l => l.page_slug === selectedSlug) && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => togglePublish(selectedSlug)}>
                    {layouts.find(l => l.page_slug === selectedSlug)?.is_published ? "Unpublish" : "Publish"}
                  </Button>
                )}
                <Button size="sm" className="h-7 text-[10px] gap-1" onClick={saveLayout} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save Layout
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Block list */}
              <ScrollArea className="flex-1 min-w-0">
                <div className="p-3 space-y-2">
                  {currentBlocks.map((block, index) => (
                    <div key={block.id}>
                      {/* Insert indicator above */}
                      {insertIndex === index && (
                        <div className="h-1 bg-primary rounded-full mb-2 animate-pulse" />
                      )}
                      <div className={`border rounded-lg bg-card overflow-hidden ${insertIndex === index ? "border-primary" : "border-border"}`}>
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                          <span className="text-xs font-bold text-foreground flex-1">{block.name}</span>
                          <span className="text-[10px] text-muted-foreground">{block.fields.length}f</span>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(index, 1)} disabled={index === currentBlocks.length - 1}>
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeBlock(index)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="p-3 space-y-2">
                          {block.fields.map(field => {
                            const content = block.content?.[field.key] || { en: "", fr: "" };
                            const isLong = field.type === "text" && (content.en.length > 80 || content.fr.length > 80);

                            return (
                              <div key={field.key}>
                                <label className="text-[10px] font-medium text-foreground mb-0.5 block">{field.label}</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="text-[8px] text-muted-foreground uppercase block">EN</span>
                                    {isLong ? (
                                      <Textarea value={content.en} onChange={e => updateBlockContent(index, field.key, "en", e.target.value)} className="text-[10px] min-h-[40px] resize-y" placeholder="English..." />
                                    ) : (
                                      <Input type={field.type === "link" || field.type === "image_url" ? "url" : "text"} value={content.en} onChange={e => updateBlockContent(index, field.key, "en", e.target.value)} className="h-7 text-[10px]" placeholder="EN..." />
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-muted-foreground uppercase block">FR</span>
                                    {isLong ? (
                                      <Textarea value={content.fr} onChange={e => updateBlockContent(index, field.key, "fr", e.target.value)} className="text-[10px] min-h-[40px] resize-y" placeholder="French..." />
                                    ) : (
                                      <Input type={field.type === "link" || field.type === "image_url" ? "url" : "text"} value={content.fr} onChange={e => updateBlockContent(index, field.key, "fr", e.target.value)} className="h-7 text-[10px]" placeholder="FR..." />
                                    )}
                                  </div>
                                </div>
                                {field.type === "image_url" && content.en && (
                                  <img src={content.en} alt="Preview" className="mt-1 h-10 rounded border border-border object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Insert indicator at end */}
                  {insertIndex === currentBlocks.length && (
                    <div className="h-1 bg-primary rounded-full animate-pulse" />
                  )}

                  {/* Add block */}
                  {!showAddBlock ? (
                    <Button variant="outline" className="w-full h-9 text-xs gap-1.5 border-dashed" onClick={() => { setShowAddBlock(true); setInsertIndex(currentBlocks.length); }}>
                      <Plus className="h-3.5 w-3.5" /> Add Block
                    </Button>
                  ) : (
                    <div className="border border-primary/30 rounded-lg p-3 bg-card space-y-2">
                      <h4 className="text-xs font-bold text-foreground">Create New Block</h4>
                      <Input placeholder="Block name (e.g. Hero Section)" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} className="h-7 text-xs" />

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase">Fields</p>
                        {newBlockFields.map((field, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Input placeholder="Label" value={field.label} onChange={e => updateNewBlockField(i, { label: e.target.value })} className="h-6 text-[10px] flex-1" />
                            <select value={field.type} onChange={e => updateNewBlockField(i, { type: e.target.value as any })} className="h-6 text-[10px] rounded border border-input bg-background px-1.5">
                              <option value="text">Text</option>
                              <option value="link">Link / Button</option>
                              <option value="image_url">Image URL</option>
                            </select>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeNewBlockField(i)} disabled={newBlockFields.length <= 1}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1" onClick={addFieldToNewBlock}>
                          <Plus className="h-2.5 w-2.5" /> Add Field
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={addBlock} disabled={!newBlockName.trim()}>
                          Add Block
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowAddBlock(false); setInsertIndex(null); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Live preview panel — independently scrollable */}
              <div className="w-[320px] border-l border-border bg-muted/30 flex flex-col shrink-0 h-full">
                <div className="px-3 py-2 border-b border-border bg-card/50 flex items-center gap-2 shrink-0">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">375px mobile</span>
                </div>
                <div className="flex-1 overflow-y-scroll p-3">
                  {previewRoute && (
                    <div className="w-[375px] h-[667px] rounded-xl border-2 border-border bg-background overflow-hidden shadow-lg relative mx-auto">
                      <iframe
                        key={previewKey}
                        src={`${window.location.origin}${previewRoute}`}
                        className="w-full h-full border-0"
                        title="Page Preview"
                        style={{ pointerEvents: "none" }}
                      />
                      <div className="absolute inset-0 pointer-events-none" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a page to edit its layout
          </div>
        )}
      </div>
    </div>
  );
}