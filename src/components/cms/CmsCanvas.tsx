import { useRef, useState, useCallback } from "react";
import { PlacedComponent } from "./cmsTypes";
import CmsCanvasComponent from "./CmsCanvasComponent";

interface Props {
  components: PlacedComponent[];
  selectedId: string | null;
  previewMode: string;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const CANVAS_WIDTHS: Record<string, number> = {
  desktop: 1200,
  tablet: 768,
  mobile: 375,
};

export default function CmsCanvas({
  components, selectedId, previewMode, onSelect, onMove, onResize, onDelete, onDuplicate,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const canvasWidth = CANVAS_WIDTHS[previewMode] || 1200;

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) onSelect(null);
  };

  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(id);
    const comp = components.find(c => c.id === id);
    if (!comp || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ id, offsetX: e.clientX - rect.left - comp.x, offsetY: e.clientY - rect.top - comp.y });
  }, [components, onSelect]);

  const handleResizeStart = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const comp = components.find(c => c.id === id);
    if (!comp) return;
    setResizing({ id, startX: e.clientX, startY: e.clientY, startW: comp.width, startH: comp.height });
  }, [components]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(0, e.clientX - rect.left - dragging.offsetX);
      const y = Math.max(0, e.clientY - rect.top - dragging.offsetY);
      onMove(dragging.id, x, y);
    }
    if (resizing) {
      const dw = e.clientX - resizing.startX;
      const dh = e.clientY - resizing.startY;
      onResize(resizing.id, resizing.startW + dw, resizing.startH + dh);
    }
  }, [dragging, resizing, onMove, onResize]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  return (
    <div className="flex-1 bg-muted/30 overflow-auto p-6 flex justify-center">
      <div
        ref={canvasRef}
        className="relative bg-background border border-border rounded-lg shadow-sm"
        style={{ width: canvasWidth, minHeight: 600 }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {components.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
            Click a component from the library to add it here
          </div>
        )}
        {components.map(comp => (
          <CmsCanvasComponent
            key={comp.id}
            component={comp}
            isSelected={comp.id === selectedId}
            onMouseDown={handleMouseDown}
            onResizeStart={handleResizeStart}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        ))}
      </div>
    </div>
  );
}
