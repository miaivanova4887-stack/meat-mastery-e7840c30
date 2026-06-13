import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/redirectOrigin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Stripe checkout timed out after 8 seconds")), 8000)
    );

    const origin = safeOrigin(req);
    const session = await Promise.race([
      stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: "price_1TFm5RBCKK2x5xtVzSHn0acA", quantity: 1 }],
        mode: "payment",
        success_url: `${origin}/?coaching_payment=success`,
        cancel_url: `${origin}/?coaching_payment=cancelled`,
        metadata: { userId: user.id, type: "coaching_session" },
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
