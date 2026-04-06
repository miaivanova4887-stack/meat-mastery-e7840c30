import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, Layers, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import CmsContentEditor from "@/components/cms/CmsContentEditor";
import CmsLayoutBuilder from "@/components/cms/CmsLayoutBuilder";
import CmsPagesTab from "@/components/cms/CmsPagesTab";

type Tab = "content" | "layout" | "pages";

export default function CmsEditor() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [adminStatus, setAdminStatus] = useState<'checking' | 'admin' | 'denied'>('checking');
  const [activeTab, setActiveTab] = useState<Tab>("content");
  const [sharedSlug, setSharedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAdminStatus('denied'); return; }
    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setAdminStatus(!!data && !error ? 'admin' : 'denied');
    };
    checkAdmin();
  }, [user, authLoading]);

  if (adminStatus === 'checking') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (adminStatus === 'denied') {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "content", label: "Content", icon: <PenLine className="h-4 w-4" /> },
    { key: "layout", label: "Layout Builder", icon: <Layers className="h-4 w-4" /> },
    { key: "pages", label: "Pages", icon: <FileText className="h-4 w-4" /> },
  ];

  const navigateToTab = (tab: Tab, slug?: string) => {
    if (slug) setSharedSlug(slug);
    setActiveTab(tab);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex items-center border-b border-border bg-card px-4 shrink-0">
        <span className="text-sm font-bold text-foreground mr-6 py-3">CMS</span>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/")}>
            ← Back to App
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "content" && <CmsContentEditor initialSlug={sharedSlug} onSlugChange={setSharedSlug} />}
        {activeTab === "layout" && <CmsLayoutBuilder initialSlug={sharedSlug} onSlugChange={setSharedSlug} />}
        {activeTab === "pages" && (
          <CmsPagesTab onNavigateToLayout={(slug) => navigateToTab("layout", slug)} onNavigateToContent={(slug) => navigateToTab("content", slug)} />
        )}
      </div>
    </div>
  );
}