import { Undo2, Redo2, Eye, Download, Save, Monitor, Tablet, Smartphone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface CmsToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  previewMode: string;
  onPreviewMode: (mode: string) => void;
}

export default function CmsToolbar({ canUndo, canRedo, onUndo, onRedo, previewMode, onPreviewMode }: CmsToolbarProps) {
  const navigate = useNavigate();
  const [brandOption, setBrandOption] = useState<"epx" | "carnivorex">("epx");

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-2 shrink-0">
      <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground mr-2">
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Brand toggle */}
      <div className="flex items-center bg-muted rounded-lg p-0.5 mr-4">
        <button
          onClick={() => setBrandOption("epx")}
          className={`px-3 py-1 rounded-md text-xs font-bold tracking-widest transition-all ${
            brandOption === "epx"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          EPX
        </button>
        <button
          onClick={() => setBrandOption("carnivorex")}
          className={`px-3 py-1 rounded-md text-xs font-bold tracking-tight transition-all ${
            brandOption === "carnivorex"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          CarnivoreX
        </button>
      </div>

      <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">CMS</span>

      <div className="flex items-center gap-1 border-l border-border pl-3 ml-3">
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-l border-border pl-3 ml-1">
        {[
          { mode: "desktop", icon: Monitor },
          { mode: "tablet", icon: Tablet },
          { mode: "mobile", icon: Smartphone },
        ].map(({ mode, icon: Icon }) => (
          <Button
            key={mode}
            variant={previewMode === mode ? "secondary" : "ghost"}
            size="icon"
            onClick={() => onPreviewMode(mode)}
            title={mode}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="flex-1" />

      <Button variant="ghost" size="sm" className="gap-1.5">
        <Eye className="h-4 w-4" /> Preview
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5">
        <Download className="h-4 w-4" /> Export
      </Button>
      <Button size="sm" className="gap-1.5">
        <Save className="h-4 w-4" /> Save
      </Button>
    </header>
  );
}
