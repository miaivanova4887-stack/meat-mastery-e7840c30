import { useState, useEffect } from "react";
import CmsToolbar from "@/components/cms/CmsToolbar";
import CmsComponentLibrary from "@/components/cms/CmsComponentLibrary";
import CmsCanvas from "@/components/cms/CmsCanvas";
import CmsPropertiesPanel from "@/components/cms/CmsPropertiesPanel";
import { useCmsStore } from "@/components/cms/useCmsStore";

export default function CmsEditor() {
  const [previewMode, setPreviewMode] = useState("desktop");
  const store = useCmsStore();

  // Place new component at a default position
  const handleAddComponent = (type: string) => {
    const y = store.components.length * 20 + 40;
    store.addComponent(type, 40, y);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedId && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          store.deleteComponent(store.selectedId);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (store.selectedId) store.duplicateComponent(store.selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <CmsToolbar
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        onUndo={store.undo}
        onRedo={store.redo}
        previewMode={previewMode}
        onPreviewMode={setPreviewMode}
      />
      <div className="flex flex-1 overflow-hidden">
        <CmsComponentLibrary onAddComponent={handleAddComponent} />
        <CmsCanvas
          components={store.components}
          selectedId={store.selectedId}
          previewMode={previewMode}
          onSelect={store.setSelectedId}
          onMove={store.moveComponent}
          onResize={store.resizeComponent}
          onDelete={store.deleteComponent}
          onDuplicate={store.duplicateComponent}
        />
        <CmsPropertiesPanel
          component={store.selectedComponent}
          onUpdateProps={store.updateProps}
          onMove={store.moveComponent}
          onResize={store.resizeComponent}
        />
      </div>
    </div>
  );
}
