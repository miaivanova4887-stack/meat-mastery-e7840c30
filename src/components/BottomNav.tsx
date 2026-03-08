import { useLocation, useNavigate } from "react-router-dom";
import { Flame, BookOpen, Timer, CalendarDays, User, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const tabs = [
  { path: "/", icon: Flame, label: "Home" },
  { path: "/recipes", icon: BookOpen, label: "Recipes" },
  { path: "/meal-plan", icon: CalendarDays, label: "Plan" },
  { path: "/progress", icon: TrendingUp, label: "Progress" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (location.pathname === "/onboarding") return null;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/80 ios-blur safe-area-bottom">
      <div className="flex items-center justify-around py-1.5 px-1">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
        <button
          onClick={() => navigate(user ? "/profile" : "/auth")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
            ["/auth", "/profile"].includes(location.pathname) ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <User size={22} strokeWidth={["/auth", "/profile"].includes(location.pathname) ? 2.2 : 1.6} />
          <span className="text-[10px] font-medium">{user ? "Profile" : "Sign In"}</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
