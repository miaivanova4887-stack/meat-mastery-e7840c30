import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CmsToolbar from "@/components/cms/CmsToolbar";
import CmsComponentLibrary from "@/components/cms/CmsComponentLibrary";
import CmsCanvas from "@/components/cms/CmsCanvas";
import CmsPropertiesPanel from "@/components/cms/CmsPropertiesPanel";
import CmsPageManager from "@/components/cms/CmsPageManager";
import { useCmsStore } from "@/components/cms/useCmsStore";
import { PlacedComponent } from "@/components/cms/cmsTypes";
import { Layers, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import CmsContentEditor from "@/components/cms/CmsContentEditor";

export default function CmsEditor() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [leftTab, setLeftTab] = useState<"components" | "pages" | "content">("content");
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const store = useCmsStore();

  // Admin check
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); return; }
    (supabase as any).from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }: any) => setIsAdmin(!!data));
  }, [user, authLoading]);

  const handleAddComponent = (type: string) => {
    const y = store.components.length * 20 + 40;
    store.addComponent(type, 40, y);
  };

  const handleSelectPage = useCallback((page: { id: string; layout: PlacedComponent[] }) => {
    setCurrentPageId(page.id);
    store.loadComponents(page.layout);
  }, [store]);

  const handleNewPage = useCallback(() => {
    setCurrentPageId(null);
    store.loadComponents([]);
  }, [store]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedId && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          store.deleteComponent(store.selectedId);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (store.selectedId) store.duplicateComponent(store.selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  // Loading state
  if (authLoading || isAdmin === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert size={32} className="text-destructive" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground">Admin Access Required</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The CMS Editor is restricted to administrators. Sign in with an admin account to manage pages.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <CmsToolbar
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        onUndo={store.undo}
        onRedo={store.redo}
        previewMode={previewMode}
        onPreviewMode={setPreviewMode}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar with tabs */}
        <div className={`${leftTab === "content" ? "flex-1" : "w-56"} border-r border-border bg-card flex flex-col shrink-0 transition-all`}>
          <div className="flex border-b border-border">
            <button
              onClick={() => setLeftTab("content")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${leftTab === "content" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <PenLine className="h-3.5 w-3.5" /> Content
            </button>
            <button
              onClick={() => setLeftTab("components")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${leftTab === "components" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Layers className="h-3.5 w-3.5" /> Layout
            </button>
            <button
              onClick={() => setLeftTab("pages")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${leftTab === "pages" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileText className="h-3.5 w-3.5" /> Pages
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {leftTab === "content" ? (
              <CmsContentEditor />
            ) : leftTab === "components" ? (
              <CmsComponentLibrary onAddComponent={handleAddComponent} />
            ) : (
              <CmsPageManager
                currentPageId={currentPageId}
                onSelectPage={handleSelectPage}
                onNewPage={handleNewPage}
                components={store.components}
              />
            )}
          </div>
        </div>

        {leftTab !== "content" && (
          <>
            <CmsCanvas
              components={store.components}
              selectedId={store.selectedId}
              previewMode={previewMode}
              onSelect={store.setSelectedId}
              onMove={store.moveComponent}
              onResize={store.resizeComponent}
              onDelete={store.deleteComponent}
              onDuplicate={store.duplicateComponent}
            />
            <CmsPropertiesPanel
              component={store.selectedComponent}
              onUpdateProps={store.updateProps}
              onMove={store.moveComponent}
              onResize={store.resizeComponent}
            />
          </>
        )}
      </div>
    </div>
  );
}
