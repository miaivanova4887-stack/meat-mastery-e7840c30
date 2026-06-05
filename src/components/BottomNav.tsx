import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Flame, BookOpen, CalendarDays, User, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

/**
 * BottomNav portaled to <body> and anchored to the VISUAL viewport (not the
 * layout viewport). On iOS WKWebView some scroll contexts shift the layout
 * viewport while the visual viewport stays put — that mismatch was making the
 * "fixed" bar drift mid-screen during scroll. We listen on
 * window.visualViewport and set explicit `top` accordingly.
 */
const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement | null>(null);
  const [top, setTop] = useState<number | null>(null);

  // Approximate height of the nav incl. safe-area. We measure the real value
  // after mount and from there subtract it from visualViewport bottom.
  const NAV_HEIGHT_FALLBACK = 72;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const navH = navRef.current?.offsetHeight || NAV_HEIGHT_FALLBACK;
      // Top of nav = top of visual viewport + visual viewport height - nav height
      const next = Math.round(vv.offsetTop + vv.height - navH);
      setTop(next);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const tabs = [
    { path: "/", icon: Flame, label: t("nav.home") },
    { path: "/recipes", icon: BookOpen, label: t("nav.recipes") },
    { path: "/meal-plan", icon: CalendarDays, label: t("nav.plan") },
    { path: "/progress", icon: TrendingUp, label: t("nav.progress") },
  ];

  if (location.pathname === "/onboarding" || location.pathname === "/recipe-coach") return null;
  if (typeof document === "undefined") return null;

  // Style: pin via top when visualViewport is supported, otherwise fall back
  // to bottom:0 fixed. Either way we explicitly null out transform/filter so
  // no inherited containing block can capture us.
  const useVV = typeof window !== "undefined" && !!window.visualViewport && top !== null;
  const positionalStyle: React.CSSProperties = useVV
    ? {
        position: "fixed",
        top: `${top}px`,
        left: 0,
        right: 0,
        width: "100%",
      }
    : {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
      };

  const nav = (
    <nav
      ref={navRef}
      className="z-50 bg-card/95 dark:bg-black/95 ios-blur shadow-lg bottom-nav border-t border-border/40 dark:border-white/5"
      style={{
        ...positionalStyle,
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
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
