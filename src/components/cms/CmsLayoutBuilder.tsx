import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, GripVertical, Layout, FileText, Globe, CheckCircle2 } from "lucide-react";

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
  { title: "Home", slug: "home" },
  { title: "Benefits", slug: "benefits" },
  { title: "Recipes", slug: "recipes" },
  { title: "Ketosis Timer", slug: "timer" },
  { title: "Meal Plan", slug: "meal-plan" },
  { title: "Ingredients", slug: "ingredients" },
  { title: "Exercise", slug: "exercise" },
  { title: "Cravings", slug: "cravings" },
  { title: "Sustain Results", slug: "sustain" },
  { title: "Myths Busted", slug: "myths" },
  { title: "Complete Guide", slug: "guide" },
  { title: "First 30 Days", slug: "getting-started" },
  { title: "Budget Eating", slug: "budget" },
  { title: "Athletic Performance", slug: "athletic" },
  { title: "Community", slug: "community" },
  { title: "Progress", slug: "progress" },
  { title: "News Feed", slug: "news" },
  { title: "Profile", slug: "profile" },
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
  const { toast } = useToast();

  const fetchLayouts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("page_layouts").select("*").order("title");
    if (!error && data) setLayouts(data.map((l: any) => ({ ...l, blocks: l.blocks || [] })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchLayouts(); }, [fetchLayouts]);

  const selectPage = (slug: string) => {
    setSelectedSlug(slug);
    const layout = layouts.find(l => l.page_slug === slug);
    setCurrentBlocks(layout?.blocks || []);
  };

  const allPages = [
    ...APP_PAGES.map(p => ({ ...p, isApp: true, layout: layouts.find(l => l.page_slug === p.slug) })),
    ...layouts.filter(l => !APP_PAGES.some(ap => ap.slug === l.page_slug)).map(l => ({ title: l.title, slug: l.page_slug, isApp: false, layout: l })),
  ];

  const moveBlock = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= currentBlocks.length) return;
    const updated = [...currentBlocks];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setCurrentBlocks(updated);
  };

  const removeBlock = (index: number) => {
    setCurrentBlocks(prev => prev.filter((_, i) => i !== index));
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
    setCurrentBlocks(prev => [...prev, block]);
    setNewBlockName("");
    setNewBlockFields([{ key: "title", label: "Title", type: "text" }]);
    setShowAddBlock(false);
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
      <div className="w-52 border-r border-border bg-card flex flex-col shrink-0">
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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSlug ? (
          <>
            <div className="px-5 py-3 border-b border-border bg-card/50 flex items-center justify-between">
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

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {currentBlocks.map((block, index) => (
                  <div key={block.id} className="border border-border rounded-lg bg-card overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                      <span className="text-xs font-bold text-foreground flex-1">{block.name}</span>
                      <span className="text-[10px] text-muted-foreground">{block.fields.length} fields</span>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(index, -1)} disabled={index === 0}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(index, 1)} disabled={index === currentBlocks.length - 1}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeBlock(index)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {block.fields.map(field => {
                        const content = block.content?.[field.key] || { en: "", fr: "" };
                        const isLong = field.type === "text" && (content.en.length > 80 || content.fr.length > 80);

                        return (
                          <div key={field.key}>
                            <label className="text-[11px] font-medium text-foreground mb-1 block">{field.label}</label>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] text-muted-foreground uppercase mb-0.5 block">English</span>
                                {isLong || field.type === "text" && content.en.length > 40 ? (
                                  <Textarea value={content.en} onChange={e => updateBlockContent(index, field.key, "en", e.target.value)} className="text-[11px] min-h-[50px] resize-y" placeholder="English..." />
                                ) : (
                                  <Input type={field.type === "link" || field.type === "image_url" ? "url" : "text"} value={content.en} onChange={e => updateBlockContent(index, field.key, "en", e.target.value)} className="h-8 text-[11px]" placeholder="English..." />
                                )}
                              </div>
                              <div>
                                <span className="text-[9px] text-muted-foreground uppercase mb-0.5 block">French</span>
                                {isLong || field.type === "text" && content.fr.length > 40 ? (
                                  <Textarea value={content.fr} onChange={e => updateBlockContent(index, field.key, "fr", e.target.value)} className="text-[11px] min-h-[50px] resize-y" placeholder="French..." />
                                ) : (
                                  <Input type={field.type === "link" || field.type === "image_url" ? "url" : "text"} value={content.fr} onChange={e => updateBlockContent(index, field.key, "fr", e.target.value)} className="h-8 text-[11px]" placeholder="French..." />
                                )}
                              </div>
                            </div>
                            {field.type === "image_url" && content.en && (
                              <div className="mt-1.5 flex gap-2">
                                <img src={content.en} alt="Preview" className="h-12 rounded border border-border object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Add block */}
                {!showAddBlock ? (
                  <Button variant="outline" className="w-full h-10 text-xs gap-1.5 border-dashed" onClick={() => setShowAddBlock(true)}>
                    <Plus className="h-3.5 w-3.5" /> Add Block
                  </Button>
                ) : (
                  <div className="border border-primary/30 rounded-lg p-4 bg-card space-y-3">
                    <h4 className="text-xs font-bold text-foreground">Create New Block</h4>
                    <Input placeholder="Block name (e.g. Hero Section)" value={newBlockName} onChange={e => setNewBlockName(e.target.value)} className="h-8 text-xs" />

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Fields</p>
                      {newBlockFields.map((field, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input placeholder="Label" value={field.label} onChange={e => updateNewBlockField(i, { label: e.target.value })} className="h-7 text-[11px] flex-1" />
                          <select value={field.type} onChange={e => updateNewBlockField(i, { type: e.target.value as any })} className="h-7 text-[11px] rounded border border-input bg-background px-2">
                            <option value="text">Text</option>
                            <option value="link">Link / Button</option>
                            <option value="image_url">Image URL</option>
                          </select>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeNewBlockField(i)} disabled={newBlockFields.length <= 1}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={addFieldToNewBlock}>
                        <Plus className="h-2.5 w-2.5" /> Add Field
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={addBlock} disabled={!newBlockName.trim()}>
                        Add Block
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAddBlock(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
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
