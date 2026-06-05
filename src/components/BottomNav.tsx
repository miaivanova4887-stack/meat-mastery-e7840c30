import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Flame, BookOpen, CalendarDays, User, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

/**
 * BottomNav portaled to <body> with a plain `position: fixed; bottom: 0`
 * anchor. The previous visualViewport-driven repositioning introduced a
 * one-frame lag on iOS WKWebView (visible wobble during scroll) and a 1–2px
 * band beneath the bar from rounded top math. Portaling escapes any ancestor
 * containing block (transforms / backdrop-filters) so the static anchor is
 * sufficient.
 */
const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const tabs = [
    { path: "/", icon: Flame, label: t("nav.home") },
    { path: "/recipes", icon: BookOpen, label: t("nav.recipes") },
    { path: "/meal-plan", icon: CalendarDays, label: t("nav.plan") },
    { path: "/progress", icon: TrendingUp, label: t("nav.progress") },
  ];

  if (location.pathname === "/onboarding" || location.pathname === "/recipe-coach") return null;
  if (typeof document === "undefined") return null;

  const nav = (
    <nav
      className="z-50 bg-card/95 dark:bg-black/95 ios-blur shadow-lg bottom-nav border-t border-border/40 dark:border-white/5"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        transform: "none",
        willChange: "auto",
        contain: "layout style",
      }}
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
              {active && <span className="w-1 h-1 rounded-full bg-primary" />}
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

  return createPortal(nav, document.body);
};

export default BottomNav;
