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

export const useVoiceCapture = ({
  language = "en-US",
  onPermissionBlocked,
  onError,
}: UseVoiceCaptureOptions = {}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const webRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const nativeListenersRef = useRef<ListenerHandle[]>([]);

  const isNative = Capacitor.isNativePlatform();

  const cleanupNativeListeners = useCallback(async () => {
    const handles = nativeListenersRef.current;
    nativeListenersRef.current = [];
    await Promise.allSettled(handles.map((h) => h.remove()));
  }, []);

  const stopListening = useCallback(async () => {
    if (isNative) {
      try {
        await SpeechRecognition.stop();
      } catch {
        // ignore native stop errors
      }
      await cleanupNativeListeners();
    } else {
      webRecognitionRef.current?.stop();
    }

    setListening(false);
  }, [cleanupNativeListeners, isNative]);

  const startNativeListening = useCallback(async () => {
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
    setTranscript("");

    const partialResultsHandle = await SpeechRecognition.addListener("partialResults", (data: any) => {
      const firstMatch = Array.isArray(data?.matches)
        ? data.matches[0]
        : Array.isArray(data?.value)
          ? data.value[0]
          : "";

      if (firstMatch) {
        setTranscript(firstMatch);
      }
    });

    const listeningStateHandle = await SpeechRecognition.addListener("listeningState", ({ status }: any) => {
      if (status === "stopped") {
        setListening(false);
      }
    });

    nativeListenersRef.current = [partialResultsHandle, listeningStateHandle];

    await SpeechRecognition.start({
      language,
      maxResults: 1,
      partialResults: true,
      popup: false,
      prompt: "Speak now",
    });

    setListening(true);
    return true;
  }, [cleanupNativeListeners, language, onError, onPermissionBlocked]);

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
      setTranscript(combined);
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
    setTranscript("");

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
  }, [language, onError, onPermissionBlocked]);

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
    setTranscript("");
  }, []);

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
  };
};
