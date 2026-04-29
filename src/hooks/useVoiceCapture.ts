import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

// In-app Swift plugin (see ios/App/App/AudioSessionPlugin.swift). Exposes
// `resetAudioSession()` which deactivates + reactivates AVAudioSession so
// SFSpeechRecognizer starts fresh on each voice session. Without this, the
// 2nd consecutive voice session on iOS opens the mic but emits no partial
// results and eventually rejects with "no-speech".
interface AudioSessionPluginShape {
  resetAudioSession: (options?: { delayMs?: number }) => Promise<{ ok: boolean }>;
  deactivate: () => Promise<{ ok: boolean }>;
}
const AudioSession = registerPlugin<AudioSessionPluginShape>("AudioSession");

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type ListenerHandle = {
  remove: () => Promise<void>;
};

interface UseVoiceCaptureOptions {
  language?: string;
  onPermissionBlocked?: () => void;
  onError?: (message: string) => void;
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> => {
  return await Promise.race([
    promise,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs)),
  ]);
};

const isNoSpeechError = (value: unknown) => {
  const msg = String(value || "").toLowerCase();
  return msg.includes("no match") || msg.includes("no-speech") || msg.includes("speech timeout");
};

const messageIncludesPermissionBlock = (value: unknown) => {
  const msg = String(value || "").toLowerCase();
  return (
    msg.includes("not-allowed") ||
    msg.includes("service-not-allowed") ||
    msg.includes("notallowederror") ||
    msg.includes("permission") ||
    msg.includes("denied") ||
    msg.includes("audio-capture")
  );
};

const permissionGranted = (value: any) => {
  if (value === true) return true;
  if (value?.permission === true) return true;
  if (value?.speechRecognition === "granted") return true;
  return false;
};

const extractFirstMatch = (payload: any): string => {
  const candidates = Array.isArray(payload?.matches)
    ? payload.matches
    : Array.isArray(payload?.value)
      ? payload.value
      : Array.isArray(payload)
        ? payload
        : [];

  const first = candidates.find((item: unknown) => typeof item === "string" && item.trim().length > 0);
  return typeof first === "string" ? first.trim() : "";
};

