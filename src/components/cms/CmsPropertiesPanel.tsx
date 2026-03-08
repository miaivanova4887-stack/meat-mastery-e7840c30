import { PlacedComponent } from "./cmsTypes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  component: PlacedComponent | null;
  onUpdateProps: (id: string, props: Record<string, unknown>) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
}

export default function CmsPropertiesPanel({ component, onUpdateProps, onMove, onResize }: Props) {
  if (!component) {
    return (
      <div className="w-60 border-l border-border bg-card flex items-center justify-center p-4 shrink-0">
        <p className="text-xs text-muted-foreground text-center">Select a component to edit its properties</p>
      </div>
    );
  }

  const stringProps = Object.entries(component.props).filter(
    ([, v]) => typeof v === "string" || typeof v === "number"
  );

  return (
    <div className="w-60 border-l border-border bg-card flex flex-col shrink-0">
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{component.label}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{component.type} · {component.id}</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Position */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Position</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">X</Label>
                <Input
                  type="number"
                  value={Math.round(component.x)}
                  onChange={e => onMove(component.id, Number(e.target.value), component.y)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Y</Label>
                <Input
                  type="number"
                  value={Math.round(component.y)}
                  onChange={e => onMove(component.id, component.x, Number(e.target.value))}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Size</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">W</Label>
                <Input
                  type="number"
                  value={Math.round(component.width)}
                  onChange={e => onResize(component.id, Number(e.target.value), component.height)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">H</Label>
                <Input
                  type="number"
                  value={Math.round(component.height)}
                  onChange={e => onResize(component.id, component.width, Number(e.target.value))}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Component Props */}
          {stringProps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Properties</p>
              <div className="space-y-2">
                {stringProps.map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-[10px] capitalize">{key.replace(/_/g, " ")}</Label>
                    <Input
                      value={String(value)}
                      onChange={e => onUpdateProps(component.id, { [key]: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
