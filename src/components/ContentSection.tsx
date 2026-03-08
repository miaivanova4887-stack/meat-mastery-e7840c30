import { useState } from "react";
import { ChevronDown, FileText, List, Lightbulb, TrendingUp, AlertCircle } from "lucide-react";

type SectionType = "overview" | "key_points" | "tips" | "data" | "important";

interface DataRow {
  label: string;
  value: string;
}

interface ContentSectionProps {
  type: SectionType;
  title: string;
  children?: React.ReactNode;
  items?: string[];
  dataRows?: DataRow[];
  defaultOpen?: boolean;
}

const typeConfig: Record<SectionType, { label: string; icon: typeof FileText; color: string; borderColor: string; bgColor: string }> = {
  overview: {
    label: "OVERVIEW",
    icon: FileText,
    color: "text-primary",
    borderColor: "border-l-primary",
    bgColor: "bg-primary/10",
  },
  key_points: {
    label: "KEY POINTS",
    icon: List,
    color: "text-emerald-400",
    borderColor: "border-l-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
  tips: {
    label: "TIPS",
    icon: Lightbulb,
    color: "text-pink-400",
    borderColor: "border-l-pink-400",
    bgColor: "bg-pink-400/10",
  },
  data: {
    label: "DATA",
    icon: TrendingUp,
    color: "text-blue-400",
    borderColor: "border-l-blue-400",
    bgColor: "bg-blue-400/10",
  },
  important: {
    label: "IMPORTANT",
    icon: AlertCircle,
    color: "text-destructive",
    borderColor: "border-l-destructive",
    bgColor: "bg-destructive/10",
  },
};

const ContentSection = ({ type, title, children, items, dataRows, defaultOpen = true }: ContentSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className={`bg-card border border-border rounded-lg overflow-hidden border-l-4 ${config.borderColor} animate-fade-in-up`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon size={18} className={config.color} />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-bold tracking-widest ${config.color}`}>
            {config.label}
          </span>
          <h3 className="font-semibold text-foreground text-sm leading-tight">{title}</h3>
        </div>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          {children && type !== "important" && (
            <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
          )}

          {children && type === "important" && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex gap-2 text-sm text-muted-foreground">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <span>{children}</span>
            </div>
          )}

          {items && type === "tips" && (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
                  <Lightbulb size={14} className="text-pink-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}

          {items && type !== "tips" && (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${config.color.replace("text-", "bg-")}`} />
                  {item}
                </li>
              ))}
            </ul>
          )}

          {dataRows && (
            <div className="divide-y divide-border">
              {dataRows.map((row, i) => (
                <div key={i} className="flex justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={`font-medium ${config.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {type === "important" && children && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex gap-2 text-sm text-muted-foreground">
              <AlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
              <span>{children}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentSection;
