import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAddEntry } from "@/hooks/useProgress";
import { toast } from "sonner";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const VoiceRecognition = () => {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedResult, setParsedResult] = useState<any>(null);
  const recognitionRef = useRef<any>(null);
  const addEntry = useAddEntry();

  const openMicrophoneSettings = useCallback(async () => {
    try {
      if (!Capacitor.isNativePlatform()) {
        throw new Error("not_native_platform");
      }
      await CapacitorApp.openSettings();
    } catch (error) {
      console.error("Failed to open app settings for microphone:", error);
      toast.error("Couldn’t open Settings automatically. Go to Settings → Apps → Carnivore Coach → Permissions.", { duration: 6000 });
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported on this device. Please try on a newer browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Microphone permission is blocked. Opening app settings…", { duration: 2500 });
        void openMicrophoneSettings();
      } else if (event.error !== "no-speech") {
        toast.error("Microphone error: " + event.error);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setTranscript("");
      setParsedResult(null);
    } catch {
      toast.error("Microphone permission is blocked. Opening app settings…", { duration: 2500 });
      void openMicrophoneSettings();
    }
  }, [openMicrophoneSettings]);

  const stopAndProcess = useCallback(async () => {
    recognitionRef.current?.stop();
    setListening(false);

    if (!transcript.trim()) {
      toast.error("No speech detected");
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-log", {
        body: { transcript: transcript.trim() },
      });

      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      setParsedResult(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to parse speech");
    } finally {
      setProcessing(false);
    }
  }, [transcript]);

  const logEntries = useCallback(async () => {
    if (!parsedResult?.entries?.length) return;
    const now = new Date().toISOString();
    try {
      await Promise.all(
        parsedResult.entries.map((e: any) =>
          addEntry.mutateAsync({
            category: e.category,
            metric: e.metric,
            value: e.value,
            unit: e.unit,
            notes: e.notes || `[voice] ${transcript.slice(0, 80)}`,
            recorded_at: now,
          })
        )
      );
      toast.success("All entries logged!");
      setParsedResult(null);
      setTranscript("");
    } catch {
      toast.error("Failed to log entries");
    }
  }, [parsedResult, addEntry, transcript]);

  return (
    <div className="space-y-3">
      {!parsedResult ? (
        <button
          onClick={listening ? stopAndProcess : startListening}
          disabled={processing}
          className="w-full relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-card p-5 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--gold))] opacity-[0.04]" />
          <div className="relative flex flex-col items-center gap-2">
            {processing ? (
              <>
                <Loader2 size={28} className="text-primary animate-spin" />
                <p className="text-sm font-medium text-foreground">Parsing speech…</p>
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
            {parsedResult.entries.map((e: any, i: number) => (
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
            <Button variant="outline" onClick={() => { setParsedResult(null); setTranscript(""); }}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecognition;
