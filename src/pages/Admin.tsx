import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card } from "@/components/ui/card";
import { BarChart3, Bell, FileEdit, Loader2 } from "lucide-react";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Admin · CarnivoreX";
  }, []);

  // While auth or role checks are pending, show loading — never fall through to 404.
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated → sign in (preserve return path)
  if (!user) {
    navigate("/auth?returnTo=/admin", { replace: true });
    return null;
  }

  // Authenticated but not admin → home (not 404)
  if (!isAdmin) {
    navigate("/", { replace: true });
    return null;
  }

  const tiles = [
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3, desc: "Revenue, retention, LTV" },
    { to: "/admin/notifications", label: "Notifications", icon: Bell, desc: "Send push & feed posts" },
    { to: "/cms", label: "CMS Editor", icon: FileEdit, desc: "Content, layouts & pages" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <header
        className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        <div className="px-4 pb-4">
          <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage analytics, notifications and content.
          </p>
        </div>
      </header>

      <main className="px-4 pt-6 max-w-2xl mx-auto space-y-3">
        {tiles.map(({ to, label, icon: Icon, desc }) => (
          <Link key={to} to={to} className="block">
            <Card className="ios-card p-4 flex items-center gap-4 hover:bg-accent/30 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{label}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            </Card>
          </Link>
        ))}
      </main>
    </div>
  );
};

export default Admin;
