import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert, PenLine, Layers, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import CmsContentEditor from "@/components/cms/CmsContentEditor";
import CmsLayoutBuilder from "@/components/cms/CmsLayoutBuilder";
import CmsPagesTab from "@/components/cms/CmsPagesTab";

type Tab = "content" | "layout" | "pages";

export default function CmsEditor() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const [activeTab, setActiveTab] = useState<Tab>("content");

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) { navigate("/", { replace: true }); return; }
    if (!isAdmin) { navigate("/", { replace: true }); return; }
  }, [authLoading, roleLoading, user, isAdmin, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert size={32} className="text-destructive" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground">Admin Access Required</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          The CMS Editor is restricted to administrators.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "content", label: "Content", icon: <PenLine className="h-4 w-4" /> },
    { key: "layout", label: "Layout Builder", icon: <Layers className="h-4 w-4" /> },
    { key: "pages", label: "Pages", icon: <FileText className="h-4 w-4" /> },
  ];

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
        {activeTab === "content" && <CmsContentEditor />}
        {activeTab === "layout" && <CmsLayoutBuilder />}
        {activeTab === "pages" && (
          <CmsPagesTab onNavigateToLayout={(slug) => { setActiveTab("layout"); }} />
        )}
      </div>
    </div>
  );
}
