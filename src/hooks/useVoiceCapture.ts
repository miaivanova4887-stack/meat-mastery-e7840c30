import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

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

  const stopListening = useCallback(async () => {
    if (isNative) {
      try {
        await SpeechRecognition.stop();
      } catch {
        // ignore native stop errors
      }

      const nativeStoppedWait = nativeStoppedWaitRef.current?.promise;
      if (nativeStoppedWait) {
        await Promise.race([nativeStoppedWait, new Promise((resolve) => setTimeout(resolve, 1200))]);
      }

      const pendingStart = nativeStartPromiseRef.current;
      if (pendingStart) {
        await Promise.race([
          pendingStart.catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
      }

      await cleanupNativeListeners();
      nativeStoppedWaitRef.current = null;
    } else {
      webRecognitionRef.current?.stop();
    }

    setListening(false);
  }, [cleanupNativeListeners, isNative]);

  const startNativeListening = useCallback(async () => {
    const usePopup = false;
    const usePartialResults = false;

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
    setTranscriptSafe("");

    let resolveStopped = () => {};
    const stoppedPromise = new Promise<void>((resolve) => {
      resolveStopped = resolve;
    });
    nativeStoppedWaitRef.current = { promise: stoppedPromise, resolve: resolveStopped };

    const listeningStateHandle = await SpeechRecognition.addListener("listeningState", ({ status }: any) => {
      if (status === "stopped") {
        nativeStoppedWaitRef.current?.resolve();
        setListening(false);
      }
    });

    const listenerHandles: ListenerHandle[] = [listeningStateHandle];

    if (usePartialResults) {
      const partialResultsHandle = await SpeechRecognition.addListener("partialResults", (payload: any) => {
        const partialMatch = extractFirstMatch(payload);
        if (partialMatch) {
          setTranscriptSafe(partialMatch);
        }
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
          const finalMatch = extractFirstMatch(result);
          if (finalMatch) {
            setTranscriptSafe(finalMatch);
          }
        })
        .catch((error: any) => {
          if (messageIncludesPermissionBlock(error)) {
            onPermissionBlocked?.();
          } else if (isNoSpeechError(error)) {
            onError?.("I couldn’t recognize speech. Please speak clearly and try again.");
          } else {
            onError?.("Microphone couldn't detect speech. Please try again.");
          }
        })
        .finally(() => {
          nativeStartPromiseRef.current = null;
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
  }, [isNative, onError, onPermissionBlocked, startNativeListening, startWebListening]);

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
  };
};
