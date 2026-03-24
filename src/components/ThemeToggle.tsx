import { Moon, Sun, Smartphone } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useRef, useEffect } from "react";

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Smartphone },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-card/60 backdrop-blur-md border border-border/40 text-muted-foreground hover:text-foreground transition-colors active:scale-95"
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <Sun size={16} strokeWidth={2} />
        ) : (
          <Moon size={16} strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[140px] rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden animate-fade-in-up">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => {
                setTheme(value);
                setOpen(false);
              }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                theme === value
                  ? "text-foreground bg-accent/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
