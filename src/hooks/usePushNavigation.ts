// Listens for push-tap navigation requests emitted by src/lib/pushFcm.ts
// (and the web push service worker via postMessage in the future). Drains
// both the module-level pending value and an optional sessionStorage
// fallback so cold-start taps reliably land on the deep route once React
// Router has mounted.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { consumePendingPushNav } from "@/lib/pushFcm";

const PENDING_KEY = "push-nav-pending";

function safePath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  if (!p.startsWith("/")) return null;
  return p;
}

export function usePushNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const go = (path: string) => {
      console.info("[PushNav] navigate", path);
      navigate(path);
    };

    // 1) Drain module-level pending (primary cold-start handoff)
    const pendingModule = safePath(consumePendingPushNav());
    if (pendingModule) {
      go(pendingModule);
    } else {
      // 2) Belt-and-suspenders fallback via sessionStorage
      try {
        const stored = sessionStorage.getItem(PENDING_KEY);
        const pendingStored = safePath(stored);
        if (pendingStored) {
          sessionStorage.removeItem(PENDING_KEY);
          go(pendingStored);
        }
      } catch {/* ignore */}
    }

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { path?: string } | undefined;
      const path = safePath(detail?.path);
      if (!path) return;
      go(path);
    };
    window.addEventListener("push-nav", handler);
    return () => window.removeEventListener("push-nav", handler);
  }, [navigate]);
}
