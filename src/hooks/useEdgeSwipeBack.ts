import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * iOS-style edge-swipe-back gesture.
 *
 * Listens for a touch that *starts* within the left-edge gutter and travels
 * horizontally far enough to count as a deliberate "go back" swipe, then calls
 * navigate(-1). Only fires when there is actual browser history to pop; on the
 * home route or a fresh launch it's a no-op.
 *
 * Why touch events (not pointer events): pointer events on iOS WKWebView are
 * flaky with scroll containers; native touch events consistently fire first
 * and give us the edge-start coordinate we need.
 *
 * Why we don't implement forward-swipe: user confirmed A (back only) for v1.
 */
export function useEdgeSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't capture swipes on the root / onboarding — there's nothing to pop.
    if (location.pathname === "/" || location.pathname === "/onboarding") {
      return;
    }

    // Configuration
    const EDGE_GUTTER_PX = 24;      // how close to the left edge the swipe must start
    const ACTIVATION_PX = 60;       // min horizontal travel to count as a swipe
    const CANCEL_VERT_PX = 40;      // if the user drifts this far vertically first, bail
    const MAX_DURATION_MS = 600;    // swipes longer than this probably aren't swipes
    const MIN_VELOCITY_PX_PER_MS = 0.3; // fast flick override: pass even if < ACTIVATION_PX

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let resolved = false; // prevents firing twice in one gesture

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_GUTTER_PX) return;

      startX = t.clientX;
      startY = t.clientY;
      startTime = performance.now();
      tracking = true;
      resolved = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || resolved) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);

      // Abandon if the user is clearly trying to scroll vertically.
      if (dy > CANCEL_VERT_PX && dy > dx) {
        tracking = false;
        return;
      }

      const elapsed = performance.now() - startTime;
      const velocity = dx / Math.max(elapsed, 1);

      if (
        dx >= ACTIVATION_PX ||
        (dx >= EDGE_GUTTER_PX && velocity >= MIN_VELOCITY_PX_PER_MS)
      ) {
        resolved = true;
        tracking = false;
        // Use browser history so it plays nice with React Router's stack.
        // If there's no history, fall back to home.
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate("/");
        }
      }
    };

    const onTouchEnd = () => {
      if (!tracking) return;
      const elapsed = performance.now() - startTime;
      if (elapsed > MAX_DURATION_MS) {
        tracking = false;
      }
      tracking = false;
    };

    // Passive listeners — we don't preventDefault because we don't want to
    // interfere with anything else the page is doing (text selection,
    // pull-to-refresh, etc.). The gesture is "detect and navigate," nothing more.
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [navigate, location.pathname]);
}
