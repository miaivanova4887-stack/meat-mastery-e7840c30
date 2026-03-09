import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex items-center w-[52px] h-7 rounded-full bg-black/30 backdrop-blur-md border border-white/10 transition-all active:scale-95"
      aria-label="Toggle theme"
    >
      {/* Sliding indicator */}
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white/90 shadow-sm transition-transform duration-200 ease-out ${
          isDark ? "translate-x-[24px]" : "translate-x-0.5"
        }`}
      />
      {/* Icons */}
      <span
        className={`relative z-10 flex-1 flex items-center justify-center transition-colors duration-200 ${
          !isDark ? "text-black" : "text-white/60"
        }`}
      >
        <Sun size={12} strokeWidth={2.5} />
      </span>
      <span
        className={`relative z-10 flex-1 flex items-center justify-center transition-colors duration-200 ${
          isDark ? "text-black" : "text-white/60"
        }`}
      >
        <Moon size={12} strokeWidth={2.5} />
      </span>
    </button>
  );
};

export default ThemeToggle;
