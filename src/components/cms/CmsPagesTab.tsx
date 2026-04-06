import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Globe, GlobeLock, Trash2, Layout, FileText, ExternalLink, Loader2, CornerDownRight } from "lucide-react";

const APP_PAGES = [
  { title: "Home", slug: "home", path: "/" },
  { title: "Benefits", slug: "benefits", path: "/benefits" },
  { title: "Recipes", slug: "recipes", path: "/recipes" },
  { title: "Ketosis Timer", slug: "timer", path: "/timer" },
  { title: "Meal Plan", slug: "meal-plan", path: "/meal-plan" },
  { title: "Ingredients", slug: "ingredients", path: "/ingredients" },
  { title: "Exercise", slug: "exercise", path: "/exercise" },
  { title: "Cravings", slug: "cravings", path: "/cravings" },
  { title: "Sustain Results", slug: "sustain", path: "/sustain" },
  { title: "Myths Busted", slug: "myths", path: "/myths" },
  { title: "Complete Guide", slug: "guide", path: "/guide" },
  { title: "First 30 Days", slug: "getting-started", path: "/getting-started" },
  { title: "Budget Eating", slug: "budget", path: "/budget" },
  { title: "Athletic Performance", slug: "athletic", path: "/athletic" },
  { title: "Community", slug: "community", path: "/community" },
  { title: "Progress", slug: "progress", path: "/progress" },
  { title: "News Feed", slug: "news", path: "/news" },
  { title: "Profile", slug: "profile", path: "/profile" },
];

interface PageLayout {
  id: string;
  page_slug: string;
  title: string;
  blocks: any[];
  is_published: boolean;
  parent_slug?: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  onNavigateToLayout: (slug: string) => void;
}

export default function CmsPagesTab({ onNavigateToLayout }: Props) {
  const [layouts, setLayouts] = useState<PageLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLayouts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("page_layouts").select("*").order("title");
    if (!error && data) setLayouts(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLayouts(); }, [fetchLayouts]);

  const togglePublish = async (layout: PageLayout) => {
    const { error } = await (supabase as any).from("page_layouts")
      .update({ is_published: !layout.is_published })
      .eq("id", layout.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else await fetchLayouts();
  };

  const deleteLayout = async (layout: PageLayout) => {
    const isAppPage = APP_PAGES.some(p => p.slug === layout.page_slug);
    if (isAppPage) {
      toast({ title: "Cannot delete", description: "App pages cannot be deleted.", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("page_layouts").delete().eq("id", layout.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Page deleted" }); await fetchLayouts(); }
  };

  // Build hierarchical list: app pages first, then custom pages grouped by parent
  const customLayouts = layouts.filter(l => !APP_PAGES.some(p => p.slug === l.page_slug));
  const parents = customLayouts.filter(l => !l.parent_slug);
  const children = customLayouts.filter(l => !!l.parent_slug);

  type PageRow = { title: string; slug: string; path: string; isApp: boolean; layout: PageLayout | undefined; isPublished: boolean; updatedAt: string | null; isChild: boolean };

  const rows: PageRow[] = [];

  // App pages
  for (const p of APP_PAGES) {
    const layout = layouts.find(l => l.page_slug === p.slug);
    rows.push({ title: p.title, slug: p.slug, path: p.path, isApp: true, layout, isPublished: layout?.is_published || false, updatedAt: layout?.updated_at || null, isChild: false });
  }

  // Custom pages: parents then their children
  for (const p of parents) {
    rows.push({ title: p.title, slug: p.page_slug, path: `/p/${p.page_slug}`, isApp: false, layout: p, isPublished: p.is_published, updatedAt: p.updated_at, isChild: false });
    for (const c of children.filter(ch => ch.parent_slug === p.page_slug)) {
      rows.push({ title: c.title, slug: c.page_slug, path: `/p/${c.page_slug}`, isApp: false, layout: c, isPublished: c.is_published, updatedAt: c.updated_at, isChild: true });
    }
  }

  // Orphan children
  for (const c of children.filter(ch => !parents.some(p => p.page_slug === ch.parent_slug))) {
    rows.push({ title: c.title, slug: c.page_slug, path: `/p/${c.page_slug}`, isApp: false, layout: c, isPublished: c.is_published, updatedAt: c.updated_at, isChild: false });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-3 border-b border-border bg-card/50">
        <h2 className="text-sm font-bold text-foreground">All Pages</h2>
        <p className="text-[10px] text-muted-foreground">{rows.length} pages — manage publish status and layouts</p>
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
                <tr key={page.slug} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2.5 pl-2">
                    <div className={`flex items-center gap-1.5 ${page.isChild ? "pl-4" : ""}`}>
                      {page.isChild ? (
                        <CornerDownRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      ) : page.isApp ? (
                        <Layout className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground">{page.title}</span>
                    </div>
                  </td>
                  <td className="py-2.5">
                    <span className="text-[11px] text-muted-foreground font-mono">{page.path}</span>
                  </td>
                  <td className="py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${page.isApp ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"}`}>
                      {page.isApp ? "App" : "Custom"}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {page.layout ? (
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${page.isPublished ? "text-green-500" : "text-muted-foreground"}`}>
                        {page.isPublished ? <Globe className="h-3 w-3" /> : <GlobeLock className="h-3 w-3" />}
                        {page.isPublished ? "Published" : "Draft"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Default</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className="text-[10px] text-muted-foreground">
                      {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : "—"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit in Layout Builder" onClick={() => onNavigateToLayout(page.slug)}>
                        <Layout className="h-3 w-3" />
                      </Button>
                      <a href={page.path} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Preview">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                      {page.layout && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title={page.isPublished ? "Unpublish" : "Publish"} onClick={() => togglePublish(page.layout!)}>
                          {page.isPublished ? <GlobeLock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        </Button>
                      )}
                      {!page.isApp && page.layout && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Delete" onClick={() => deleteLayout(page.layout!)}>
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
  );
}
