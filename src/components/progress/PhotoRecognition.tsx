import { useState, useRef, useCallback, useEffect } from "react";
import { Camera as CameraIcon, Loader2, Plus, Minus } from "lucide-react";
import { Capacitor } from "@capacitor/core";
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
  const { requestPermission, refreshPermission } = useCameraPermission();
  // Track the currently-attached transient input so we can clean it up on unmount.
  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const addEntry = useAddEntry();
  const profile = useUserProfile();
  const { t } = useTranslation();

  const handlePhotoFromBase64 = useCallback(async (base64: string) => {
    setLoading(true);
    setResult(null);
    try {
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

  const handlePhotoFromFile = useCallback(async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await handlePhotoFromBase64(base64);
  }, [handlePhotoFromBase64]);

  /**
   * WEB fallback: create a brand-new <input type="file" capture="environment">
   * for every open attempt. Reusing the same node in WKWebView leaves the
   * picker in a stale state after the user round-trips through iOS Settings,
   * which is why the second tap silently no-ops.
   */
  const openFreshFileInput = useCallback((withCapture: boolean) => {
    // Clean up any dangling input from a previous attempt.
    if (activeInputRef.current?.parentNode) {
      activeInputRef.current.parentNode.removeChild(activeInputRef.current);
    }
    activeInputRef.current = null;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (withCapture) input.setAttribute("capture", "environment");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "-9999px";
    input.style.opacity = "0";

    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input);
      if (activeInputRef.current === input) activeInputRef.current = null;
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handlePhotoFromFile(file);
      cleanup();
    };

    // Detect cancel via focus return — not 100% reliable but good enough
    // for cleanup so the node doesn't pile up in the DOM.
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      setTimeout(() => {
        if (!input.files || input.files.length === 0) cleanup();
      }, 500);
    };
    window.addEventListener("focus", onFocus);

    document.body.appendChild(input);
    activeInputRef.current = input;
    input.click();
  }, [handlePhotoFromFile]);

  /**
   * NATIVE path: use @capacitor/camera which goes straight to the OS
   * camera UI. This bypasses the WKWebView file-picker permission gate
   * entirely — the same path Barcode Scan effectively uses.
   */
  const openNativeCamera = useCallback(async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        quality: 80,
        correctOrientation: true,
        saveToGallery: false,
      });
      if (photo?.base64String) {
        await handlePhotoFromBase64(photo.base64String);
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "").toLowerCase();
      if (msg.includes("cancel")) return; // user backed out
      if (msg.includes("denied") || msg.includes("permission") || msg.includes("not allowed")) {
        setExplainer({ open: true, mode: "denied" });
        return;
      }
      toast.error(err?.message || "Failed to open camera");
    }
  }, [handlePhotoFromBase64]);

  const launchCamera = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      await openNativeCamera();
    } else {
      openFreshFileInput(true);
    }
  }, [openNativeCamera, openFreshFileInput]);

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
    // On native we let @capacitor/camera own the permission prompt — it
    // surfaces a real iOS sheet that doesn't go stale after a Settings
    // round-trip. We still honor a confirmed denial first to keep the
    // existing "Camera is off" recovery modal.
    if (Capacitor.isNativePlatform()) {
      const synced = await refreshPermission();
      if (synced === "denied") {
        setExplainer({ open: true, mode: "denied" });
        return;
      }
      const seen = (() => { try { return localStorage.getItem(PHOTO_EXPLAINER_SEEN_KEY) === "1"; } catch { return false; } })();
      if (!seen) {
        setExplainer({ open: true, mode: "purpose" });
        return;
      }
      await openNativeCamera();
      return;
    }

    // WEB path — keep the getUserMedia probe as the gate.
    const synced = await refreshPermission();
    if (synced === "denied") {
      setExplainer({ open: true, mode: "denied" });
      return;
    }
    const seen = (() => { try { return localStorage.getItem(PHOTO_EXPLAINER_SEEN_KEY) === "1"; } catch { return false; } })();
    if (!seen && synced !== "granted") {
      setExplainer({ open: true, mode: "purpose" });
      return;
    }
    const probe = await requestPermission();
    if (probe === "granted") {
      openFreshFileInput(true);
      return;
    }
    if (probe === "denied") {
      setExplainer({ open: true, mode: "denied" });
      return;
    }
    openFreshFileInput(false);
  }, [refreshPermission, requestPermission, openFreshFileInput, openNativeCamera]);

  // Clean up any dangling transient input on unmount.
  useEffect(() => {
    return () => {
      if (activeInputRef.current?.parentNode) {
        activeInputRef.current.parentNode.removeChild(activeInputRef.current);
      }
      activeInputRef.current = null;
    };
  }, []);

  return (
    <div className="space-y-3">
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
          // Purpose explainer Continue — mark seen and launch via the
          // platform-appropriate camera path.
          try { localStorage.setItem(PHOTO_EXPLAINER_SEEN_KEY, "1"); } catch { /* ignore */ }
          await launchCamera();
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
                  <CameraIcon size={22} className="text-primary" />
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
