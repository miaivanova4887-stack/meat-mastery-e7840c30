import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAddEntry } from "@/hooks/useProgress";
import { toast } from "sonner";
import { openAppSettings } from "@/lib/openAppSettings";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";

interface ParsedEntry {
  category: string;
  metric: string;
  value: number;
  unit: string;
  notes?: string;
}

interface ParsedVoiceResult {
  summary: string;
  entries: ParsedEntry[];
}

const VoiceRecognition = () => {
  const [processing, setProcessing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceResult | null>(null);
  const autoProcessPendingRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const addEntry = useAddEntry();

  const openMicrophoneSettings = useCallback(async () => {
    const opened = await openAppSettings();
    if (!opened) {
      toast.error("Couldn’t open Settings automatically. Go to Settings → Apps → Carnivore Coach → Permissions.", {
        duration: 6000,
      });
    }
  }, []);

  const {
    listening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    getTranscript,
  } = useVoiceCapture({
    onPermissionBlocked: () => {
      toast.error("Microphone permission is blocked. Opening app settings…", { duration: 2500 });
      void openMicrophoneSettings();
    },
    onError: (message) => toast.error(message),
  });

  const handleStartListening = useCallback(async () => {
    setParsedResult(null);
    setIsStopping(false);
    resetTranscript();
    const started = await startListening();
    autoProcessPendingRef.current = Boolean(started);
  }, [resetTranscript, startListening]);

  const stopAndProcess = useCallback(async () => {
    if (stopInProgressRef.current || processing) return;

    stopInProgressRef.current = true;
    setIsStopping(true);
    autoProcessPendingRef.current = false;
    const transcriptBeforeStop = getTranscript().trim();

    if (listening) {
      await stopListening();
    }

    await new Promise((resolve) => setTimeout(resolve, 250));

    const capturedTranscript = (getTranscript().trim() || transcriptBeforeStop).trim();

    if (!capturedTranscript) {
      toast.error("I couldn’t recognize speech. Please speak clearly and try again.");
      setIsStopping(false);
      stopInProgressRef.current = false;
      return;
    }

    setIsStopping(false);
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-log", {
        body: { transcript: capturedTranscript },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      setParsedResult(data as ParsedVoiceResult);
    } catch (e: any) {
      toast.error(e?.message || "Failed to parse speech");
    } finally {
      setProcessing(false);
      setIsStopping(false);
      stopInProgressRef.current = false;
    }
  }, [getTranscript, listening, processing, stopListening]);

  useEffect(() => {
    if (listening || !autoProcessPendingRef.current) return;

    const timer = window.setTimeout(() => {
      if (!autoProcessPendingRef.current) return;
      void stopAndProcess();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [listening, stopAndProcess]);

  const logEntries = useCallback(async () => {
    if (!parsedResult?.entries?.length) return;
    const now = new Date().toISOString();
    try {
      await Promise.all(
        parsedResult.entries.map((e) =>
          addEntry.mutateAsync({
            category: e.category,
            metric: e.metric,
            value: e.value,
            unit: e.unit,
            notes: e.notes || `[voice] ${getTranscript().slice(0, 80)}`,
            recorded_at: now,
          })
        )
      );
      toast.success("All entries logged!");
      setParsedResult(null);
      resetTranscript();
    } catch {
      toast.error("Failed to log entries");
    }
  }, [parsedResult, addEntry, getTranscript, resetTranscript]);

  return (
    <div className="space-y-3">
      {!parsedResult ? (
        <button
          onClick={listening ? () => void stopAndProcess() : () => void handleStartListening()}
          disabled={processing || isStopping}
          className="w-full relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card p-5 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.04]" />
          <div className="relative flex flex-col items-center gap-2">
            {processing || isStopping ? (
              <>
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">
                  {isStopping && !processing ? "Stopping microphone…" : "Parsing speech…"}
                </p>
              </>
            ) : listening ? (
              <>
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                  <MicOff size={22} className="text-destructive" />
                </div>
                <p className="text-sm font-semibold text-foreground">Tap to stop & process</p>
                <p className="text-[11px] text-muted-foreground max-w-[240px] text-center truncate">
                  {transcript || "Listening…"}
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic size={22} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Voice Log</p>
                <p className="text-[11px] text-muted-foreground">
                  Speak to log meals, stats, vitals & more
                </p>
              </>
            )}
          </div>
        </button>
      ) : (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">{parsedResult.summary}</p>
          <div className="space-y-1.5">
            {parsedResult.entries.map((e, i) => (
              <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground capitalize">
                  {e.metric.replace(/_/g, " ")}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {e.value} {e.unit}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={logEntries} className="flex-1" disabled={addEntry.isPending}>
              {addEntry.isPending ? "Logging…" : "✓ Log All"}
            </Button>
            <Button variant="outline" onClick={() => { setParsedResult(null); resetTranscript(); }}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecognition;
