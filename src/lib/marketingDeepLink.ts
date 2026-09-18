/**
 * Marketing (AppsFlyer OneLink) deep-link routing.
 *
 * Two entry points can deliver a marketing destination:
 *  1. The AppsFlyer unified deep-link callback (`UDL_CALLBACK` / OAOA), which
 *     carries `deep_link_value` (or `af_dp` / `deep_link_sub1`).
 *  2. The raw https OneLink URL arriving via Capacitor `appUrlOpen`
 *     (e.g. `https://carnivorex.onelink.me/kWuX/xxxx?deep_link_value=recipes`).
 *
 * Both funnel into a single pending-route slot. `useDeepLinks` consumes it and
 * navigates. Auth deep links are handled separately and are never touched here.
 */

const ONELINK_HOSTS = new Set(["carnivorex.onelink.me"]);
const MARKETING_SCHEME = "carnivorex:";
const AUTH_SCHEME_HOSTS = new Set(["auth", "callback"]);

/** Allow-listed marketing destinations → in-app routes. */
const ROUTE_MAP: Record<string, string> = {
  home: "/",
  benefits: "/benefits",
  recipes: "/recipes",
  "recipe-coach": "/recipe-coach",
  timer: "/timer",
  "ketosis-timer": "/timer",
  "meal-plan": "/meal-plan",
  mealplan: "/meal-plan",
  ingredients: "/ingredients",
  exercise: "/exercise",
  cravings: "/cravings",
  stories: "/stories",
  sustain: "/sustain",
  myths: "/myths",
  guide: "/guide",
  "getting-started": "/getting-started",
  budget: "/budget",
  athletic: "/athletic",
  community: "/community",
  progress: "/progress",
  profile: "/profile",
  news: "/news",
  pricing: "/pricing",
  coaching: "/coaching",
  shopping: "/shopping-bag",
  "shopping-bag": "/shopping-bag",
};

export const MARKETING_DEEPLINK_EVENT = "marketing-deeplink";

let pendingRoute: string | null = null;

export function isMarketingDeepLinkUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (ONELINK_HOSTS.has(u.host)) return true;
    return u.protocol === MARKETING_SCHEME && !AUTH_SCHEME_HOSTS.has(u.host);
  } catch {
    return false;
  }
}

/** Normalize a destination value or path into a known in-app route. */
export function resolveMarketingRoute(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Already an in-app path we know about.
  const asPath = raw.startsWith("/") ? raw : `/${raw}`;
  const knownPaths = new Set(Object.values(ROUTE_MAP));
  if (knownPaths.has(asPath)) return asPath;

  const key = raw.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
  return ROUTE_MAP[key] ?? null;
}

/** Pull a destination out of a raw OneLink https URL's query parameters. */
export function routeFromMarketingUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const isOneLink = ONELINK_HOSTS.has(u.host);
    const isMarketingScheme =
      u.protocol === MARKETING_SCHEME && !AUTH_SCHEME_HOSTS.has(u.host);
    if (!isOneLink && !isMarketingScheme) return null;
    const candidates = [
      u.searchParams.get("deep_link_value"),
      u.searchParams.get("af_dp"),
      u.searchParams.get("deep_link_sub1"),
      u.searchParams.get("route"),
      u.searchParams.get("path"),
      isMarketingScheme ? u.host : null,
      isMarketingScheme ? u.pathname : null,
    ];
    for (const c of candidates) {
      const resolved = resolveMarketingRoute(c);
      if (resolved) return resolved;
    }
    // A bare OneLink has no destination in its URL. AppsFlyer may deliver the
    // destination asynchronously; home is the deterministic immediate fallback.
    return isOneLink ? "/" : null;
  } catch {
    return null;
  }
}

/** Pull a destination out of an AppsFlyer callback payload (any shape). */
export function routeFromAppsFlyerPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const seen = new Set<unknown>();
  const keys = ["deep_link_value", "af_dp", "deep_link_sub1", "route", "path"];

  const walk = (node: unknown, depth: number): string | null => {
    if (!node || typeof node !== "object" || depth > 4 || seen.has(node)) return null;
    seen.add(node);
    const obj = node as Record<string, unknown>;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string") {
        const resolved = resolveMarketingRoute(v);
        if (resolved) return resolved;
      }
    }
    for (const v of Object.values(obj)) {
      const found = walk(v, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(payload, 0);
}

/** Record a destination and notify any mounted consumer. */
export function setPendingMarketingRoute(route: string | null): void {
  if (!route) return;
  pendingRoute = route;
  try {
    window.dispatchEvent(new CustomEvent(MARKETING_DEEPLINK_EVENT, { detail: route }));
  } catch {
    // window may be unavailable in non-DOM contexts; the pending slot still works.
  }
}

/** Read and clear the pending destination. */
export function consumePendingMarketingRoute(): string | null {
  const r = pendingRoute;
  pendingRoute = null;
  return r;
}
