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
  const { refreshPermission } = useCameraPermission();
  const fileRef = useRef<HTMLInputElement>(null);
  const addEntry = useAddEntry();
  const profile = useUserProfile();
  const { t } = useTranslation();

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
    }
  }, [profile.goal]);

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
          e.target.value = "";
        }}
      />

      <CameraPermissionExplainer
        open={showExplainer}
        mode="purpose"
        onClose={() => setShowExplainer(false)}
        onContinue={() => {
          setShowExplainer(false);
          try { localStorage.setItem(PHOTO_EXPLAINER_SEEN_KEY, "1"); } catch { /* ignore */ }
          fileRef.current?.click();
        }}
      />

      {!result ? (
        <button
          onClick={() => {
            const seen = (() => { try { return localStorage.getItem(PHOTO_EXPLAINER_SEEN_KEY) === "1"; } catch { return false; } })();
            if (!seen) { setShowExplainer(true); return; }
            fileRef.current?.click();
          }}
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