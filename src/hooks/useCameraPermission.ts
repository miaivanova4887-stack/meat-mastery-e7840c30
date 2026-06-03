import { useCallback, useEffect, useState } from "react";

/**
 * Centralized camera permission hook.
 *
 * The OS is the source of truth. localStorage is only a UX hint —
 * it's reconciled against the live permission on app resume and
 * before every camera entry point, so users who enable the camera
 * in iOS Settings see the change immediately when they return.
 */

export type CameraPermissionState = "granted" | "denied" | "prompt" | "unknown";

const CAMERA_DENIED_KEY = "camera-denied-once";

const readDeniedFlag = (): boolean => {
  try {
    return localStorage.getItem(CAMERA_DENIED_KEY) === "1";
  } catch {
    return false;
  }
};

const writeDeniedFlag = (v: boolean) => {
  try {
    if (v) localStorage.setItem(CAMERA_DENIED_KEY, "1");
    else localStorage.removeItem(CAMERA_DENIED_KEY);
  } catch {
    /* ignore */
  }
};

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

const queryNativeCameraPermission = async (): Promise<CameraPermissionState | null> => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const { Camera } = await import("@capacitor/camera");
    const res = await Camera.checkPermissions();
    switch (res?.camera) {
      case "granted":
      case "limited":
        return "granted";
      case "denied":
return "denied";
      case "prompt":
      case "prompt-with-rationale":
        return "prompt";
      default:
        return "unknown";
    }
  } catch {
    return null;
  }
};

const queryPermissionsApi = async (): Promise<CameraPermissionState> => {
  // On Capacitor native, AVCaptureDevice (via @capacitor/camera) is the
  // only reliable source — WKWebView's Permissions API is unreliable for
  // `camera` and typically returns "prompt" even after native grant.
  const native = await queryNativeCameraPermission();
  if (native !== null) return native;

  try {
    const perms = (navigator as any).permissions;
    if (!perms?.query) return "unknown";
    const res = await perms.query({ name: "camera" as PermissionName });
    return (res?.state as CameraPermissionState) ?? "unknown";
  } catch {
    return "unknown";
  }
};

// Module-scope singleton listener: guarantees the stale denied flag
// gets cleared on app resume even if no camera component is mounted.
let resumeListenerInstalled = false;
const installResumeListener = () => {
  if (resumeListenerInstalled) return;
  resumeListenerInstalled = true;

  const reconcile = async () => {
    const state = await queryPermissionsApi();
    if (state === "granted") writeDeniedFlag(false);
    // Notify hook instances so their local state refreshes.
    try {
      window.dispatchEvent(new CustomEvent("camera-permission-changed"));
    } catch {
      /* ignore */
    }
  };

  // Capacitor app resume
  import("@capacitor/app")
    .then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void reconcile();
      });
    })
    .catch(() => {
      /* web build / plugin unavailable */
    });

  // Web fallback
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void reconcile();
    });
    window.addEventListener("focus", () => void reconcile());
  }
};

export interface UseCameraPermission {
  state: CameraPermissionState;
  /** UX hint: should we short-circuit to the "Camera is off" modal? */
  shouldShowDeniedModal: boolean;
  /** Re-query OS permission state. Clears stale denied flag if granted. */
  refreshPermission: () => Promise<CameraPermissionState>;
  /** Force-prompt via getUserMedia. Authoritative on iOS WKWebView. */
  requestPermission: () => Promise<"granted" | "denied" | "unavailable">;
  /** Caller observed a successful camera open — clear stale flag. */
  markGranted: () => void;
  /** Caller observed a permission-denied error — set hint flag. */
  markDenied: () => void;
}

export function useCameraPermission(): UseCameraPermission {
  const [state, setState] = useState<CameraPermissionState>("unknown");
  const [deniedFlag, setDeniedFlag] = useState<boolean>(() => readDeniedFlag());

  const refreshPermission = useCallback(async () => {
    const next = await queryPermissionsApi();
    setState(next);
    if (next === "granted") {
      writeDeniedFlag(false);
      setDeniedFlag(false);
    }
    return next;
  }, []);

  const markGranted = useCallback(() => {
    writeDeniedFlag(false);
    setDeniedFlag(false);
    setState("granted");
  }, []);

  const markDenied = useCallback(() => {
    writeDeniedFlag(true);
    setDeniedFlag(true);
    setState("denied");
  }, []);

  const requestPermission = useCallback(async (): Promise<"granted" | "denied" | "unavailable"> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return "unavailable";
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((t) => t.stop());
      markGranted();
      return "granted";
    } catch (err: any) {
      if (isPermissionDeniedMessage(err?.message || err?.name || err)) {
        markDenied();
        return "denied";
      }
      return "unavailable";
    }
  }, [markGranted, markDenied]);

  useEffect(() => {
    installResumeListener();
    void refreshPermission();

    const onChanged = () => {
      setDeniedFlag(readDeniedFlag());
      void refreshPermission();
    };
    window.addEventListener("camera-permission-changed", onChanged);
    return () => window.removeEventListener("camera-permission-changed", onChanged);
  }, [refreshPermission]);

  // Only treat as "definitely denied" when the OS confirms it.
  // Permissions API "unknown" + stale flag is NOT enough — we let the
  // real getUserMedia attempt decide, which is the only reliable source
  // of truth on iOS WKWebView.
  const shouldShowDeniedModal = state === "denied";

  return {
    state,
    shouldShowDeniedModal,
    refreshPermission,
    requestPermission,
    markGranted,
    markDenied,
  };
}
