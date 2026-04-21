import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Horizontal swipe between the primary tabs:
 *   Home (/) ←→ Recipes (/recipes) ←→ Plan (/meal-plan) ←→ Progress (/progress) ←→ Profile (/profile)
 *
 * Note: only the first four live in the bottom nav; Profile is reachable by
 * swiping right from Progress (and by its usual top-right icon). This mirrors
 * apps like Instagram where the profile tab is the rightmost swipe target.
 *
 * Direction mapping (matches iOS pagers / Safari tabs):
 *   - Right-to-left (finger drags leftward)  → next tab
 *   - Left-to-right (finger drags rightward) → previous tab
 *
 * Coexistence with useEdgeSwipeBack:
 *   - Edge-back only fires when the touch *starts* within 24px of the left edge.
 *   - This hook only fires when the touch *starts* in the middle 70% of the
 *     viewport (i.e. ≥15% in from either side). The two zones never overlap,
 *     so a single swipe can only trigger one of them.
 *
 * Coexistence with internal horizontal scrollers (day chips on MealPlan,
 * category tabs on Progress, recipe carousels, etc.):
 *   - On touchstart we walk up from the touch target and if we find an
 *     ancestor that is horizontally scrollable, we stand down for this gesture.
 */

const TAB_ORDER = ["/", "/recipes", "/meal-plan", "/progress", "/profile"] as const;
type TabPath = typeof TAB_ORDER[number];

function isTabRoute(pathname: string): pathname is TabPath {
  return (TAB_ORDER as readonly string[]).includes(pathname);
}

// Returns true if `el` or any ancestor up to the document has horizontal
// scrolling available (scrollWidth > clientWidth and overflow-x is scroll/auto).
// Used to bail out of page-swipe so we don't hijack internal carousels.
function hasHorizontalScrollAncestor(el: Element | null): boolean {
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 1
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function useTabSwipe() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isTabRoute(location.pathname)) return;

    // Gesture config — tuned for a responsive feel. If you want it even
    // snappier, drop ACTIVATION_PX further; if it starts misfiring on
    // vertical scroll, raise HORIZ_DOMINANCE.
    const SIDE_GUTTER_FRACTION = 0.12; // ignore touches starting in outer 12% of either side
    const ACTIVATION_PX = 40;          // min horizontal travel to count as a tab swipe
    const HORIZ_DOMINANCE = 1.4;       // |dx| must exceed |dy| by this factor
    const CANCEL_VERT_PX = 50;         // vertical drift before we abandon
    const MAX_DURATION_MS = 600;
    const MIN_VELOCITY_PX_PER_MS = 0.2; // fast-flick override

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;
    let resolved = false;

    const currentIndex = TAB_ORDER.indexOf(location.pathname as TabPath);

    const goToDelta = (delta: number) => {
      const next = currentIndex + delta;
      if (next < 0 || next >= TAB_ORDER.length) return; // no wrap — clamp at ends
      if (next === currentIndex) return;
      navigate(TAB_ORDER[next]);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      const leftGutter = w * SIDE_GUTTER_FRACTION;
      const rightGutter = w - leftGutter;

      // Ignore outer gutters — edge-back owns the left, and we want to leave
      // the right edge free for potential right-edge affordances.
      if (t.clientX < leftGutter || t.clientX > rightGutter) return;

      // Stand down if the touch began inside an internal horizontal scroller.
      const target = e.target as Element | null;
      if (hasHorizontalScrollAncestor(target)) return;

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
      const dy = t.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Vertical bail-out — user is scrolling the page, not swiping tabs.
      if (absDy > CANCEL_VERT_PX && absDy > absDx) {
        tracking = false;
        return;
      }

      const elapsed = performance.now() - startTime;
      const velocity = absDx / Math.max(elapsed, 1);

      const passedDistance = absDx >= ACTIVATION_PX;
      const passedFlick = absDx >= 20 && velocity >= MIN_VELOCITY_PX_PER_MS;
      const horizontallyDominant = absDx > absDy * HORIZ_DOMINANCE;

      if ((passedDistance || passedFlick) && horizontallyDominant) {
        resolved = true;
        tracking = false;
        // dx < 0 → finger moved left → next tab (forward)
        // dx > 0 → finger moved right → previous tab (back)
        goToDelta(dx < 0 ? 1 : -1);
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