export const useVoiceCapture = ({
  language = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US",
  onPermissionBlocked,
  onError,
}: UseVoiceCaptureOptions = {}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const webRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const nativeListenersRef = useRef<ListenerHandle[]>([]);
  const nativeStartPromiseRef = useRef<Promise<any> | null>(null);
  const nativeStoppedWaitRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  const transcriptRef = useRef("");
  const isStoppingRef = useRef(false);
  const sessionIdRef = useRef(0);
  const lastStopAtRef = useRef(0);
  // Flipped to true the first time the active session emits a partial or
  // final result containing actual text. Lets callers distinguish between
  // "session ended without ever hearing anything" (iOS audio-session stuck
  // state) and "session ended with real input". Reset at the start of each
  // new session.
  const receivedInputRef = useRef(false);
  // The last transcript text we accepted from the PREVIOUS session. On iOS,
  // if a new session starts while the previous SFSpeechRecognizer is still
  // finishing, the native layer replays the previous session's final
  // partials onto the new session's listener. We use this to filter those
  // stale echoes out by dropping any leading partial whose text exactly
  // matches what the previous session ended on.
  const previousFinalTextRef = useRef("");
  // Tracks whether we've already accepted a "real" partial in the CURRENT
  // session. Once we have, we stop filtering — any text after that is
  // definitely from the new session.
  const currentSessionAcceptedPartialRef = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  const cleanupNativeListeners = useCallback(async () => {
    const handles = nativeListenersRef.current;
    nativeListenersRef.current = [];
    await Promise.allSettled(handles.map((h) => h.remove()));
  }, []);

  const setTranscriptSafe = useCallback((value: string) => {
    transcriptRef.current = value;
    setTranscript(value);
  }, []);

  const getTranscript = useCallback(() => transcriptRef.current, []);

  /**
   * Returns true iff the most recent voice session actually produced any
   * speech input (partial or final). Callers should consult this before
   * auto-submitting the transcript so that a stuck audio session doesn't
   * silently re-submit stale text from a previous run.
   */
  const receivedInput = useCallback(() => receivedInputRef.current, []);

  const stopListening = useCallback(async () => {
    setListening(false);

    if (isNative) {
      if (isStoppingRef.current) return;

      isStoppingRef.current = true;
      sessionIdRef.current += 1;

      try {
        await withTimeout(SpeechRecognition.stop(), 1200);
      } catch {
        // ignore native stop errors
      }

      const nativeStoppedWait = nativeStoppedWaitRef.current?.promise;
      if (nativeStoppedWait) {
        await withTimeout(nativeStoppedWait, 1200);
      }

      const pendingStart = nativeStartPromiseRef.current;
      if (pendingStart) {
        await withTimeout(pendingStart.catch(() => undefined), 1800);
      }

      await cleanupNativeListeners();
      nativeStoppedWaitRef.current?.resolve();
      nativeStoppedWaitRef.current = null;
      nativeStartPromiseRef.current = null;
      isStoppingRef.current = false;
      lastStopAtRef.current = Date.now();
    } else {
      webRecognitionRef.current?.stop();
      lastStopAtRef.current = Date.now();
    }
  }, [cleanupNativeListeners, isNative]);

  const startNativeListening = useCallback(async () => {
    if (isStoppingRef.current || nativeStartPromiseRef.current) {
      onError?.("Voice recognition is still finishing. Please try again.");
      return false;
    }

    // Baseline cooldown so any lingering native callbacks from the previous
    // session finish. This is cheap even on the 1st run (elapsedSinceStop
    // will be very large the first time).
    const cooldownMs = isNative ? 400 : 250;
    const elapsedSinceStop = Date.now() - lastStopAtRef.current;
    if (elapsedSinceStop < cooldownMs) {
      await new Promise((resolve) => setTimeout(resolve, cooldownMs - elapsedSinceStop));
    }

    // On iOS, explicitly reset the shared AVAudioSession before every new
    // voice session. This is the key fix for "1st run OK, 2nd run fails":
    // the community speech plugin doesn't release the audio session between
    // sessions, leaving SFSpeechRecognizer in a stuck state. Our custom
    // Swift plugin deactivates + reactivates it, forcing a clean slate.
    // Non-fatal on failure — we still try to start.
    //
    // Bumped from 250ms to 500ms after device logs showed run 2 kicking
    // off while run 1's recognizer was still emitting cached partials
    // ("50 g of butter" replay on the 2nd start). Giving CoreAudio more
    // time to fully release + reinstate before we register new listeners
    // reduces the overlap window significantly.
    if (Capacitor.getPlatform() === "ios") {
      try {
        await AudioSession.resetAudioSession({ delayMs: 500 });
      } catch (err) {
        // Log but don't block start — old builds without the plugin should
        // still work on the 1st session.
        // eslint-disable-next-line no-console
        console.warn("AudioSession.resetAudioSession failed", err);
      }
    }

    // On iOS the native plugin only fires a final `call.resolve()` when the
    // recognizer decides it's done (`isFinal=true`, after a long pause).
    // Without partial results the UI stays on "listening" forever. Enabling
    // partial results makes the recognizer emit a stream of `partialResults`
    // events AND resolve the start promise immediately.
    //
    // Android: popup=true uses the system Google Voice UI which already
    // returns a final transcript when the overlay dismisses, so it keeps the
    // original behaviour.
    const platform = Capacitor.getPlatform();
    const usePopup = platform === "android";
    const usePartialResults = platform === "ios";

    const available = await SpeechRecognition.available();
    if (!available?.available) {
      onError?.("Voice recognition is not available on this device.");
      return false;
    }

    const permission = await SpeechRecognition.checkPermissions();
    if (!permissionGranted(permission)) {
      const requested = await SpeechRecognition.requestPermissions();
      if (!permissionGranted(requested)) {
        onPermissionBlocked?.();
        return false;
      }
    }

    await cleanupNativeListeners();
    nativeStoppedWaitRef.current?.resolve();
    nativeStoppedWaitRef.current = null;
    // Remember what the previous session ended on BEFORE we clear the
    // transcript, so the stale-echo filter in the partialResults listener
    // has something to compare against. Empty string means "no previous
    // session to echo from" — filter will be a no-op.
    previousFinalTextRef.current = transcriptRef.current.trim();
    setTranscriptSafe("");
    // Fresh session — reset the "has input?" flag. receivedInputRef is
    // what lets the caller distinguish "user spoke, session ran cleanly"
    // from "audio session was stuck so nothing was captured". See the
    // comment on receivedInputRef for the iOS-specific failure mode.
    receivedInputRef.current = false;
    currentSessionAcceptedPartialRef.current = false;

    const sessionId = ++sessionIdRef.current;

    let resolveStopped = () => {};
    const stoppedPromise = new Promise<void>((resolve) => {
      resolveStopped = resolve;
    });
    nativeStoppedWaitRef.current = { promise: stoppedPromise, resolve: resolveStopped };

    const listeningStateHandle = await SpeechRecognition.addListener("listeningState", ({ status }: any) => {
      if (sessionId !== sessionIdRef.current) return;

      if (status === "started") {
        setListening(true);
      }

      if (status === "stopped") {
        nativeStoppedWaitRef.current?.resolve();
        setListening(false);
      }
    });

    const listenerHandles: ListenerHandle[] = [listeningStateHandle];

    if (usePartialResults) {
      const partialResultsHandle = await SpeechRecognition.addListener("partialResults", (payload: any) => {
        if (sessionId !== sessionIdRef.current) return;
        const partialMatch = extractFirstMatch(payload);
        if (!partialMatch) return;

        // Stale-echo filter: if this is the first partial of a new session
        // AND it matches the text the previous session ended on exactly,
        // it's almost certainly iOS replaying a cached final from the
        // stuck previous recognizer. Drop it. Once we've accepted even
        // one partial, we stop filtering — real speech is flowing.
        if (
          !currentSessionAcceptedPartialRef.current &&
          previousFinalTextRef.current &&
          partialMatch.trim() === previousFinalTextRef.current
        ) {
          return;
        }

        currentSessionAcceptedPartialRef.current = true;
        // Mark the session as "heard something" before writing the
        // transcript, so downstream consumers (stopVoice, natural-stop)
        // know the session is genuine and not a stuck-audio-session
        // replay of cached text.
        receivedInputRef.current = true;
        console.info("[VoiceLog] native partial accepted len=", partialMatch.length);
        setTranscriptSafe(partialMatch);
      });
      listenerHandles.push(partialResultsHandle);
    }

    nativeListenersRef.current = listenerHandles;

    setListening(true);

    try {
      const createStartPromise = (languageOverride?: string) =>
        SpeechRecognition.start({
          ...(languageOverride ? { language: languageOverride } : {}),
          maxResults: 5,
          partialResults: usePartialResults,
          popup: usePopup,
          prompt: "Speak now",
        });

      const startPromise = (async () => {
        try {
          return await createStartPromise(language);
        } catch (error) {
          const message = String(error || "").toLowerCase();
          if (message.includes("language")) {
            return await createStartPromise();
          }
          throw error;
        }
      })();

      nativeStartPromiseRef.current = startPromise;

      void startPromise
        .then((result: any) => {
          if (sessionId !== sessionIdRef.current) return;
          const finalMatch = extractFirstMatch(result);
          if (finalMatch) {
            console.info(
              "[VoiceLog] native final received len=",
              finalMatch.length,
              "usePartialResults=",
              usePartialResults,
            );
            // Android (popup=true) uses Google's system voice UI which
            // emits NO partialResults events — the only signal we ever
            // get is this final match. We must trust it; otherwise the
            // transcript is silently dropped and no meal gets logged.
            //
            // iOS keeps the original guard: only trust the final if a
            // real partial already arrived, otherwise it may be a cached
            // replay from a stuck audio session.
            if (!usePartialResults) {
              receivedInputRef.current = true;
              setTranscriptSafe(finalMatch);
            } else if (receivedInputRef.current) {
              setTranscriptSafe(finalMatch);
            }
          }
        })
        .catch((error: any) => {
          if (sessionId !== sessionIdRef.current) return;
          if (messageIncludesPermissionBlock(error)) {
            onPermissionBlocked?.();
          } else if (isNoSpeechError(error)) {
            onError?.("I couldn’t recognize speech. Please speak clearly and try again.");
          } else {
            onError?.("Microphone couldn't detect speech. Please try again.");
          }
        })
        .finally(() => {
          if (sessionId !== sessionIdRef.current) return;
          nativeStartPromiseRef.current = null;
          nativeStoppedWaitRef.current?.resolve();
          setListening(false);
        });
    } catch (error) {
      if (messageIncludesPermissionBlock(error)) {
        onPermissionBlocked?.();
      } else if (isNoSpeechError(error)) {
        onError?.("I couldn’t recognize speech. Please speak clearly and try again.");
      } else {
        onError?.("Microphone failed to start. Please try again.");
      }
      setListening(false);
      await cleanupNativeListeners();
      return false;
    }

    return true;
  }, [
    cleanupNativeListeners,
    language,
    lastStopAtRef,
    onError,
    onPermissionBlocked,
    setTranscriptSafe,
  ]);

  const startWebListening = useCallback(async () => {
    const SpeechRecognitionApi =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      onError?.("Speech recognition is not supported on this device.");
      return false;
    }

    const recognition: SpeechRecognitionLike = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      const combined = Array.from(event.results)
        .map((result: any) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();
      if (combined) {
        receivedInputRef.current = true;
      }
      setTranscriptSafe(combined);
    };

    recognition.onerror = (event: any) => {
      if (messageIncludesPermissionBlock(event?.error)) {
        onPermissionBlocked?.();
      } else if (event?.error !== "no-speech") {
        onError?.(`Microphone error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    webRecognitionRef.current = recognition;
    setTranscriptSafe("");
    receivedInputRef.current = false;

    try {
      recognition.start();
      setListening(true);
      return true;
    } catch (error) {
      if (messageIncludesPermissionBlock(error)) {
        onPermissionBlocked?.();
      } else {
        onError?.("Microphone failed to start. Please try again.");
      }
      setListening(false);
      return false;
    }
  }, [language, onError, onPermissionBlocked, setTranscriptSafe]);

  const startListening = useCallback(async () => {
    if (listening) return true;

    try {
      return isNative ? await startNativeListening() : await startWebListening();
    } catch (error) {
      if (messageIncludesPermissionBlock(error)) {
        onPermissionBlocked?.();
      } else {
        onError?.("Unable to start voice recognition.");
      }
      return false;
    }
  }, [isNative, listening, onError, onPermissionBlocked, startNativeListening, startWebListening]);

  const resetTranscript = useCallback(() => {
    setTranscriptSafe("");
  }, [setTranscriptSafe]);

  useEffect(() => {
    return () => {
      void stopListening();
    };
  }, [stopListening]);

  return {
    listening,
    transcript,
    isNative,
    startListening,
    stopListening,
    resetTranscript,
    getTranscript,
    receivedInput,
  };
};
