// Listens for push-tap navigation requests emitted by src/lib/pushFcm.ts
// (and the web push service worker via postMessage in the future). Drains
// both the module-level pending value and an optional sessionStorage
// fallback so cold-start taps reliably land on the deep route once React
// Router has mounted. All navigation is wrapped in requestAnimationFrame
// to ensure the router has committed its initial render before we navigate.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { consumePendingPushNav, consumePersistedPushNav } from "@/lib/pushFcm";

const PENDING_KEY = "push-nav-pending";

function safePath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  if (!p.startsWith("/")) return null;
  return p;
}

function readStored(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    if (v) sessionStorage.removeItem(PENDING_KEY);
    return safePath(v);
  } catch {
    return null;
  }
}

export function usePushNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    console.info("[PushNav] consumer mounted");

    const go = (path: string, reason: string) => {
      console.info("[PushNav] navigate scheduled", { path, reason });
      requestAnimationFrame(() => {
        console.info("[PushNav] navigate calling", { path });
        navigate(path, { replace: true });
        import("@/lib/pushRouteIntent").then((m) => m.markPushRouteIntentConsumed()).catch(() => {});
        requestAnimationFrame(() => {
          console.info("[PushNav] post-nav location", {
            path: window.location.pathname + window.location.search,
          });
        });
        const startedAt = Date.now();
        const expected = path;
        const check = (label: string) => {
          const current = window.location.pathname + window.location.search;
          if (current !== expected) {
            console.warn("[PushNav] route changed away from push target", {
              expected, current, ageMs: Date.now() - startedAt, label,
            });
          } else {
            console.info("[PushNav] route held", { label, current });
          }
        };
        setTimeout(() => check("t+250ms"), 250);
        setTimeout(() => check("t+1000ms"), 1000);
        setTimeout(() => check("t+3000ms"), 3000);
      });
    };

    const drain = (reason: string) => {
      const m = safePath(consumePendingPushNav());
      const s = readStored();
      const p = safePath(consumePersistedPushNav());
      console.info("[PushNav] drain", { reason, module: m, stored: s, persisted: p });
      const path = m ?? s ?? p;
      if (path) go(path, `drain:${reason}`);
    };

    // Primary drain: right after mount.
    drain("mount");
    // Belt-and-suspenders: re-check after the current microtask in case the
    // native actionPerformed listener queued a path just after we mounted.
    const t = setTimeout(() => drain("post-mount-timeout"), 0);
    // Cold-start native taps can arrive AFTER first React render because the
    // OS hands the launch notification to the JS plugin only after the bridge
    // finishes booting. Re-drain at 500ms and 1500ms to catch that window.
    const t2 = setTimeout(() => drain("post-mount-500"), 500);
    const t3 = setTimeout(() => drain("post-mount-1500"), 1500);

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { path?: string } | undefined;
      const path = safePath(detail?.path);
      console.info("[PushNav] event received", { rawPath: detail?.path, accepted: !!path });
      if (!path) return;
      go(path, "event");
    };
    window.addEventListener("push-nav", handler);
    return () => {
      window.removeEventListener("push-nav", handler);
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [navigate]);
}
