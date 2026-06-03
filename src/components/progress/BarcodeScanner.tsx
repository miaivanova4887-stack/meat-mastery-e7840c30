import { useState, useRef, useCallback, useEffect } from "react";
import { ScanBarcode, Loader2, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAddEntry } from "@/hooks/useProgress";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { openAppSettings } from "@/lib/openAppSettings";
import { useTranslation } from "react-i18next";
import CameraPermissionExplainer, { type CameraExplainerMode } from "@/components/CameraPermissionExplainer";
import { useCameraPermission } from "@/hooks/useCameraPermission";

interface ProductResult {
  name: string;
  brand: string;
  cal: number;
  protein: number;
  fat: number;
  carbs: number;
  serving: string;
  imageUrl?: string;
}

const isPermissionDeniedMessage = (value: unknown) => {
  const msg = String(value || "").toLowerCase();
  return (
    msg.includes("permission") ||
    msg.includes("denied") ||
    msg.includes("notallowederror") ||
    msg.includes("not allowed") ||
    msg.includes("service-not-allowed")
  );
};

const BarcodeScanner = () => {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [explainer, setExplainer] = useState<{ open: boolean; mode: CameraExplainerMode }>({
    open: false,
    mode: "purpose",
  });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addEntry = useAddEntry();
  const { refreshPermission, markGranted, markDenied } = useCameraPermission();

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch { /* ignore */ }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const lookupBarcode = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        toast.error("Product not found. Try a different barcode.");
        return;
      }
      const p = data.product;
      const n = p.nutriments || {};
      const servingSize = p.serving_size || p.quantity || "100g";
      setResult({
        name: p.product_name || p.product_name_en || "Unknown Product",
        brand: p.brands || "",
        cal: Math.round(n["energy-kcal_serving"] || n["energy-kcal_100g"] || 0),
        protein: Math.round(n.proteins_serving || n.proteins_100g || 0),
        fat: Math.round(n.fat_serving || n.fat_100g || 0),
        carbs: Math.round(n.carbohydrates_serving || n.carbohydrates_100g || 0),
        serving: servingSize,
        imageUrl: p.image_front_small_url,
      });
    } catch {
      toast.error("Failed to look up product");
    } finally {
      setLoading(false);
    }
  }, []);

  const beginScanning = useCallback(async () => {
    setScanning(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        async (decodedText) => { await stopScanner(); lookupBarcode(decodedText); },
        () => { /* per-frame decode errors are noise */ }
      );
      try { localStorage.removeItem(CAMERA_DENIED_KEY); } catch { /* ignore */ }
    } catch (err: any) {
      // First-time denial path — do NOT redirect to Settings. Just close,
      // remember the denial for next time, and stay quiet.
      if (isPermissionDeniedMessage(err?.message || err)) {
        try { localStorage.setItem(CAMERA_DENIED_KEY, "1"); } catch { /* ignore */ }
        toast("You can turn on the camera anytime in Settings.");
      } else {
        toast.error("Camera not available on this device.");
      }
      setScanning(false);
    }
  }, [stopScanner, lookupBarcode]);

  const handleStartTap = useCallback(async () => {
    // If we already know the OS-level permission is denied (either from
    // a previous denial this install, or from the Permissions API), show
    // the neutral re-entry modal instead of triggering another prompt.
    const denied = (() => {
      try { return localStorage.getItem(CAMERA_DENIED_KEY) === "1"; } catch { return false; }
    })();
    const permState = await queryCameraPermission();
    if (denied || permState === "denied") {
      setExplainer({ open: true, mode: "denied" });
      return;
    }
    // First time: show the purpose explainer before triggering iOS prompt.
    setExplainer({ open: true, mode: "purpose" });
  }, []);

  const handleExplainerContinue = useCallback(async () => {
    const mode = explainer.mode;
    setExplainer({ open: false, mode });
    if (mode === "denied") {
      // User explicitly tapped "Open Settings" in the neutral re-entry
      // modal. This is the ONLY place we may navigate to Settings.
      await openAppSettings();
      return;
    }
    await beginScanning();
  }, [explainer.mode, beginScanning]);

  const handleExplainerClose = useCallback(() => {
    setExplainer((prev) => ({ ...prev, open: false }));
  }, []);

  const startScanner = handleStartTap;

  const logToProgress = useCallback(() => {
    if (!result) return;
    const now = new Date().toISOString();
    const note = `[barcode] ${result.name}${result.brand ? ` (${result.brand})` : ""} (${quantity}x)`;
    const entries = [
      { category: "diet_trends" as const, metric: "calories", value: result.cal * quantity, unit: "kcal", notes: note, recorded_at: now },
      { category: "diet_trends" as const, metric: "protein", value: result.protein * quantity, unit: "g", notes: note, recorded_at: now },
      { category: "diet_trends" as const, metric: "fat", value: result.fat * quantity, unit: "g", notes: note, recorded_at: now },
    ];
    Promise.all(entries.map((e) => addEntry.mutateAsync(e)))
      .then(() => { toast.success(`${result.name} logged to progress`); setResult(null); setQuantity(1); })
      .catch(() => toast.error("Failed to log nutrients"));
  }, [result, addEntry, quantity]);

  return (
    <div className="space-y-3">
      <CameraPermissionExplainer
        open={explainer.open}
        mode={explainer.mode}
        onClose={handleExplainerClose}
        onContinue={handleExplainerContinue}
      />
      {!result && !scanning ? (
        <button
          onClick={startScanner}
          disabled={loading}
          className="w-full relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card p-5 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] opacity-[0.04]" />
          <div className="relative flex flex-col items-center gap-2">
            {loading ? (
              <>
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">{t("progress.lookingUpProduct")}</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ScanBarcode size={22} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("progress.scanBarcode")}</p>
                <p className="text-[11px] text-muted-foreground">{t("progress.scanBarcodeDesc")}</p>
              </>
            )}
          </div>
        </button>
      ) : scanning ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">{t("progress.pointAtBarcode")}</p>
            <button onClick={stopScanner} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
          <div ref={containerRef} className="relative">
            <div id="barcode-reader" className="w-full" />
          </div>
          {loading && (
            <div className="p-3 flex items-center gap-2 justify-center">
              <Loader2 size={16} className="text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">{t("progress.lookingUpProduct")}</span>
            </div>
          )}
        </div>
      ) : result ? (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-start gap-3">
            {result.imageUrl && (
              <img src={result.imageUrl} alt={result.name} className="w-14 h-14 rounded-lg object-cover bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{result.name}</p>
              {result.brand && <p className="text-[11px] text-muted-foreground">{result.brand}</p>}
              <p className="text-[11px] text-muted-foreground">{t("progress.serving")}: {result.serving}</p>
            </div>
          </div>

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

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.cal * quantity)}</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.calories")}</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.protein * quantity)}g</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.protein")}</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.fat * quantity)}g</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.fat")}</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.carbs * quantity)}g</p>
              <p className="text-[10px] text-muted-foreground">{t("progress.carbs")}</p>
            </div>
          </div>

          {result.carbs * quantity > 5 && (
            <p className="text-[11px] text-destructive font-medium">{t("progress.highCarbsWarning")}</p>
          )}

          <div className="flex gap-2">
            <Button onClick={logToProgress} className="flex-1" disabled={addEntry.isPending}>
              {addEntry.isPending ? t("progress.logging") : t("progress.logToProgress")}
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setQuantity(1); }}>{t("progress.dismiss")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BarcodeScanner;
