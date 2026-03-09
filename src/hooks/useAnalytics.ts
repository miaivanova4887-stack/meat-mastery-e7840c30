import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
      if (!user) return; // Only track authenticated users
      const platform = detectPlatform();
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
      trackEvent("page_view", { path: location.pathname });
    }
  }, [location.pathname, trackEvent]);
}
