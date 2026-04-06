import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, ArrowUp, ArrowDown, Save, Loader2, GripVertical, Layout, FileText,
  Globe, CheckCircle2, Eye, Type, AlignLeft, MousePointerClick, ShieldAlert, Image, Minus, Wrench, AlertCircle
} from "lucide-react";
import { type CmsPageRecord, APP_PAGES as APP_PAGE_DEFS } from "./cmsPages";

interface BlockField {
  key: string;
  label: string;
  type: "text" | "link" | "image_url";
}

interface LayoutBlock {
  id: string;
  name: string;
  blockType?: string;
  fields: BlockField[];
  content?: Record<string, { en: string; fr: string }>;
}

const BLOCK_TEMPLATES = [
  { type: "rich_text", label: "Rich Text", icon: AlignLeft, fields: [{ key: "body", label: "Body", type: "text" as const }] },
  { type: "title_body", label: "Title + Body", icon: Type, fields: [{ key: "title", label: "Title", type: "text" as const }, { key: "body", label: "Body", type: "text" as const }] },
  { type: "cta_button", label: "CTA / Button", icon: MousePointerClick, fields: [{ key: "label", label: "Label", type: "text" as const }, { key: "link", label: "Link", type: "link" as const }] },
  { type: "notice", label: "Notice / Disclaimer", icon: ShieldAlert, fields: [{ key: "title", label: "Title", type: "text" as const }, { key: "body", label: "Body", type: "text" as const }] },
  { type: "image_block", label: "Image", icon: Image, fields: [{ key: "src", label: "Image URL", type: "image_url" as const }, { key: "alt", label: "Alt Text", type: "text" as const }] },
  { type: "spacer", label: "Spacer", icon: Minus, fields: [] },
];

let blockIdCounter = 0;
function newBlockId() { return `block_${Date.now()}_${blockIdCounter++}`; }

interface CmsLayoutBuilderProps {
  pages: CmsPageRecord[];
  activePage: CmsPageRecord | null;
  onSelectPage: (page: CmsPageRecord) => void;
  refreshPages: () => Promise<void>;
}

