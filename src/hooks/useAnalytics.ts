import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logGaEvent } from "@/lib/firebase";

/** Detect platform from user agent */
function detectPlatform(): "ios" | "android" | "web" {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

// Generate a simple session ID that persists for the browser session
function getSessionId() {
  let sid = sessionStorage.getItem("analytics-session-id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("analytics-session-id", sid);
  }
  return sid;
}

export function useTrackEvent() {
  const { user } = useAuth();

  return useCallback(
    (eventType: string, eventData: Record<string, unknown> = {}, pagePath?: string) => {
      const platform = detectPlatform();
      // GA4: mirror every event (works for signed-out users too).
      // GA4 event names: max 40 chars, [a-z0-9_], must start with a letter.
      const gaName = eventType.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
      if (/^[a-z]/.test(gaName)) {
        const params: Record<string, string | number | boolean> = { platform };
        for (const [k, v] of Object.entries(eventData)) {
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            params[k.slice(0, 40)] = v;
          }
        }
        logGaEvent(gaName, params);
      }
      if (!user) return; // Supabase analytics_events: only authenticated users
      (supabase as any)
        .from("analytics_events")
        .insert({
          user_id: user.id,
          event_type: eventType,
          event_data: { ...eventData, platform },
          page_path: pagePath || window.location.pathname,
          session_id: getSessionId(),
        })
        .then(() => {}); // fire-and-forget
    },
    [user]
  );
}

/** Auto-tracks page views on route changes */
export function usePageViewTracker() {
  const location = useLocation();
  const trackEvent = useTrackEvent();
  const lastPath = useRef("");

  useEffect(() => {
    if (location.pathname !== lastPath.current) {
      lastPath.current = location.pathname;
      // GA4 screen_view for every route change (all users, signed in or out).
      logGaEvent("screen_view", {
        firebase_screen: location.pathname,
        platform: detectPlatform(),
      });
      trackEvent("page_view", { path: location.pathname });
    }
  }, [location.pathname, trackEvent]);
}
