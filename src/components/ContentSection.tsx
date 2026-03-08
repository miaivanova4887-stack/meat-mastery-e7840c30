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

const typeConfig: Record<SectionType, { icon: typeof FileText }> = {
  overview: { icon: FileText },
  key_points: { icon: List },
  tips: { icon: Lightbulb },
  data: { icon: TrendingUp },
  important: { icon: AlertCircle },
};

const ContentSection = ({ type, title, children, items, dataRows, defaultOpen = true }: ContentSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = typeConfig[type].icon;
  const isImportant = type === "important";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-fade-in-up">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={`p-2 rounded-md ${isImportant ? "bg-destructive/10" : "bg-primary/10"}`}>
          <Icon size={18} className={isImportant ? "text-destructive" : "text-primary"} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm leading-tight">{title}</h3>
        </div>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          {children && !isImportant && (
            <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>
          )}

          {children && isImportant && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 flex gap-2 text-xs text-muted-foreground">
              <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
              <span>{children}</span>
            </div>
          )}

          {items && type === "tips" && (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5 text-xs text-muted-foreground">
                  <Lightbulb size={14} className="text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}

          {items && type !== "tips" && (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          )}

          {dataRows && (
            <div className="divide-y divide-border">
              {dataRows.map((row, i) => (
                <div key={i} className="flex justify-between py-2.5 text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentSection;
