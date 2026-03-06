import { useLocation, useNavigate } from "react-router-dom";
import { Flame, BookOpen, Dumbbell, Heart, Timer } from "lucide-react";

const tabs = [
  { path: "/", icon: Flame, label: "Home" },
  { path: "/recipes", icon: BookOpen, label: "Recipes" },
  { path: "/timer", icon: Timer, label: "Ketosis" },
  { path: "/exercise", icon: Dumbbell, label: "Exercise" },
  { path: "/stories", icon: Heart, label: "Stories" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={20} className={active ? "drop-shadow-[0_0_6px_hsl(var(--flame)/0.5)]" : ""} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
