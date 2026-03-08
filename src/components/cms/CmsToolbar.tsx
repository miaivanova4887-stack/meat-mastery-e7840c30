import { Undo2, Redo2, Eye, Download, Save, Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CmsToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  previewMode: string;
  onPreviewMode: (mode: string) => void;
}

export default function CmsToolbar({ canUndo, canRedo, onUndo, onRedo, previewMode, onPreviewMode }: CmsToolbarProps) {
  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-2 shrink-0">
      <span className="font-bold text-sm tracking-tight text-foreground mr-4">CMS Editor</span>

      <div className="flex items-center gap-1 border-r border-border pr-3 mr-3">
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-r border-border pr-3 mr-3">
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
