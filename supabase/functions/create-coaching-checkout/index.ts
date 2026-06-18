import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/redirectOrigin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Coaching price IDs per region (LIVE Stripe). USD is the default for the US
// and every country that is not Canada. The CAD price must be created on the
// SAME coaching product (prod_UjEolHKfmoeJXD) in LIVE mode; until that price
// ID is filled in here, CAD safely falls back to the USD price.
const USD_COACHING_PRICE_ID = "price_1TFm5RBCKK2x5xtVzSHn0acA";
const CAD_COACHING_PRICE_ID = ""; // TODO: paste the LIVE CAD price_... id (CAD 12999)

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

async function detectCountryFromIp(req: Request): Promise<string> {
  try {
    const ip = clientIp(req);
    if (!ip || ip === "127.0.0.1" || ip === "::1") return "US";
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    try {
      const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
        signal: ctrl.signal,
        headers: { "User-Agent": "carnivorex-coaching-checkout/1.0" },
      });
      if (resp.ok) {
        const code = (await resp.text()).trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(code)) return code;
      }
    } finally {
      clearTimeout(t);
    }
  } catch (_e) {
    /* ignore */
  }
  return "US";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Use the same Stripe secret convention as the rest of the payment
    // backend (create-checkout, check-subscription, customer-portal,
    // requireTier). Prefer STRIPE_SECRET_KEY; fall back to the legacy
    // STRIPE_LIVE_SECRET_KEY only if STRIPE_SECRET_KEY is not configured.
    const stripeKey =
      Deno.env.get("STRIPE_SECRET_KEY") ||
      Deno.env.get("STRIPE_LIVE_SECRET_KEY") ||
      "";
    if (!stripeKey) {
      throw new Error("Stripe secret key is not set (STRIPE_SECRET_KEY)");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine the billing region. The client may send a country hint
    // (manual override / its own detection), but we re-validate server-side via
    // IP geolocation when no explicit hint is provided so the override is a
    // hint, not blind trust.
    let countryHint = "";
    try {
      const body = await req.json().catch(() => ({}));
      countryHint = String(body?.country ?? "").toUpperCase();
    } catch (_e) {
      countryHint = "";
    }
    const country =
      countryHint === "CA" || countryHint === "US"
        ? countryHint
        : await detectCountryFromIp(req);

    const priceId =
      country === "CA" && CAD_COACHING_PRICE_ID
        ? CAD_COACHING_PRICE_ID
        : USD_COACHING_PRICE_ID;
    const currency = priceId === CAD_COACHING_PRICE_ID ? "CAD" : "USD";

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Stripe checkout timed out after 8 seconds")), 8000)
    );

    const origin = safeOrigin(req);
    const session = await Promise.race([
      stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        success_url: `${origin}/?coaching_payment=success`,
        cancel_url: `${origin}/?coaching_payment=cancelled`,
        metadata: {
          userId: user.id,
          type: "coaching_session",
          country,
          currency,
        },
      }),
      timeoutPromise,
    ]);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = (error as Error).message;
    const status = msg.includes("timed out") ? 504 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
