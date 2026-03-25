import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FileText, Trash2, Globe, GlobeLock, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PlacedComponent } from "./cmsTypes";

const APP_PAGES = [
  { title: "Home", path: "/" },
  { title: "Benefits", path: "/benefits" },
  { title: "Recipes", path: "/recipes" },
  { title: "Ketosis Timer", path: "/timer" },
  { title: "Meal Plan", path: "/meal-plan" },
  { title: "Ingredients", path: "/ingredients" },
  { title: "Exercise", path: "/exercise" },
  { title: "Cravings", path: "/cravings" },
  { title: "Sustain Results", path: "/sustain" },
  { title: "Myths Busted", path: "/myths" },
  { title: "Complete Guide", path: "/guide" },
  { title: "Getting Started", path: "/getting-started" },
  { title: "Budget Eating", path: "/budget" },
  { title: "Athletic Performance", path: "/athletic" },
  { title: "Community", path: "/community" },
  { title: "Progress", path: "/progress" },
  { title: "News Feed", path: "/news" },
  { title: "Profile", path: "/profile" },
];

interface CmsPage {
  id: string;
  title: string;
  slug: string;
  layout: PlacedComponent[];
  published: boolean;
  updated_at: string;
}

interface Props {
  currentPageId: string | null;
  onSelectPage: (page: CmsPage) => void;
  onNewPage: () => void;
  components: PlacedComponent[];
}

export default function CmsPageManager({ currentPageId, onSelectPage, onNewPage, components }: Props) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [showNew, setShowNew] = useState(false);
  const { toast } = useToast();

  const fetchPages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("cms_pages")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (!error && data) {
      setPages(data.map(p => ({ ...p, layout: (p.layout as unknown as PlacedComponent[]) || [] })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, []);

  const createPage = async () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ title: "Please sign in", variant: "destructive" }); return; }

    const { data, error } = await supabase
      .from("cms_pages")
      .insert({ title: newTitle.trim(), slug, user_id: user.id, layout: [] as unknown as any })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      toast({ title: "Page created" });
      setShowNew(false);
      setNewTitle("");
      setNewSlug("");
      fetchPages();
      onSelectPage({ ...data, layout: [] });
    }
  };

  const saveCurrent = async () => {
    if (!currentPageId) return;
    setSaving(true);
    const { error } = await supabase
      .from("cms_pages")
      .update({ layout: components as unknown as any, updated_at: new Date().toISOString() })
      .eq("id", currentPageId);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved!" }); fetchPages(); }
  };

  const togglePublish = async (page: CmsPage) => {
    const { error } = await supabase
      .from("cms_pages")
      .update({ published: !page.published })
      .eq("id", page.id);
    if (!error) fetchPages();
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase.from("cms_pages").delete().eq("id", id);
    if (!error) {
      fetchPages();
      if (currentPageId === id) onNewPage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pages</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNew(!showNew)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showNew && (
        <div className="p-3 border-b border-border space-y-2">
          <Input placeholder="Page title" value={newTitle} onChange={e => { setNewTitle(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ +/g, "-")); }} className="h-7 text-xs" />
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>/p/</span>
            <Input placeholder="slug" value={newSlug} onChange={e => setNewSlug(e.target.value)} className="h-6 text-[10px] flex-1" />
          </div>
          <Button size="sm" className="w-full h-7 text-xs" onClick={createPage}>Create Page</Button>
        </div>
      )}

      {currentPageId && (
        <div className="p-2 border-b border-border">
          <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={saveCurrent} disabled={saving}>
            {saving ? "Saving…" : "💾 Save Layout"}
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {loading && <p className="text-xs text-muted-foreground p-2">Loading…</p>}
          {!loading && pages.length === 0 && <p className="text-xs text-muted-foreground p-2">No pages yet</p>}
          {pages.map(page => (
            <div
              key={page.id}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${page.id === currentPageId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
              onClick={() => onSelectPage(page)}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{page.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">/p/{page.slug}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); togglePublish(page); }} title={page.published ? "Unpublish" : "Publish"}>
                {page.published ? <Globe className="h-3 w-3 text-green-500" /> : <GlobeLock className="h-3 w-3 text-muted-foreground" />}
              </button>
              <button onClick={e => { e.stopPropagation(); deletePage(page.id); }}>
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
