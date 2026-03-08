import { PlacedComponent } from "./cmsTypes";
import { Trash2, Copy } from "lucide-react";

interface Props {
  component: PlacedComponent;
  isSelected: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onResizeStart: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function renderPreview(comp: PlacedComponent) {
  const { type, props, width, height } = comp;

  switch (type) {
    case "text":
      return <p className="text-sm text-foreground px-2 py-1 truncate">{String(props.content || "Text")}</p>;
    case "heading":
      return <h2 className="text-lg font-bold text-foreground px-2 py-1 truncate">{String(props.content || "Heading")}</h2>;
    case "button":
      return (
        <div className="px-2 py-1 flex items-center justify-center h-full">
          <div className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium text-center truncate">
            {String(props.text || "Button")}
          </div>
        </div>
      );
    case "image":
      return (
        <div className="bg-muted flex items-center justify-center h-full rounded text-muted-foreground text-xs">
          📷 Image
        </div>
      );
    case "divider":
      return <div className="w-full flex items-center h-full px-2"><div className="w-full border-t border-border" /></div>;
    case "spacer":
      return <div className="w-full h-full bg-muted/20 border border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-[10px]">Spacer</div>;
    case "card":
      return (
        <div className="border border-border rounded-lg p-3 h-full bg-card">
          <div className="font-semibold text-sm text-card-foreground mb-1">{String(props.title || "Card")}</div>
          <div className="text-xs text-muted-foreground">Card content area</div>
        </div>
      );
    case "panel":
      return <div className="border border-border rounded-lg p-3 h-full bg-card text-xs text-muted-foreground">Panel</div>;
    case "tabs":
      return (
        <div className="h-full flex flex-col">
          <div className="flex border-b border-border">
            {(Array.isArray(props.tabs) ? props.tabs : []).map((t, i) => (
              <div key={i} className={`px-3 py-1.5 text-xs ${i === 0 ? "border-b-2 border-primary text-foreground font-medium" : "text-muted-foreground"}`}>
                {String(t)}
              </div>
            ))}
          </div>
          <div className="flex-1 p-2 text-xs text-muted-foreground">Tab content</div>
        </div>
      );
    case "input":
      return (
        <div className="px-2 py-1 space-y-1">
          <label className="text-xs font-medium text-foreground">{String(props.label || "Label")}</label>
          <div className="border border-border rounded px-2 py-1.5 text-xs text-muted-foreground bg-background">
            {String(props.placeholder || "Input")}
          </div>
        </div>
      );
    case "textarea":
      return (
        <div className="border border-border rounded px-2 py-1.5 text-xs text-muted-foreground bg-background h-full mx-2 my-1">
          {String(props.placeholder || "Textarea")}
        </div>
      );
    case "select":
      return (
        <div className="px-2 py-1">
          <div className="border border-border rounded px-2 py-1.5 text-xs text-muted-foreground bg-background flex items-center justify-between">
            <span>Select…</span>
            <span>▾</span>
          </div>
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-4 h-4 border border-border rounded" />
          <span className="text-xs text-foreground">{String(props.label || "Checkbox")}</span>
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-8 h-4 rounded-full bg-muted border border-border relative">
            <div className="absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-muted-foreground" />
          </div>
          <span className="text-xs text-foreground">{String(props.label || "Toggle")}</span>
        </div>
      );
    case "table":
      return (
        <div className="p-1 text-[10px] h-full overflow-hidden">
          <table className="w-full border-collapse">
            <thead><tr>{Array.from({ length: Number(props.cols || 3) }).map((_, i) => <th key={i} className="border border-border px-1 py-0.5 bg-muted text-muted-foreground">Col {i+1}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: Number(props.rows || 2) }).map((_, r) => (
                <tr key={r}>{Array.from({ length: Number(props.cols || 3) }).map((_, c) => <td key={c} className="border border-border px-1 py-0.5 text-foreground">—</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return (
        <div className="px-2 py-1 space-y-0.5">
          {(Array.isArray(props.items) ? props.items : []).map((item, i) => (
            <div key={i} className="text-xs text-foreground flex items-center gap-1">• {String(item)}</div>
          ))}
        </div>
      );
    case "badge":
      return (
        <div className="px-2 py-1 flex items-center h-full">
          <span className="bg-primary/10 text-primary text-[10px] font-medium px-2 py-0.5 rounded-full">{String(props.text || "Badge")}</span>
        </div>
      );
    case "navbar":
      return (
        <div className="flex items-center gap-4 px-3 h-full border-b border-border bg-card">
          {(Array.isArray(props.items) ? props.items : []).map((item, i) => (
            <span key={i} className="text-xs text-foreground font-medium">{String(item)}</span>
          ))}
        </div>
      );
    case "breadcrumb":
      return (
        <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
          {(Array.isArray(props.items) ? props.items : []).map((item, i, arr) => (
            <span key={i}>{String(item)}{i < arr.length - 1 ? " /" : ""}</span>
          ))}
        </div>
      );
    default:
      return <div className="flex items-center justify-center h-full text-xs text-muted-foreground">{comp.label}</div>;
  }
}

export default function CmsCanvasComponent({ component, isSelected, onMouseDown, onResizeStart, onDelete, onDuplicate }: Props) {
  return (
    <div
      className={`absolute cursor-move group ${isSelected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"}`}
      style={{ left: component.x, top: component.y, width: component.width, height: component.height }}
      onMouseDown={e => onMouseDown(component.id, e)}
    >
      {renderPreview(component)}

      {isSelected && (
        <>
          {/* Resize handle */}
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-primary rounded-sm cursor-se-resize"
            onMouseDown={e => onResizeStart(component.id, e)}
          />
          {/* Action buttons */}
          <div className="absolute -top-7 right-0 flex gap-0.5">
            <button
              onClick={e => { e.stopPropagation(); onDuplicate(component.id); }}
              className="p-1 bg-card border border-border rounded shadow-sm hover:bg-accent"
            >
              <Copy className="h-3 w-3 text-foreground" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(component.id); }}
              className="p-1 bg-card border border-border rounded shadow-sm hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
