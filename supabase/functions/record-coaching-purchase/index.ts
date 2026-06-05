// supabase/functions/record-coaching-purchase/index.ts
//
// Records a completed coaching-call purchase (StoreKit consumable on iOS,
// Stripe one-off on web) into public.coaching_sessions and returns the
// Cal.com scheduling URL so the client can immediately route the user.
//
// For iOS purchases, we additionally return a no-payment Cal.com URL with
// the user's name + email prefilled, so the user is never asked to pay
// twice (Apple already collected payment) and barely has to re-enter data.
//
// Idempotent on (user_id, transaction_id) — safe to retry from the client
// or to be mirrored by a future RevenueCat webhook.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CAL_PAID_URL = "https://cal.com/carnivorex/coaching-session";
const CAL_IOS_NO_PAYMENT_URL = "https://cal.com/carnivorex/coaching-session-ios";

interface Body {
  source?: "appstore" | "stripe";
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  purchaseDateMs?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Authorization header required" }, 401);
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ error: "Authentication required" }, 401);
    }
    const user = userData.user;

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const source = body.source;
    const productId = (body.productId ?? "").trim();
    const transactionId = (body.transactionId ?? "").trim();

    if (source !== "appstore" && source !== "stripe") {
      return json({ error: "source must be 'appstore' or 'stripe'" }, 400);
    }
    if (!productId || productId.length > 256) {
      return json({ error: "productId is required" }, 400);
    }
    if (!transactionId || transactionId.length > 256) {
      return json({ error: "transactionId is required" }, 400);
    }

    // Service-role client for the insert + profile read so we can write the
    // audit row regardless of the user's RLS surface area.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const purchasedAt = body.purchaseDateMs
      ? new Date(body.purchaseDateMs)
      : new Date();
    const sessionMonth = purchasedAt.toISOString().slice(0, 7); // YYYY-MM

    const { data: inserted, error: insertErr } = await admin
      .from("coaching_sessions")
      .insert({
        user_id: user.id,
        session_type: source === "appstore" ? "paid_ios" : "paid_web",
        session_month: sessionMonth,
        transaction_id: transactionId,
        source,
        stripe_payment_intent: source === "stripe" ? transactionId : null,
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    let sessionRowId: string | null = inserted?.id ?? null;

    if (insertErr) {
      // 23505 = unique_violation → idempotent replay, treat as success.
      // deno-lint-ignore no-explicit-any
      const code = (insertErr as any).code;
      if (code !== "23505") {
        console.error("[record-coaching-purchase] insert failed", insertErr);
        return json({ error: "Could not record purchase" }, 500);
      }
      console.info("[record-coaching-purchase] duplicate, treating as success", {
        userId: user.id,
        transactionId,
      });
      // On duplicate, look up the existing row so we can still attach metadata.
      const { data: existing } = await admin
        .from("coaching_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("transaction_id", transactionId)
        .maybeSingle();
      sessionRowId = existing?.id ?? null;
    }

    // For iOS: build a prefilled no-payment Cal.com URL. Falls back through
    // profiles.display_name -> auth metadata names -> email local-part.
    let iosBookingUrl: string | undefined;
    if (source === "appstore") {
      const email = user.email ?? "";
      let displayName = "";
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        displayName = (profile?.display_name ?? "").trim();
      } catch (e) {
        console.warn("[record-coaching-purchase] profile lookup failed", e);
      }

      if (!displayName) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaName =
          (typeof meta.display_name === "string" && meta.display_name) ||
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && meta.name) ||
          "";
        displayName = String(metaName).trim();
      }
      if (!displayName && email) {
        displayName = email.split("@")[0] ?? "";
      }

      const params = new URLSearchParams();
      if (displayName) params.set("name", displayName);
      if (email) params.set("email", email);
      // Embed our internal user_id (and session row id when known) as Cal.com
      // booking metadata so the cal-webhook can link the booking back to the
      // correct account even when the user enters a different email at
      // booking time (e.g. Apple private relay accounts).
      params.set("metadata[user_id]", user.id);
      if (sessionRowId) params.set("metadata[session_row_id]", sessionRowId);
      const qs = params.toString();
      iosBookingUrl = qs
        ? `${CAL_IOS_NO_PAYMENT_URL}?${qs}`
        : CAL_IOS_NO_PAYMENT_URL;

      console.info("coaching:booking-link-issued", {
        userId: user.id,
        sessionRowId,
        hasName: Boolean(displayName),
        hasEmail: Boolean(email),
      });
      if (!displayName || !email) {
        console.warn("coaching:booking-link-prefill-missing", {
          userId: user.id,
          missing: [
            !displayName ? "name" : null,
            !email ? "email" : null,
          ].filter(Boolean),
        });
      }
    }

    return json(
      {
        ok: true,
        // Keep `calComUrl` for backward compatibility — web Stripe path uses it.
        calComUrl: source === "appstore" ? iosBookingUrl ?? CAL_IOS_NO_PAYMENT_URL : CAL_PAID_URL,
        iosBookingUrl,
        sessionRowId,
      },
      200
    );
  } catch (e) {
    console.error("[record-coaching-purchase] unhandled", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
