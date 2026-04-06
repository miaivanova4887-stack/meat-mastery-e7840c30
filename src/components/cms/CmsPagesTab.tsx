import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Globe, GlobeLock, Trash2, Layout, FileText, ExternalLink, CornerDownRight, Save, Loader2, Settings } from "lucide-react";
import { type CmsPageRecord } from "./cmsPages";

interface Props {
  pages: CmsPageRecord[];
  activePage: CmsPageRecord | null;
  onSelectPage: (page: CmsPageRecord) => void;
  refreshPages: () => Promise<void>;
  onNavigateToLayout: (slug: string) => void;
  onNavigateToContent: (slug: string) => void;
}

export default function CmsPagesTab({ pages, activePage, onSelectPage, refreshPages, onNavigateToLayout, onNavigateToContent }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPublished, setEditPublished] = useState(false);
  const [editParent, setEditParent] = useState("");

  // Hydrate settings form via useEffect when activePage changes
  useEffect(() => {
    if (activePage) {
      setEditTitle(activePage.title);
      setEditSlug(activePage.slug);
      setEditPublished(activePage.isPublished);
      setEditParent(activePage.parentSlug || "");
    }
  }, [activePage?.slug, activePage?.updatedAt]);

  const customPages = pages.filter(p => p.source === "custom");
  const parents = customPages.filter(p => !p.parentSlug);
  const children = customPages.filter(p => !!p.parentSlug);

  // All pages available as parent options (exclude self)
  const parentOptions = pages.filter(p => p.slug !== activePage?.slug);

  // Build rows
  type Row = CmsPageRecord & { isChild: boolean };
  const rows: Row[] = [];
  for (const p of pages.filter(p => p.source === "app")) {
    rows.push({ ...p, isChild: false });
  }
  for (const p of parents) {
    rows.push({ ...p, isChild: false });
    for (const c of children.filter(ch => ch.parentSlug === p.slug)) {
      rows.push({ ...c, isChild: true });
    }
  }
  // Orphans — custom pages whose parent doesn't exist in custom parents
  for (const c of children.filter(ch => !parents.some(p => p.slug === ch.parentSlug))) {
    // Check if parent is an app page
    const parentPage = pages.find(p => p.slug === c.parentSlug);
    rows.push({ ...c, isChild: !!parentPage });
  }

  const togglePublish = async (page: CmsPageRecord) => {
    if (!page.pageLayoutId) return;
    await (supabase as any).from("page_layouts").update({ is_published: !page.isPublished }).eq("id", page.pageLayoutId);
    await refreshPages();
  };

  const deleteLayout = async (page: CmsPageRecord) => {
    if (page.source === "app") {
      toast({ title: "Cannot delete", description: "App pages cannot be deleted.", variant: "destructive" });
      return;
    }
    if (!page.pageLayoutId) return;
    const { error } = await (supabase as any).from("page_layouts").delete().eq("id", page.pageLayoutId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Page deleted" }); await refreshPages(); }
  };

  const saveSettings = async () => {
    if (!activePage?.pageLayoutId) return;
    setSaving(true);
    const update: any = { title: editTitle, is_published: editPublished, updated_at: new Date().toISOString() };
    if (activePage.source === "custom") {
      update.parent_slug = editParent || null;
    }
    const { error } = await (supabase as any).from("page_layouts").update(update).eq("id", activePage.pageLayoutId);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Settings saved" }); await refreshPages(); }
    setSaving(false);
  };

  return (
    <div className="flex h-full">
      {/* Left: table */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-border bg-card/50">
          <h2 className="text-sm font-bold text-foreground">All Pages</h2>
          <p className="text-[10px] text-muted-foreground">{rows.length} pages — click a row to edit settings</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="text-left pb-2 pl-2">Page</th>
                  <th className="text-left pb-2">Slug</th>
                  <th className="text-left pb-2">Type</th>
                  <th className="text-left pb-2">Status</th>
                  <th className="text-left pb-2">Last Updated</th>
                  <th className="text-right pb-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(page => (
                  <tr
                    key={page.slug}
                    onClick={() => onSelectPage(page)}
                    className={`cursor-pointer transition-colors ${activePage?.slug === page.slug ? "bg-primary/5" : "hover:bg-accent/30"}`}
                  >
                    <td className="py-2.5 pl-2">
                      <div className={`flex items-center gap-1.5 ${page.isChild ? "pl-4" : ""}`}>
                        {page.isChild ? <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" /> : page.source === "app" ? <Layout className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="text-xs font-medium text-foreground">{page.title}</span>
                      </div>
                    </td>
                    <td className="py-2.5"><span className="text-[11px] text-muted-foreground font-mono">{page.route}</span></td>
                    <td className="py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${page.source === "app" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                        {page.source === "app" ? "App" : "Custom"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      {page.pageLayoutId ? (
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${page.isPublished ? "text-green-500" : "text-muted-foreground"}`}>
                          {page.isPublished ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
                          {page.isPublished ? "Published" : "Draft"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Default</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <span className="text-[10px] text-muted-foreground">{page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : "—"}</span>
                    </td>
                    <td className="py-2.5 pr-2" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit Layout" onClick={() => onNavigateToLayout(page.slug)}>
                          <Layout className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit Content" onClick={() => onNavigateToContent(page.slug)}>
                          <FileText className="h-3 w-3" />
                        </Button>
                        <a href={page.route} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Preview"><ExternalLink className="h-3 w-3" /></Button>
                        </a>
                        {page.pageLayoutId && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" title={page.isPublished ? "Unpublish" : "Publish"} onClick={() => togglePublish(page)}>
                            {page.isPublished ? <GlobeLock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                          </Button>
                        )}
                        {page.source === "custom" && page.pageLayoutId && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Delete" onClick={() => deleteLayout(page)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>

      {/* Right: settings editor */}
      <div className="w-72 border-l border-border bg-card flex flex-col shrink-0">
        {activePage ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-bold text-foreground">Page Settings</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Title</label>
                  {activePage.source === "custom" ? (
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-xs" />
                  ) : (
                    <p className="text-xs text-foreground">{activePage.title}</p>
                  )}
                </div>

                {/* Slug / Route */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Route</label>
                  <p className="text-xs text-muted-foreground font-mono">{activePage.route}</p>
                </div>

                {/* Type */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Type</label>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${activePage.source === "app" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                    {activePage.source === "app" ? "App Page" : "Custom Page"}
                  </span>
                </div>

                {/* Publish toggle */}
                {activePage.pageLayoutId && (
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Published</label>
                    <div className="flex items-center gap-2">
                      <Switch checked={editPublished} onCheckedChange={setEditPublished} />
                      <span className="text-xs text-muted-foreground">{editPublished ? "Published" : "Draft"}</span>
                    </div>
                  </div>
                )}

                {/* Parent (custom only) — full page registry */}
                {activePage.source === "custom" && (
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Parent Page</label>
                    <Select value={editParent || "__none__"} onValueChange={v => setEditParent(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="No parent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No parent</SelectItem>
                        {parentOptions.map(p => (
                          <SelectItem key={p.slug} value={p.slug}>
                            {p.title} {p.source === "app" ? "(App)" : "(Custom)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Blocks summary */}
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">Blocks</label>
                  <p className="text-xs text-muted-foreground">{activePage.blocks.length} block{activePage.blocks.length !== 1 ? "s" : ""}</p>
                </div>

                {/* Save button (pages with layout) */}
                {activePage.pageLayoutId && (
                  <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={saveSettings} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save Settings
                  </Button>
                )}

                {/* Quick nav */}
                <div className="pt-2 border-t border-border space-y-1.5">
                  <Button variant="outline" size="sm" className="w-full h-7 text-[10px] gap-1" onClick={() => onNavigateToLayout(activePage.slug)}>
                    <Layout className="h-3 w-3" /> Edit Layout
                  </Button>
                  <Button variant="outline" size="sm" className="w-full h-7 text-[10px] gap-1" onClick={() => onNavigateToContent(activePage.slug)}>
                    <FileText className="h-3 w-3" /> Edit Content
                  </Button>
                </div>

                {!activePage.pageLayoutId && activePage.source === "app" && (
                  <p className="text-[10px] text-muted-foreground italic">
                    This app page has no custom layout yet. Open Layout Builder to add blocks.
                  </p>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex items-center justify-center h-full p-4">
            <p className="text-xs text-muted-foreground text-center">Select a page from the table to view and edit its settings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
