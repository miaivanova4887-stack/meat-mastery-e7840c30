import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll to top on route change — EXCEPT when the URL carries a deep-link
 * hash/section indicator (e.g. push-tap routes Profile to
 * `?tab=settings&section=coaching&sessionId=...`). Without this guard we'd
 * scroll to 0 right before CoachingSessionsList runs its own scrollIntoView,
 * making the deep link land at the top of the page instead.
 */
export const useScrollToTop = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    try {
      const params = new URLSearchParams(search);
      if (params.get("section")) {
        // Defer to the page's own scroll-into-view logic.
        return;
      }
    } catch {/* fall through */}
    window.scrollTo(0, 0);
  }, [pathname, search]);
};
