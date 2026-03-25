import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Send, Keyboard, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddEntry } from "@/hooks/useProgress";
import { toast } from "sonner";
import { openAppSettings } from "@/lib/openAppSettings";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";
import { useTranslation } from "react-i18next";
import { parseHealthTranscript } from "@/lib/parseHealthTranscript";

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
  const [textInput, setTextInput] = useState("");
  const [parsedResult, setParsedResult] = useState<ParsedVoiceResult | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const autoProcessPendingRef = useRef(false);
  const stopInProgressRef = useRef(false);
  const hasEnteredListeningRef = useRef(false);
  const addEntry = useAddEntry();
  const { t } = useTranslation();

  const openMicrophoneSettings = useCallback(async () => {
    const opened = await openAppSettings();
    if (!opened) {
      toast.error("Couldn't open Settings automatically. Go to Settings → Apps → Carnivore Coach → Permissions.", { duration: 6000 });
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

  useEffect(() => {
    if (transcript) {
      setTextInput(transcript);
    }
  }, [transcript]);

  const handleSubmit = useCallback(() => {
    const input = textInput.trim();
    if (!input) {
      toast.error("Please type or speak something first.");
      return;
    }
    const result = parseHealthTranscript(input);
    if (result.entries.length === 0) {
      toast.error(result.summary);
      return;
    }
    setParsedResult(result);
  }, [textInput]);

  const handleStartListening = useCallback(async () => {
    setParsedResult(null);
    setIsStopping(false);
    autoProcessPendingRef.current = false;
    hasEnteredListeningRef.current = false;
    resetTranscript();
    setExpanded(true);
    const started = await startListening();
    autoProcessPendingRef.current = Boolean(started);
  }, [resetTranscript, startListening]);

  const stopVoice = useCallback(async () => {
    if (stopInProgressRef.current) return;
    stopInProgressRef.current = true;
    setIsStopping(true);
    autoProcessPendingRef.current = false;
    const transcriptBeforeStop = getTranscript().trim();

    if (listening) {
      await stopListening();
    }
    await new Promise((resolve) => setTimeout(resolve, 250));

    const captured = (getTranscript().trim() || transcriptBeforeStop).trim();
    if (captured) {
      setTextInput(captured);
    }
    setIsStopping(false);
    stopInProgressRef.current = false;
  }, [getTranscript, listening, stopListening]);

  useEffect(() => {
    if (listening) {
      hasEnteredListeningRef.current = true;
    }
  }, [listening]);

  useEffect(() => {
    if (listening || !autoProcessPendingRef.current) return;
    if (!hasEnteredListeningRef.current) return;

    const timer = window.setTimeout(() => {
      if (!autoProcessPendingRef.current || !hasEnteredListeningRef.current) return;
      autoProcessPendingRef.current = false;
      const captured = getTranscript().trim();
      if (captured) {
        setTextInput(captured);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [listening, getTranscript]);

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
            notes: e.notes || textInput.slice(0, 80),
            recorded_at: now,
          })
        )
      );
      toast.success("All entries logged!");
      setParsedResult(null);
      setTextInput("");
      resetTranscript();
      setExpanded(false);
    } catch {
      toast.error("Failed to log entries");
    }
  }, [parsedResult, addEntry, textInput, resetTranscript]);

  const handleDismiss = useCallback(() => {
    setParsedResult(null);
    setTextInput("");
    resetTranscript();
    setExpanded(false);
  }, [resetTranscript]);

  // Idle card state
  if (!parsedResult && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-dashed border-primary/30 bg-card p-5 relative overflow-hidden text-left transition-colors hover:border-primary/50"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
        <div className="relative flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Keyboard size={22} className="text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {t("progress.typeOrSpeak", "Type or Speak")}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("progress.typeOrSpeakDesc", "Tap mic to voice log your meal")}
          </p>
        </div>
      </button>
    );
  }

  // Parsed result confirmation
  if (parsedResult) {
    return (
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
            {addEntry.isPending ? t("progress.logging") : t("progress.logAll")}
          </Button>
          <Button variant="outline" onClick={handleDismiss}>
            {t("progress.dismiss")}
          </Button>
        </div>
      </div>
    );
  }

  // Expanded input state
  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-card p-4 relative overflow-hidden space-y-3 min-h-[160px] flex flex-col justify-between">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent pointer-events-none" />
      <div className="relative flex gap-2">
        <Input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={t("progress.smartLogPlaceholder", "e.g. 300g ribeye, 2 eggs")}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          disabled={listening || isStopping}
          className="flex-1"
          autoFocus
        />
        <Button
          size="icon"
          variant="outline"
          onClick={listening ? () => void stopVoice() : () => void handleStartListening()}
          disabled={isStopping}
          className="shrink-0"
        >
          {isStopping ? (
            <Loader2 size={18} className="animate-spin" />
          ) : listening ? (
            <MicOff size={18} className="text-destructive animate-pulse" />
          ) : (
            <Mic size={18} className="text-primary" />
          )}
        </Button>
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!textInput.trim() || listening || isStopping}
          className="shrink-0"
        >
          <Send size={18} />
        </Button>
      </div>
      {listening && (
        <p className="relative text-[11px] text-muted-foreground text-center animate-pulse">
          {transcript || t("progress.listening")}
        </p>
      )}
      <button
        onClick={() => { if (!listening) setExpanded(false); }}
        className="relative flex items-center justify-center w-full gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronUp size={12} />
        {t("progress.smartLogHint", "Type or tap mic — parsed locally, no AI credits")}
      </button>
    </div>
  );
};

export default VoiceRecognition;
