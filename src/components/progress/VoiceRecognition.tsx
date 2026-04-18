import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Send, Keyboard, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
    receivedInput,
  } = useVoiceCapture({
    onPermissionBlocked: () => {
      toast.error("Microphone permission is blocked. Opening app settings…", { duration: 2500 });
      void openMicrophoneSettings();
    },
    onError: (message) => toast.error(message),
  });

  // Keep the textarea synced to the live voice transcript while listening.
  // We only copy non-empty transcripts into the textarea so that manually
  // typed text isn't clobbered when a voice session starts (transcript is
  // "" until the first partial result arrives). Leftover text from a
  // previous run is cleared explicitly by handleStartListening /
  // handleExpandFromIdle / handleDismiss / logEntries instead.
  useEffect(() => {
    if (transcript) {
      setTextInput(transcript);
    }
  }, [transcript]);

  /**
   * Parse the current text (or an override, when we want to auto-submit a
   * freshly-captured voice transcript before React has flushed setTextInput).
   * Returns true on success so callers can branch (e.g. auto-submit only
   * wants to run on the happy path).
   */
  const submitText = useCallback((override?: string) => {
    const input = (override ?? textInput).trim();
    if (!input) {
      toast.error("Please type or speak something first.");
      return false;
    }
    const result = parseHealthTranscript(input);
    if (result.entries.length === 0) {
      toast.error(result.summary);
      return false;
    }
    setParsedResult(result);
    return true;
  }, [textInput]);

  const handleSubmit = useCallback(() => {
    submitText();
  }, [submitText]);

  const handleStartListening = useCallback(async () => {
    setParsedResult(null);
    setIsStopping(false);
    autoProcessPendingRef.current = false;
    hasEnteredListeningRef.current = false;
    resetTranscript();
    // Clear any leftover text from a previous meal so the new transcript
    // lands on a blank slate. Without this, logging meal #1 then tapping mic
    // again would show meal #1's transcript until the first voice token
    // arrives — confusing and easy to submit by accident.
    setTextInput("");
    setExpanded(true);
    const started = await startListening();
    autoProcessPendingRef.current = Boolean(started);
  }, [resetTranscript, startListening]);

  const stopVoice = useCallback(async () => {
    if (stopInProgressRef.current) return;
    stopInProgressRef.current = true;
    setIsStopping(true);
    // Consume the auto-process flag here: the user explicitly tapped stop,
    // so we're going to auto-submit directly and don't want the natural-stop
    // effect (below) firing a second time.
    const shouldAutoSubmit = autoProcessPendingRef.current;
    autoProcessPendingRef.current = false;
    const transcriptBeforeStop = getTranscript().trim();

    if (listening) {
      await stopListening();
    }
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Gate auto-submit on "did this session actually hear anything". On
    // iOS the audio session can get stuck after a previous recognition
    // run; the native layer then resolves the start promise immediately
    // with no partials ever firing, but `getTranscript()` may still hold
    // the previous run's text. Without this gate we'd auto-resubmit that
    // stale text and show the user their previous meal's macros again.
    const heardSomething = receivedInput();
    const captured = heardSomething
      ? (getTranscript().trim() || transcriptBeforeStop).trim()
      : "";
    if (captured) {
      setTextInput(captured);
    }
    setIsStopping(false);
    stopInProgressRef.current = false;
    if (shouldAutoSubmit && captured) {
      submitText(captured);
    } else if (shouldAutoSubmit && !heardSomething) {
      // Surface the "silent session" case so the user knows to try again
      // rather than staring at an unchanged UI and wondering what happened.
      toast.error("Didn't catch that — please try again.");
    }
  }, [getTranscript, listening, receivedInput, stopListening, submitText]);

  useEffect(() => {
    if (listening) {
      hasEnteredListeningRef.current = true;
    }
  }, [listening]);

  useEffect(() => {
    if (listening || !autoProcessPendingRef.current) return;
    if (!hasEnteredListeningRef.current) return;

    // Natural stop: the recognizer finished on its own (silence timeout or
    // isFinal event) while the auto-process flag is still set. Give React a
    // short grace period for the final transcript to flush, then submit.
    const timer = window.setTimeout(() => {
      if (!autoProcessPendingRef.current || !hasEnteredListeningRef.current) return;
      autoProcessPendingRef.current = false;
      // Same "silent session" guard as stopVoice: don't auto-submit stale
      // text from a previous recognition run if the current session never
      // actually heard anything.
      if (!receivedInput()) return;
      const captured = getTranscript().trim();
      if (captured) {
        setTextInput(captured);
        submitText(captured);
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [listening, getTranscript, receivedInput, submitText]);

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

  /**
   * Expand the input card from the idle state. We reset all transient state
   * here (textInput, transcript, parsedResult) so a fresh tap on the idle
   * card always starts from a clean slate, even if the previous run left
   * something dangling. Without this, users reported leftover text from the
   * previous meal showing up in the textarea on their 2nd voice log.
   */
  const handleExpandFromIdle = useCallback(() => {
    setParsedResult(null);
    setTextInput("");
    resetTranscript();
    setExpanded(true);
  }, [resetTranscript]);

  // Idle card state
  if (!parsedResult && !expanded) {
    return (
      <button
        onClick={handleExpandFromIdle}
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
    // Group entries by their `notes` field so each identified meal/item gets
    // its own labeled block (e.g. "300g sirloin steak" with cal/protein/fat),
    // instead of a flat list of repeating "Calories / Protein / Fat" rows that
    // leaves the user guessing which macros belong to which item.
    const groups: { label: string; rows: ParsedEntry[] }[] = [];
    for (const e of parsedResult.entries) {
      const label = e.notes || t("progress.otherEntry", "Other");
      const existing = groups.find((g) => g.label === label);
      if (existing) existing.rows.push(e);
      else groups.push({ label, rows: [e] });
    }

    return (
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        {/* The parser's summary (e.g. "Parsed 3 entries from your input")
            reads like developer output, not something a user wants to see on
            every meal log. We only surface it when nothing was recognized,
            because then it carries the helpful hint about phrasing. */}
        {parsedResult.entries.length === 0 && (
          <p className="text-sm font-medium text-muted-foreground">{parsedResult.summary}</p>
        )}
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div key={gi} className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground px-1">
                {g.label}
              </p>
              <div className="space-y-1">
                {g.rows.map((e, i) => (
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
      <div className="relative flex gap-2 items-start">
        {/* Multi-line textarea so long transcripts stay fully visible without
            horizontal scroll. `rows={2}` keeps the idle height compact; the
            textarea grows organically as the content wraps. Enter submits,
            shift+Enter inserts a newline (standard behavior). */}
        <Textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={t("progress.smartLogPlaceholder", "e.g. 300g ribeye, 2 eggs")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={listening || isStopping}
          rows={2}
          className="flex-1 min-h-[44px] resize-none text-sm"
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
        {t("progress.smartLogHint", "Type or tap mic to log your meal")}
      </button>
    </div>
  );
};

export default VoiceRecognition;
