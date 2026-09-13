// supabase/functions/_shared/revenuecat.ts
//
// Server-side RevenueCat (app-store subscription) tier lookup, used by
// requireTier.ts so Pro/Elite members who bought inside the Android or iOS app
// pass the same gate as web (Stripe) subscribers.
//
// Uses the RevenueCat V2 REST API with REVENUECAT_V2_SECRET_KEY. The RC app
// user id is the Supabase user id (the client calls identifyUser(user.id)).

export type RcTier = "free" | "pro" | "elite";

const RC_API = "https://api.revenuecat.com/v2";

// Entitlement identifiers configured in the RC dashboard. Keep in lockstep with
// src/lib/revenuecat.ts (ENTITLEMENT_PRO / ENTITLEMENT_ELITE).
const ENTITLEMENT_PRO = "pro";
const ENTITLEMENT_ELITE = "elite";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REVENUECAT] ${step}${d}`);
};

// Cached project id per edge instance (one extra call on a cold start).
let cachedProjectId: string | null = null;

async function rcFetch(path: string, secretKey: string): Promise<Response> {
  return await fetch(`${RC_API}${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
    },
  });
}

async function resolveProjectId(secretKey: string): Promise<string | null> {
  const fromEnv = Deno.env.get("REVENUECAT_PROJECT_ID");
  if (fromEnv) return fromEnv;
  if (cachedProjectId) return cachedProjectId;

  const res = await rcFetch("/projects", secretKey);
  if (!res.ok) {
    log("ERROR list projects failed", { status: res.status, body: await res.text() });
    return null;
  }
  const body = await res.json().catch(() => null) as { items?: Array<{ id?: string }> } | null;
  const id = body?.items?.[0]?.id ?? null;
  if (id) cachedProjectId = id;
  return id;
}

/**
 * Resolve the RevenueCat tier for a Supabase user id.
 *
 * Returns:
 *  - "free" | "pro" | "elite" when RevenueCat answered (a 404 customer = free)
 *  - null when the lookup could not be performed (no key, network/API error).
 *    Callers must treat null as "unknown" and fall back to Stripe rather than
 *    locking out a paying member.
 */
export async function getRevenueCatTier(appUserId: string): Promise<RcTier | null> {
  const secretKey = Deno.env.get("REVENUECAT_V2_SECRET_KEY");
  if (!secretKey) {
    log("no REVENUECAT_V2_SECRET_KEY configured — skipping RC lookup");
    return null;
  }

  try {
    const projectId = await resolveProjectId(secretKey);
    if (!projectId) return null;

    const res = await rcFetch(
      `/projects/${projectId}/customers/${encodeURIComponent(appUserId)}/active_entitlements`,
      secretKey,
    );

    if (res.status === 404) {
      // Unknown customer in RevenueCat = never purchased in-app.
      log("customer not found in RC", { appUserId });
      return "free";
    }
    if (!res.ok) {
      log("ERROR active_entitlements failed", { status: res.status, body: await res.text() });
      return null;
    }

    const body = await res.json().catch(() => null) as
      | { items?: Array<{ entitlement_id?: string }> }
      | null;
    const ids = (body?.items ?? [])
      .map((i) => i.entitlement_id)
      .filter((id): id is string => Boolean(id));

    if (ids.includes(ENTITLEMENT_ELITE)) return "elite";
    if (ids.includes(ENTITLEMENT_PRO)) return "pro";
    return "free";
  } catch (e) {
    log("ERROR unexpected", { err: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
