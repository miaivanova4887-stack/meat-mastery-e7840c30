import { useState, useRef, useCallback } from "react";
import { Camera, Loader2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { useAddEntry } from "@/hooks/useProgress";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import CameraPermissionExplainer, { type CameraExplainerMode } from "@/components/CameraPermissionExplainer";
import { useCameraPermission } from "@/hooks/useCameraPermission";
import { openAppSettings } from "@/lib/openAppSettings";

const PHOTO_EXPLAINER_SEEN_KEY = "camera-photo-explainer-seen";

const PhotoRecognition = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [explainer, setExplainer] = useState<{ open: boolean; mode: CameraExplainerMode }>({
    open: false,
    mode: "purpose",
  });
  const { state, requestPermission, refreshPermission } = useCameraPermission();
  const fileRef = useRef<HTMLInputElement>(null);
  const addEntry = useAddEntry();
  const profile = useUserProfile();
  const { t } = useTranslation();

  // Always reset the input value before/after every interaction so a second
  // tap can re-trigger the picker even if the user cancelled or re-picked
  // the same file. Without this the change event won't fire on iOS.
  const resetFileInput = useCallback(() => {
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const openPicker = useCallback(() => {
    resetFileInput();
    fileRef.current?.click();
  }, [resetFileInput]);

  const handlePhoto = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("recognize-food", {
        body: { imageBase64: base64, dietTier: profile.goal },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      setResult(data.result);
    } catch (e: any) {
      toast.error(e?.message || "Failed to recognize food");
    } finally {
      setLoading(false);
      resetFileInput();
    }
  }, [profile.goal, resetFileInput]);

  const logToProgress = useCallback(() => {
    if (!result) return;
    const now = new Date().toISOString();
    const note = `[meal-sync] ${result.recipeName} (${quantity}x)`;

    const entries = [
      { category: "diet_trends", metric: "calories", value: (parseFloat(result.cal) || 0) * quantity, unit: "kcal", notes: note, recorded_at: now },
      { category: "diet_trends", metric: "protein", value: (parseFloat(result.protein) || 0) * quantity, unit: "g", notes: note, recorded_at: now },
      { category: "diet_trends", metric: "fat", value: (parseFloat(result.fat) || 0) * quantity, unit: "g", notes: note, recorded_at: now },
    ];

    Promise.all(entries.map((e) => addEntry.mutateAsync(e)))
      .then(() => {
        toast.success(`${result.recipeName} logged to progress`);
        setResult(null);
        setQuantity(1);
      })
      .catch(() => toast.error("Failed to log nutrients"));
  }, [result, addEntry, quantity]);

  const handleSnapTap = useCallback(async () => {
    // 1. Sync live OS state. On iOS this often returns "unknown", so we
    //    can't trust it alone — but if it definitively says "denied" we
    //    can short-circuit to the re-entry modal.
    const synced = await refreshPermission();
    if (synced === "denied") {
      setExplainer({ open: true, mode: "denied" });
      return;
    }

    // 2. First-ever tap: show the App Review 5.1.1 purpose explainer
    //    before doing anything camera-related.
    const seen = (() => { try { return localStorage.getItem(PHOTO_EXPLAINER_SEEN_KEY) === "1"; } catch { return false; } })();
    if (!seen && synced !== "granted") {
      setExplainer({ open: true, mode: "purpose" });
      return;
    }

    // 3. Authoritative probe via getUserMedia — the only source of truth
    //    on iOS WKWebView. The capture="" file picker does NOT share the
    //    Permissions API gate, so without this probe we'd open a dark/dead
    //    picker after a previous denial.
    const probe = await requestPermission();
    if (probe === "granted") {
      openPicker();
      return;
    }
    if (probe === "denied") {
      setExplainer({ open: true, mode: "denied" });
      return;
    }
    // unavailable (e.g. desktop without camera) — fall back to picker;
    // worst case the user picks from library.
    openPicker();
  }, [refreshPermission, requestPermission, openPicker]);

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePhoto(f);
          // Reset immediately so the next tap always re-fires onChange,
          // even if the user re-selects the same file or cancels.
          e.target.value = "";
        }}
      />

      <CameraPermissionExplainer
        open={explainer.open}
        mode={explainer.mode}
        onClose={() => setExplainer((p) => ({ ...p, open: false }))}
        onContinue={async () => {
          const mode = explainer.mode;
          setExplainer({ open: false, mode });
          if (mode === "denied") {
            await openAppSettings();
            return;
          }
          // Purpose explainer Continue — mark seen and run the authoritative
          // probe. Only open the picker if the OS actually granted access;
          // otherwise show the denied modal immediately so the user isn't
          // left staring at a dead camera screen.
          try { localStorage.setItem(PHOTO_EXPLAINER_SEEN_KEY, "1"); } catch { /* ignore */ }
          const probe = await requestPermission();
          if (probe === "granted") {
            openPicker();
            return;
          }
          if (probe === "denied") {
            setExplainer({ open: true, mode: "denied" });
            return;
          }
          // unavailable — still try the picker
          openPicker();
        }}
      />

      {!result ? (
        <button
          onClick={handleSnapTap}
          disabled={loading}
          className="w-full relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card p-5 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.04]" />
          <div className="relative flex flex-col items-center gap-2">
            {loading ? (
              <>
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">{t("progress.analyzingFood")}</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera size={22} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("progress.snapLog")}</p>
                <p className="text-[11px] text-muted-foreground">{t("progress.snapLogDesc")}</p>
              </>
            )}
          </div>
        </button>
      ) : (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">{result.recipeName}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("progress.confidence")}: <span className={result.confidence === "high" ? "text-green-500" : result.confidence === "medium" ? "text-yellow-500" : "text-red-400"}>{result.confidence}</span>
              </p>
            </div>
          </div>

          {/* Quantity Adjuster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t("progress.quantity")}</p>
              <p className="text-sm font-bold text-foreground">{quantity}x</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.max(0.25, quantity - 0.25))}>
                <Minus size={14} />
              </Button>
              <Slider value={[quantity]} onValueChange={([v]) => setQuantity(v)} min={0.25} max={4} step={0.25} className="flex-1" />
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.min(4, quantity + 0.25))}>
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round((parseFloat(result.cal) || 0) * quantity)}</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.calories")}</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round((parseFloat(result.protein) || 0) * quantity)}</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.protein")}</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round((parseFloat(result.fat) || 0) * quantity)}</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.fat")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={logToProgress} className="flex-1" disabled={addEntry.isPending}>
              {addEntry.isPending ? t("progress.logging") : t("progress.logToProgress")}
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setQuantity(1); }}>{t("progress.dismiss")}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoRecognition;
