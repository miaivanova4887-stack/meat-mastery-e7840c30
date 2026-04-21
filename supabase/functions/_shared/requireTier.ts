// supabase/functions/_shared/requireTier.ts
//
// Server-side subscription tier enforcement for Supabase Edge Functions.
//
// Purpose: close the paywall bypass where an authenticated free/pro user could
// call a gated AI function directly (via `supabase.functions.invoke` or curl)
// with their JWT and skip the client-side TeaserGate component.
//
// Usage (in a Deno edge function, after the CORS preflight early-return):
//
//   import { requireTier, corsHeaders } from "../_shared/requireTier.ts";
//   // ...
//   const gate = await requireTier(req, "pro");
//   if (gate instanceof Response) return gate;   // 401 / 403 / 500
//   // gate.userId, gate.email, gate.tier are available on success
//
// Tier ranking matches src/contexts/SubscriptionContext.tsx (free < pro < elite).
// Stripe product → tier mapping is kept in sync with check-subscription/index.ts.

// NOTE: these imports must match the versions used by the other edge functions
// (esm.sh/stripe@18.5.0, npm:@supabase/supabase-js@2.57.2). Do not bump.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

export type SubscriptionTier = "free" | "pro" | "elite";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

// Keep these in lockstep with supabase/functions/check-subscription/index.ts.
const PRO_PRODUCTS = ["prod_UDKQuuDbkzFeAQ", "prod_UDKRnuNBZAt90m"];
const ELITE_PRODUCTS = ["prod_UDKR86KzvAtCwC", "prod_UDKRxb2dW2O5Fv"];

// Shared CORS headers — identical to the ones defined in each function file so
// callers can reuse this export if they want a single source of truth.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REQUIRE-TIER] ${step}${detailsStr}`);
};

// Per-edge-instance in-memory cache. 60s TTL. Worst case on a cold instance is
// one extra Stripe lookup per user; that's fine.
type CacheEntry = { tier: SubscriptionTier; email: string; expiresAt: number };
const TIER_CACHE_TTL_MS = 60 * 1000;
const tierCache = new Map<string, CacheEntry>();

const now = () => Date.now();

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface RequireTierSuccess {
  ok: true;
  tier: SubscriptionTier;
  userId: string;
  email: string;
}

/**
 * Enforce that the caller has at least `requiredTier`. Returns a success object
 * on pass, or a fully-formed `Response` (401/403/500) that the caller should
 * return directly. Never throws on the happy path; on unexpected errors it
 * returns a 500 `Response` rather than bubbling.
 */
export async function requireTier(
  req: Request,
  requiredTier: SubscriptionTier,
): Promise<RequireTierSuccess | Response> {
  try {
    // ---------- 1. Auth: verify the user's JWT ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "missing_authorization" }, 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return jsonResponse({ error: "missing_authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      logStep("ERROR missing supabase env");
      return jsonResponse({ error: "server_misconfigured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      logStep("auth failed", { err: userError?.message });
      return jsonResponse({ error: "unauthorized" }, 401);
    }
    const user = userData.user;
    if (!user.email) {
      return jsonResponse({ error: "unauthorized", reason: "no_email" }, 401);
    }

    // ---------- 2. Resolve tier (cache → Stripe) ----------
    let tier: SubscriptionTier | null = null;
    const cached = tierCache.get(user.id);
    if (cached && cached.expiresAt > now() && cached.email === user.email) {
      tier = cached.tier;
      logStep("tier cache hit", { userId: user.id, tier });
    }

    if (tier === null) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        logStep("ERROR STRIPE_SECRET_KEY not set");
        return jsonResponse({ error: "server_misconfigured" }, 500);
      }

      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });

        if (customers.data.length === 0) {
          tier = "free";
        } else {
          const customerId = customers.data[0].id;
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "active",
            limit: 10,
          });

          let resolved: SubscriptionTier = "free";
          for (const sub of subscriptions.data) {
            const subProductId = sub.items.data[0]?.price?.product as string | undefined;
            if (subProductId && ELITE_PRODUCTS.includes(subProductId)) {
              resolved = "elite";
              break; // elite wins — no need to keep looking
            } else if (subProductId && PRO_PRODUCTS.includes(subProductId)) {
              resolved = "pro";
              // keep looping in case a higher-tier elite sub exists
            }
          }
          tier = resolved;
        }
      } catch (stripeErr) {
        // If Stripe is unavailable we fail closed on paid tiers to avoid
        // accidentally granting access, but return 500 so the client knows it
        // wasn't actually a tier decision.
        logStep("ERROR stripe lookup failed", {
          err: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
        });
        return jsonResponse({ error: "subscription_check_failed" }, 500);
      }

      tierCache.set(user.id, {
        tier,
        email: user.email,
        expiresAt: now() + TIER_CACHE_TTL_MS,
      });
      logStep("tier resolved from stripe", { userId: user.id, tier });
    }

    // ---------- 3. Compare against requirement ----------
    if (TIER_RANK[tier] < TIER_RANK[requiredTier]) {
      logStep("upgrade required", { userId: user.id, tier, requiredTier });
      return jsonResponse(
        {
          error: "upgrade_required",
          requiredTier,
          currentTier: tier,
        },
        403,
      );
    }

    return { ok: true, tier, userId: user.id, email: user.email };
  } catch (e) {
    // Catch-all so a bug in the gate never throws into the caller.
    logStep("ERROR unexpected", {
      err: e instanceof Error ? e.message : String(e),
    });
    return jsonResponse({ error: "tier_check_failed" }, 500);
  }
}

// Exposed for tests / manual invalidation if ever needed.
export function _clearTierCacheForTests() {
  tierCache.clear();
}