export default function CmsLayoutBuilder({ pages, activePage, onSelectPage, refreshPages }: CmsLayoutBuilderProps) {
  const [currentBlocks, setCurrentBlocks] = useState<LayoutBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageParent, setNewPageParent] = useState<string>("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCustomBlock, setShowCustomBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");
  const [newBlockFields, setNewBlockFields] = useState<BlockField[]>([{ key: "title", label: "Title", type: "text" }]);
  const [saved, setSaved] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const { toast } = useToast();

  // When activePage changes, load its blocks
  useEffect(() => {
    if (!activePage) { setCurrentBlocks([]); return; }
    // Load from shared page record
    const blocks: LayoutBlock[] = (activePage.blocks || []).map((b: any) => ({
      id: b.id || newBlockId(),
      name: b.name || b.blockType || "Block",
      blockType: b.blockType,
      fields: b.fields || [],
      content: b.content || {},
    }));
    setCurrentBlocks(blocks);
    setInsertIndex(null);
  }, [activePage?.slug, activePage?.updatedAt]);

  const customPages = useMemo(() => pages.filter(p => p.source === "custom"), [pages]);
  const customParents = useMemo(() => customPages.filter(p => !p.parentSlug), [customPages]);
  const customChildren = useMemo(() => customPages.filter(p => !!p.parentSlug), [customPages]);

  const linkOptions = useMemo(() => [
    ...APP_PAGE_DEFS.map(p => ({ label: p.title, value: p.route })),
    ...customPages.map(p => ({ label: `${p.title} (custom)`, value: p.route })),
  ], [customPages]);

  const previewRoute = activePage?.route || null;
  const previewKey = useMemo(() => `${activePage?.slug}-${currentBlocks.length}-${currentBlocks.map(b => b.id).join(",")}`, [activePage?.slug, currentBlocks]);

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

  const insertTemplateBlock = (template: typeof BLOCK_TEMPLATES[number]) => {
    const block: LayoutBlock = {
      id: newBlockId(),
      name: template.label,
      blockType: template.type,
      fields: template.fields.map(f => ({ ...f })),
      content: {},
    };
    template.fields.forEach(f => { block.content![f.key] = { en: "", fr: "" }; });
    if (insertIndex !== null && insertIndex <= currentBlocks.length) {
      setCurrentBlocks(prev => [...prev.slice(0, insertIndex), block, ...prev.slice(insertIndex)]);
    } else {
      setCurrentBlocks(prev => [...prev, block]);
    }
    setShowTemplatePicker(false);
    setInsertIndex(null);
  };

  const addCustomBlock = () => {
    if (!newBlockName.trim() || newBlockFields.length === 0) return;
    const block: LayoutBlock = {
      id: newBlockId(),
      name: newBlockName.trim(),
      blockType: "custom",
      fields: newBlockFields.map(f => ({ ...f, key: f.key || f.label.toLowerCase().replace(/\s+/g, "_") })),
      content: {},
    };
    newBlockFields.forEach(f => { block.content![f.key] = { en: "", fr: "" }; });
    if (insertIndex !== null && insertIndex <= currentBlocks.length) {
      setCurrentBlocks(prev => [...prev.slice(0, insertIndex), block, ...prev.slice(insertIndex)]);
    } else {
      setCurrentBlocks(prev => [...prev, block]);
    }
    setNewBlockName("");
    setNewBlockFields([{ key: "title", label: "Title", type: "text" }]);
    setShowCustomBlock(false);
    setShowTemplatePicker(false);
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
    if (!activePage) return;
    setSaving(true);
    if (activePage.pageLayoutId) {
      const { error } = await (supabase as any).from("page_layouts")
        .update({ blocks: currentBlocks, updated_at: new Date().toISOString() })
        .eq("id", activePage.pageLayoutId);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } else {
      const { error } = await (supabase as any).from("page_layouts")
        .insert({ page_slug: activePage.slug, title: activePage.title, blocks: currentBlocks });
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    }
    setSaving(false);
    await refreshPages();
  };

  const createPage = async () => {
    if (!newPageTitle.trim() || !newPageSlug.trim()) return;
    const slug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const insertData: any = { page_slug: slug, title: newPageTitle.trim(), blocks: [], is_published: false };
    if (newPageParent) insertData.parent_slug = newPageParent;
    const { error } = await (supabase as any).from("page_layouts").insert(insertData);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Page created" });
      setShowNewPage(false);
      setNewPageTitle("");
      setNewPageSlug("");
      setNewPageParent("");
      await refreshPages();
    }
  };

  const togglePublish = async () => {
    if (!activePage?.pageLayoutId) return;
    await (supabase as any).from("page_layouts").update({ is_published: !activePage.isPublished }).eq("id", activePage.pageLayoutId);
    await refreshPages();
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

  const blockTypeLabel = (b: LayoutBlock) => {
    if (!b.blockType) return null;
    const tpl = BLOCK_TEMPLATES.find(t => t.type === b.blockType);
    return tpl?.label || b.blockType;
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
            {customPages.length > 0 && (
              <Select value={newPageParent} onValueChange={setNewPageParent}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Parent page (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent</SelectItem>
                  {customPages.map(p => (
                    <SelectItem key={p.slug} value={p.slug}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" className="w-full h-7 text-xs" onClick={createPage}>Create Page</Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1">App Pages</p>
            {pages.filter(p => p.source === "app").map(page => (
              <button
                key={page.slug}
                onClick={() => onSelectPage(page)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                  activePage?.slug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layout className="h-3 w-3 shrink-0" />
                  <span className="truncate">{page.title}</span>
                  {page.isPublished && <Globe className="h-2.5 w-2.5 text-green-500 ml-auto shrink-0" />}
                </div>
              </button>
            ))}

            {customPages.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-3 pb-1">Custom Pages</p>
                {customParents.map(page => (
                  <div key={page.slug}>
                    <button
                      onClick={() => onSelectPage(page)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                        activePage?.slug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{page.title}</span>
                        {page.isPublished && <Globe className="h-2.5 w-2.5 text-green-500 ml-auto shrink-0" />}
                      </div>
                    </button>
                    {customChildren.filter(c => c.parentSlug === page.slug).map(child => (
                      <button
                        key={child.slug}
                        onClick={() => onSelectPage(child)}
                        className={`w-full text-left pl-7 pr-3 py-1.5 rounded-md text-xs transition-colors ${
                          activePage?.slug === child.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">{child.title}</span>
                          {child.isPublished && <Globe className="h-2.5 w-2.5 text-green-500 ml-auto shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
                {customChildren.filter(c => !customParents.some(p => p.slug === c.parentSlug)).map(page => (
                  <button
                    key={page.slug}
                    onClick={() => onSelectPage(page)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                      activePage?.slug === page.slug ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent/50"
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

      {/* Builder panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {activePage ? (
          <>
            <div className="px-4 py-2.5 border-b border-border bg-card/50 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">{activePage.title}</h2>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${activePage.source === "app" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                    {activePage.source === "app" ? "App" : "Custom"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{currentBlocks.length} blocks</p>
              </div>
              <div className="flex items-center gap-2">
                {saved && <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
                {activePage.pageLayoutId && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={togglePublish}>
                    {activePage.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                )}
                <Button size="sm" className="h-7 text-[10px] gap-1" onClick={saveLayout} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save Layout
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <ScrollArea className="flex-1 min-w-0">
                <div className="p-3 space-y-2">
                  {currentBlocks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-border rounded-lg bg-muted/20">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-foreground mb-1">No blocks yet</p>
                      <p className="text-xs text-muted-foreground mb-3">Add blocks below to start building this page layout.</p>
                    </div>
                  )}

                  {currentBlocks.map((block, index) => (
                    <div key={block.id}>
                      {insertIndex === index && (
                        <div className="h-1 bg-primary rounded-full mb-2 animate-pulse" />
                      )}
                      <div className={`border rounded-lg bg-card overflow-hidden ${insertIndex === index ? "border-primary" : "border-border"}`}>
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                          <span className="text-xs font-bold text-foreground flex-1">{block.name}</span>
                          {blockTypeLabel(block) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">{blockTypeLabel(block)}</span>
                          )}
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
                            const isLink = field.type === "link";

                            return (
                              <div key={field.key}>
                                <label className="text-[10px] font-medium text-foreground mb-0.5 block">{field.label}</label>

                                {isLink && (
                                  <div className="mb-1">
                                    <Select
                                      value={linkOptions.some(o => o.value === content.en) ? content.en : "__manual__"}
                                      onValueChange={(val) => {
                                        if (val !== "__manual__") {
                                          updateBlockContent(index, field.key, "en", val);
                                          updateBlockContent(index, field.key, "fr", val);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-[10px]">
                                        <SelectValue placeholder="Select a page…" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__manual__">Manual URL</SelectItem>
                                        {linkOptions.map(o => (
                                          <SelectItem key={o.value} value={o.value}>{o.label} — {o.value}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="text-[8px] text-muted-foreground uppercase block">EN</span>
                                    {isLong ? (
                                      <Textarea value={content.en} onChange={e => updateBlockContent(index, field.key, "en", e.target.value)} className="text-[10px] min-h-[40px] resize-y" placeholder="English..." />
                                    ) : (
                                      <Input type={isLink || field.type === "image_url" ? "url" : "text"} value={content.en} onChange={e => updateBlockContent(index, field.key, "en", e.target.value)} className="h-7 text-[10px]" placeholder="EN..." />
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-[8px] text-muted-foreground uppercase block">FR</span>
                                    {isLong ? (
                                      <Textarea value={content.fr} onChange={e => updateBlockContent(index, field.key, "fr", e.target.value)} className="text-[10px] min-h-[40px] resize-y" placeholder="French..." />
                                    ) : (
                                      <Input type={isLink || field.type === "image_url" ? "url" : "text"} value={content.fr} onChange={e => updateBlockContent(index, field.key, "fr", e.target.value)} className="h-7 text-[10px]" placeholder="FR..." />
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

                  {insertIndex === currentBlocks.length && (
                    <div className="h-1 bg-primary rounded-full animate-pulse" />
                  )}

                  {/* Add block */}
                  {!showTemplatePicker ? (
                    <Button variant="outline" className="w-full h-9 text-xs gap-1.5 border-dashed" onClick={() => { setShowTemplatePicker(true); setInsertIndex(currentBlocks.length); }}>
                      <Plus className="h-3.5 w-3.5" /> Add Block
                    </Button>
                  ) : !showCustomBlock ? (
                    <div className="border border-primary/30 rounded-lg p-3 bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground">Choose Block Type</h4>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setShowTemplatePicker(false); setInsertIndex(null); }}>Cancel</Button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BLOCK_TEMPLATES.map(tpl => {
                          const Icon = tpl.icon;
                          return (
                            <button
                              key={tpl.type}
                              onClick={() => insertTemplateBlock(tpl)}
                              className="flex flex-col items-center gap-1 p-2.5 rounded-md border border-border hover:border-primary hover:bg-primary/5 transition-colors text-center"
                            >
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[10px] font-medium text-foreground leading-tight">{tpl.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] gap-1 text-muted-foreground" onClick={() => setShowCustomBlock(true)}>
                        <Wrench className="h-3 w-3" /> Custom Block…
                      </Button>
                    </div>
                  ) : (
                    <div className="border border-primary/30 rounded-lg p-3 bg-card space-y-2">
                      <h4 className="text-xs font-bold text-foreground">Custom Block</h4>
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
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={addCustomBlock} disabled={!newBlockName.trim()}>Add Block</Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setShowCustomBlock(false); }}>Back</Button>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Live preview */}
              <div className="w-[400px] border-l border-border bg-muted/30 flex flex-col shrink-0" style={{ height: "calc(100vh - 88px)" }}>
                <div className="px-3 py-2 border-b border-border bg-card/50 flex items-center gap-2 shrink-0">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">375px mobile</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {previewRoute && (
                    <div className="w-[375px] rounded-xl border-2 border-border bg-background overflow-hidden shadow-lg relative mx-auto" style={{ height: "3000px" }}>
                      <iframe
                        key={previewKey}
                        src={`${window.location.origin}${previewRoute}`}
                        className="w-full border-0"
                        title="Page Preview"
                        style={{ pointerEvents: "none", height: "3000px" }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No page selected</p>
            <p className="text-xs text-muted-foreground">Select a page from the sidebar to edit its layout, or create a new custom page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
