import { useLocation, useNavigate } from "react-router-dom";
import { Flame, BookOpen, CalendarDays, User, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const tabs = [
    { path: "/", icon: Flame, label: t("nav.home") },
    { path: "/recipes", icon: BookOpen, label: t("nav.recipes") },
    { path: "/meal-plan", icon: CalendarDays, label: t("nav.plan") },
    { path: "/community", icon: Users, label: "Community" },
    { path: "/progress", icon: TrendingUp, label: t("nav.progress") },
  ];

  if (location.pathname === "/onboarding") return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-card/90 ios-blur shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
    >
      <div className="flex items-center justify-around py-2 px-1">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
        <button
          onClick={() => navigate(user ? "/profile" : "/auth")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
            ["/auth", "/profile"].includes(location.pathname) ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <User size={22} strokeWidth={["/auth", "/profile"].includes(location.pathname) ? 2.2 : 1.6} />
          <span className="text-[11px] font-medium">{user ? t("nav.profile") : t("nav.signIn")}</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
