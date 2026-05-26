import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No auth header — returning free tier");
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      // Stale / revoked / expired session — don't 500, just report unsubscribed.
      // Client-side auth refresh will clear the bad token on its own.
      logStep("Auth invalid — returning free tier", { message: userError?.message ?? "no user" });
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found");
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      logStep("No active subscription");
      return new Response(JSON.stringify({ subscribed: false, tier: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Determine tier from product IDs
    const PRO_PRODUCTS = ["prod_UDKQuuDbkzFeAQ", "prod_UDKRnuNBZAt90m"];
    const ELITE_PRODUCTS = ["prod_UDKR86KzvAtCwC", "prod_UDKRxb2dW2O5Fv"];

    let tier = "free";
    let subscriptionEnd = null;
    let productId = null;

    const getPeriodEnd = (sub: any): string | null => {
      const ts =
        sub.items?.data?.[0]?.current_period_end ??
        sub.current_period_end ??
        sub.trial_end ??
        sub.billing_cycle_anchor ??
        null;
      if (!ts || typeof ts !== "number") return null;
      const d = new Date(ts * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    for (const sub of subscriptions.data) {
      const subProductId = sub.items.data[0]?.price?.product as string;
      if (ELITE_PRODUCTS.includes(subProductId)) {
        tier = "elite";
        subscriptionEnd = getPeriodEnd(sub);
        productId = subProductId;
        break;
      } else if (PRO_PRODUCTS.includes(subProductId)) {
        tier = "pro";
        subscriptionEnd = getPeriodEnd(sub);
        productId = subProductId;
      }
    }

    logStep("Determined tier", { tier, productId });

    return new Response(JSON.stringify({
      subscribed: tier !== "free",
      tier,
      product_id: productId,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
