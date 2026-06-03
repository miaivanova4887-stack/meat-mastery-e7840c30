import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Defensive iOS zoom-out helper.
 *
 * iOS Safari auto-zooms when an input with font-size < 16px gets focus,
 * and does NOT restore the original scale when the keyboard dismisses.
 * Briefly forcing `maximum-scale=1` on the viewport meta and reverting
 * on the next frame snaps the page back to scale 1.
 *
 * Call from `onBlur` on any text input/textarea that might trigger zoom.
 */
export function resetViewportScale() {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  const content = viewport.getAttribute("content") ?? "";
  viewport.setAttribute("content", content + ", maximum-scale=1");
  requestAnimationFrame(() => {
    viewport.setAttribute("content", content);
  });
}

