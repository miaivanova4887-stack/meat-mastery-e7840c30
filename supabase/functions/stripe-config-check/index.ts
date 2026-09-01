// TEMPORARY admin-only diagnostic: proves which Stripe account/mode the
// configured STRIPE_SECRET_KEY belongs to and whether the hardcoded coaching
// price IDs exist and are active there. Returns NO secret values.
// Remove once the coaching checkout is verified end-to-end.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const USD_COACHING_PRICE_ID = "price_1TFm5RBCKK2x5xtVzSHn0acA";
const CAD_COACHING_PRICE_ID = "price_1TjmKyBCKK2x5xtVbvfukFie";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function keyMode(key: string): "live" | "test" | "unknown" {
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden" }, 403);

  const primary = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const legacy = Deno.env.get("STRIPE_LIVE_SECRET_KEY") ?? "";
  const stripeKey = primary || legacy;

  const report: Record<string, unknown> = {
    secrets: {
      STRIPE_SECRET_KEY: { configured: !!primary, mode: primary ? keyMode(primary) : null },
      STRIPE_LIVE_SECRET_KEY: { configured: !!legacy, mode: legacy ? keyMode(legacy) : null },
      CAL_WEBHOOK_SECRET: { configured: !!Deno.env.get("CAL_WEBHOOK_SECRET") },
    },
    keyUsedByCheckout: primary ? "STRIPE_SECRET_KEY" : legacy ? "STRIPE_LIVE_SECRET_KEY" : null,
    modeUsedByCheckout: stripeKey ? keyMode(stripeKey) : null,
  };

  if (!stripeKey) {
    report.ok = false;
    report.reason = "No Stripe secret key configured";
    return json(report, 200);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  // Account identity (so the key can be matched to the right dashboard).
  try {
    const acct = await stripe.accounts.retrieve();
    report.account = {
      id: acct.id,
      businessName: acct.business_profile?.name ?? acct.settings?.dashboard?.display_name ?? null,
      country: acct.country ?? null,
      chargesEnabled: acct.charges_enabled ?? null,
      defaultCurrency: acct.default_currency ?? null,
    };
  } catch (e) {
    report.account = { error: (e as Error).message };
  }

  const prices: Record<string, unknown> = {};
  for (const [label, id] of [
    ["USD", USD_COACHING_PRICE_ID],
    ["CAD", CAD_COACHING_PRICE_ID],
  ] as const) {
    try {
      const price = await stripe.prices.retrieve(id, { expand: ["product"] });
      const product = price.product as { id?: string; name?: string; active?: boolean } | string;
      prices[label] = {
        id,
        exists: true,
        active: price.active,
        livemode: price.livemode,
        currency: price.currency?.toUpperCase() ?? null,
        unitAmount: price.unit_amount,
        type: price.type,
        productId: typeof product === "string" ? product : product?.id ?? null,
        productName: typeof product === "string" ? null : product?.name ?? null,
        productActive: typeof product === "string" ? null : product?.active ?? null,
      };
    } catch (e) {
      const err = e as { message?: string; code?: string; type?: string };
      prices[label] = {
        id,
        exists: false,
        error: err?.message ?? "unknown",
        code: err?.code ?? null,
        type: err?.type ?? null,
      };
    }
  }
  report.coachingPrices = prices;

  const usd = prices.USD as { exists?: boolean; active?: boolean; currency?: string };
  const cad = prices.CAD as { exists?: boolean; active?: boolean; currency?: string };
  report.ok =
    !!usd?.exists && !!usd?.active && usd?.currency === "USD" &&
    !!cad?.exists && !!cad?.active && cad?.currency === "CAD";

  return json(report, 200);
});
