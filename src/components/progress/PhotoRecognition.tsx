import { useState, useRef, useCallback } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAddEntry } from "@/hooks/useProgress";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { toast } from "sonner";

const PhotoRecognition = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addEntry = useAddEntry();
  const profile = useUserProfile();

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
    const note = `[meal-sync] ${result.recipeName}`;

    const entries = [
      { category: "diet_trends", metric: "calories", value: parseFloat(result.cal) || 0, unit: "kcal", notes: note, recorded_at: now },
      { category: "diet_trends", metric: "protein", value: parseFloat(result.protein) || 0, unit: "g", notes: note, recorded_at: now },
      { category: "diet_trends", metric: "fat", value: parseFloat(result.fat) || 0, unit: "g", notes: note, recorded_at: now },
    ];

    Promise.all(entries.map((e) => addEntry.mutateAsync(e)))
      .then(() => {
        toast.success(`${result.recipeName} logged to progress`);
        setResult(null);
      })
      .catch(() => toast.error("Failed to log nutrients"));
  }, [result, addEntry]);

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

      {!result ? (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="w-full relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card p-5 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.04]" />
          <div className="relative flex flex-col items-center gap-2">
            {loading ? (
              <>
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">Analyzing food…</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera size={22} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Snap & Log</p>
                <p className="text-[11px] text-muted-foreground">Take a photo to auto-detect nutrients</p>
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
                Confidence: <span className={result.confidence === "high" ? "text-green-500" : result.confidence === "medium" ? "text-yellow-500" : "text-red-400"}>{result.confidence}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{result.cal}</p>
              <p className="text-[10px] text-muted-foreground">Calories</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{result.protein}</p>
              <p className="text-[10px] text-muted-foreground">Protein</p>
            </div>
            <div className="bg-muted rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{result.fat}</p>
              <p className="text-[10px] text-muted-foreground">Fat</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={logToProgress} className="flex-1" disabled={addEntry.isPending}>
              {addEntry.isPending ? "Logging…" : "✓ Log to Progress"}
            </Button>
            <Button variant="outline" onClick={() => setResult(null)}>Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoRecognition;
