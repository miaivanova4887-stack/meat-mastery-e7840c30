import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { safeOrigin } from "../_shared/redirectOrigin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-side allowlist of Stripe Price IDs that can be checked out.
// Mirrors the subscription IDs surfaced in src/pages/Pricing.tsx. Any other
// ID is rejected. NOTE: the coaching one-off is intentionally NOT here — all
// coaching-call checkouts go through the dedicated `create-coaching-checkout`
// function so every entry point uses the same live coaching price.
const ALLOWED_PRICE_IDS = new Set<string>([
  "price_1TEtllBqDvgi4jU7lMUy48WX", // Pro monthly
  "price_1TEtmCBqDvgi4jU7Bgdijp8o", // Pro yearly
  "price_1TEtmXBqDvgi4jU7C8P9of8n", // Elite monthly
  "price_1TEtmzBqDvgi4jU7rq0QYLjQ", // Elite yearly
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { priceId } = await req.json();
    if (!priceId || typeof priceId !== "string") {
      return new Response(JSON.stringify({ error: "priceId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    if (!ALLOWED_PRICE_IDS.has(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid price" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Determine if this is a one-time payment or subscription
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.recurring ? "subscription" : "payment";

    const origin = safeOrigin(req);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}/pricing?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
