import { useState, useCallback } from "react";
import { PlacedComponent, COMPONENT_LIBRARY } from "./cmsTypes";

let nextId = 1;

export function useCmsStore() {
  const [components, setComponents] = useState<PlacedComponent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<PlacedComponent[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback((next: PlacedComponent[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, next];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const addComponent = useCallback((type: string, x: number, y: number) => {
    const def = COMPONENT_LIBRARY.find(c => c.type === type);
    if (!def) return;
    const newComp: PlacedComponent = {
      id: `comp_${nextId++}`,
      type: def.type,
      label: def.label,
      x,
      y,
      width: def.defaultWidth,
      height: def.defaultHeight,
      props: { ...def.defaultProps },
    };
    const next = [...components, newComp];
    setComponents(next);
    setSelectedId(newComp.id);
    pushHistory(next);
  }, [components, pushHistory]);

  const moveComponent = useCallback((id: string, x: number, y: number) => {
    const next = components.map(c => c.id === id ? { ...c, x, y } : c);
    setComponents(next);
    pushHistory(next);
  }, [components, pushHistory]);

  const resizeComponent = useCallback((id: string, width: number, height: number) => {
    const next = components.map(c => c.id === id ? { ...c, width: Math.max(40, width), height: Math.max(20, height) } : c);
    setComponents(next);
    pushHistory(next);
  }, [components, pushHistory]);

  const updateProps = useCallback((id: string, props: Record<string, unknown>) => {
    const next = components.map(c => c.id === id ? { ...c, props: { ...c.props, ...props } } : c);
    setComponents(next);
    pushHistory(next);
  }, [components, pushHistory]);

  const deleteComponent = useCallback((id: string) => {
    const next = components.filter(c => c.id !== id);
    setComponents(next);
    if (selectedId === id) setSelectedId(null);
    pushHistory(next);
  }, [components, selectedId, pushHistory]);

  const duplicateComponent = useCallback((id: string) => {
    const src = components.find(c => c.id === id);
    if (!src) return;
    const dup: PlacedComponent = { ...src, id: `comp_${nextId++}`, x: src.x + 20, y: src.y + 20, props: { ...src.props } };
    const next = [...components, dup];
    setComponents(next);
    setSelectedId(dup.id);
    pushHistory(next);
  }, [components, pushHistory]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    setComponents(history[newIdx]);
    setSelectedId(null);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    setComponents(history[newIdx]);
    setSelectedId(null);
  }, [history, historyIndex]);

  const selectedComponent = components.find(c => c.id === selectedId) || null;

  return {
    components,
    selectedId,
    selectedComponent,
    setSelectedId,
    addComponent,
    moveComponent,
    resizeComponent,
    updateProps,
    deleteComponent,
    duplicateComponent,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}
