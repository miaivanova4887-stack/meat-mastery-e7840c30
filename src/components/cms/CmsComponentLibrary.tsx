import { useState } from "react";
import { Search } from "lucide-react";
import * as Icons from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMPONENT_LIBRARY, CATEGORY_LABELS, ComponentCategory, CmsComponentDefinition } from "./cmsTypes";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  onAddComponent: (type: string) => void;
}

export default function CmsComponentLibrary({ onAddComponent }: Props) {
  const [search, setSearch] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<ComponentCategory>>(
    new Set(Object.keys(CATEGORY_LABELS) as ComponentCategory[])
  );

  const filtered = COMPONENT_LIBRARY.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = (Object.keys(CATEGORY_LABELS) as ComponentCategory[]).map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: filtered.filter(c => c.category === cat),
  })).filter(g => g.items.length > 0);

  const toggleCat = (cat: ComponentCategory) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const getIcon = (name: string) => {
    const Icon = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[name];
    return Icon ? <Icon className="h-4 w-4 text-muted-foreground shrink-0" /> : null;
  };

  return (
    <div className="w-56 border-r border-border bg-card flex flex-col shrink-0">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search components…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {grouped.map(({ cat, label, items }) => (
            <div key={cat} className="mb-1">
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <Icons.ChevronRight className={`h-3 w-3 transition-transform ${expandedCats.has(cat) ? "rotate-90" : ""}`} />
                {label}
              </button>
              {expandedCats.has(cat) && (
                <div className="ml-1 space-y-0.5">
                  {items.map(comp => (
                    <button
                      key={comp.type}
                      onClick={() => onAddComponent(comp.type)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    >
                      {getIcon(comp.icon)}
                      {comp.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
