import { useState, useRef, useCallback, useEffect } from "react";
import { ScanBarcode, Loader2, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAddEntry } from "@/hooks/useProgress";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { App as CapacitorApp } from "@capacitor/app";

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

const BarcodeScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addEntry = useAddEntry();

  const openCameraSettings = useCallback(async () => {
    try {
      const openSettings = (CapacitorApp as any)?.openSettings;
      if (typeof openSettings !== "function") {
        throw new Error("openSettings_not_supported");
      }
      await openSettings.call(CapacitorApp);
    } catch (error) {
      console.error("Failed to open app settings for camera:", error);
      toast.error("Please enable camera in Settings → Apps → Carnivore Coach → Permissions.", { duration: 6000 });
    }
  }, []);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {
      // ignore
    }
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

  const startScanner = useCallback(async () => {
    setScanning(true);
    setResult(null);

    // Small delay so the DOM element is rendered
    await new Promise((r) => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode("barcode-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 120 } },
        async (decodedText) => {
          await stopScanner();
          lookupBarcode(decodedText);
        },
        () => {} // ignore scan failures
      );
    } catch (err: any) {
      const msg = String(err?.message || err || "").toLowerCase();
      if (msg.includes("permission") || msg.includes("denied") || msg.includes("not allowed")) {
        toast.error("Camera permission is blocked. Opening app settings…", { duration: 3500 });
        void openCameraSettings();
      } else {
        toast.error("Camera not available. Please check your device settings.");
      }
      setScanning(false);
    }
  }, [stopScanner, lookupBarcode, openCameraSettings]);

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
      .then(() => {
        toast.success(`${result.name} logged to progress`);
        setResult(null);
        setQuantity(1);
      })
      .catch(() => toast.error("Failed to log nutrients"));
  }, [result, addEntry, quantity]);

  return (
    <div className="space-y-3">
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
                <p className="text-sm font-medium text-foreground">Looking up product…</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ScanBarcode size={22} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Scan Barcode</p>
                <p className="text-[11px] text-muted-foreground">Scan a product barcode to log nutrients</p>
              </>
            )}
          </div>
        </button>
      ) : scanning ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Point at barcode</p>
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
              <span className="text-sm text-muted-foreground">Looking up product…</span>
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
              {result.brand && (
                <p className="text-[11px] text-muted-foreground">{result.brand}</p>
              )}
              <p className="text-[11px] text-muted-foreground">Serving: {result.serving}</p>
            </div>
          </div>

          {/* Quantity Adjuster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Quantity</p>
              <p className="text-sm font-bold text-foreground">{quantity}x</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(Math.max(0.25, quantity - 0.25))}
              >
                <Minus size={14} />
              </Button>
              <Slider
                value={[quantity]}
                onValueChange={([v]) => setQuantity(v)}
                min={0.25}
                max={4}
                step={0.25}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setQuantity(Math.min(4, quantity + 0.25))}
              >
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.cal * quantity)}</p>
              <p className="text-[10px] text-muted-foreground">Cal</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.protein * quantity)}g</p>
              <p className="text-[10px] text-muted-foreground">Protein</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.fat * quantity)}g</p>
              <p className="text-[10px] text-muted-foreground">Fat</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{Math.round(result.carbs * quantity)}g</p>
              <p className="text-[10px] text-muted-foreground">Carbs</p>
            </div>
          </div>

          {result.carbs * quantity > 5 && (
            <p className="text-[11px] text-destructive font-medium">
              ⚠️ High carbs — may not be carnivore-friendly
            </p>
          )}

          <div className="flex gap-2">
            <Button onClick={logToProgress} className="flex-1" disabled={addEntry.isPending}>
              {addEntry.isPending ? "Logging…" : "✓ Log to Progress"}
            </Button>
            <Button variant="outline" onClick={() => { setResult(null); setQuantity(1); }}>Dismiss</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BarcodeScanner;
