import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export interface OpenExternalResult {
  ok: boolean;
  native: boolean;
  error?: unknown;
}

/**
 * Open an external URL.
 *
 * - Native (iOS/Android): uses @capacitor/browser. Does NOT fall back to
 *   window.open on failure — WKWebView's window.open is unreliable and is
 *   the exact failure mode we're avoiding. Callers must handle ok=false by
 *   surfacing a copyable URL.
 * - Web: uses window.open in a new tab.
 *
 * Emits structured diag logs (default tag `coaching:open-scheduler`):
 *   <tag>-url-ready, <tag>-native-open-ok, <tag>-native-open-failed
 */
export async function openExternalUrl(
  url: string | null | undefined,
  opts: { logTag?: string } = {},
): Promise<OpenExternalResult> {
  const tag = opts.logTag ?? "coaching:open-scheduler";
  const native = Capacitor.isNativePlatform();

  if (!url) {
    console.warn(`${tag}-url-ready`, { url: null, native });
    return { ok: false, native, error: new Error("missing-url") };
  }

  console.log(`${tag}-url-ready`, { url, native });

  if (native) {
    try {
      await Browser.open({ url, windowName: "_blank" });
      console.log(`${tag}-native-open-ok`, { url });
      return { ok: true, native: true };
    } catch (error) {
      console.error(`${tag}-native-open-failed`, { url, error });
      return { ok: false, native: true, error };
    }
  }

  try {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      return { ok: false, native: false, error: new Error("popup-blocked") };
    }
    return { ok: true, native: false };
  } catch (error) {
    return { ok: false, native: false, error };
  }
}

/** Copy a string to clipboard with a textarea fallback for old WebViews. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
