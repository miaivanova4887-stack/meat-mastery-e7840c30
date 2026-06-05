// supabase/functions/cal-webhook/index.ts
//
// Cal.com webhook receiver — canonical source of scheduled booking data.
// Validates HMAC signature using CAL_WEBHOOK_SECRET, matches attendee email
// to a profiles row, and upserts public.coaching_sessions on external_booking_id.
//
// Handles: BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cal-signature-256, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Accept either raw hex or "sha256=hex"
  const provided = signature.replace(/^sha256=/, "").trim().toLowerCase();
  return provided === hex;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("CAL_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[cal-webhook] CAL_WEBHOOK_SECRET not set");
    return json({ error: "Server misconfigured" }, 500);
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get("x-cal-signature-256") ??
    req.headers.get("X-Cal-Signature-256") ??
    req.headers.get("x-cal-signature");

  const valid = await verifySignature(rawBody, signature, secret);
  if (!valid) {
    console.warn("[cal-webhook] signature invalid");
    return json({ error: "Invalid signature" }, 401);
  }

  let event: any;
  try { event = JSON.parse(rawBody); } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const triggerEvent: string = event?.triggerEvent ?? event?.event ?? "";
  const payload = event?.payload ?? event?.data ?? event;
  const bookingUid: string | undefined = payload?.uid ?? payload?.bookingUid ?? payload?.booking?.uid;
  const startTime: string | undefined = payload?.startTime ?? payload?.start_time ?? payload?.start;
  const timezone: string | undefined = payload?.organizer?.timeZone ?? payload?.attendees?.[0]?.timeZone ?? payload?.timeZone;
  const attendee = Array.isArray(payload?.attendees) ? payload.attendees[0] : payload?.attendee;
  const attendeeEmail: string | undefined = attendee?.email ?? payload?.responses?.email?.value;
  const attendeeName: string | undefined = attendee?.name ?? payload?.responses?.name?.value;
  const bookingUrl: string | undefined =
    payload?.metadata?.videoCallUrl ?? payload?.location ?? payload?.bookingUrl ?? payload?.uid
      ? `https://cal.com/booking/${payload?.uid}`
      : undefined;

  if (!triggerEvent || !bookingUid) {
    console.warn("[cal-webhook] missing triggerEvent or bookingUid", { triggerEvent });
    return json({ ok: true, skipped: "missing-fields" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Match user. Prefer our embedded metadata.user_id (set by
  // record-coaching-purchase when building the Cal.com URL) since the
  // attendee email at booking time can differ from the app login email
  // (e.g. Apple private relay accounts). Fall back to session_row_id, then
  // attendee email, then most-recent pending session for that email.
  const metaUserId: string | undefined =
    payload?.metadata?.user_id ?? payload?.bookingFieldsResponses?.user_id;
  const metaSessionRowId: string | undefined =
    payload?.metadata?.session_row_id ?? payload?.bookingFieldsResponses?.session_row_id;

  let userId: string | null = null;
  let preMatchedSessionId: string | null = null;

  // 1) Metadata user_id (most reliable)
  if (metaUserId && /^[0-9a-f-]{36}$/i.test(metaUserId)) {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .eq("id", metaUserId)
      .maybeSingle();
    if (prof?.id) userId = prof.id;
  }

  // 2) Metadata session_row_id — also resolves user
  if (!userId && metaSessionRowId && /^[0-9a-f-]{36}$/i.test(metaSessionRowId)) {
    const { data: row } = await admin
      .from("coaching_sessions")
      .select("id, user_id")
      .eq("id", metaSessionRowId)
      .maybeSingle();
    if (row?.user_id) {
      userId = row.user_id;
      preMatchedSessionId = row.id;
    }
  }

  // 3) Attendee email → profiles.email
  if (!userId && attendeeEmail) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", attendeeEmail)
      .maybeSingle();
    userId = profile?.id ?? null;
  }

  if (!userId) {
    console.warn("[cal-webhook] no user match", {
      attendeeEmail,
      metaUserId,
      metaSessionRowId,
    });
    return json({ ok: true, skipped: "no-user-match" });
  }

  const isCancel = triggerEvent === "BOOKING_CANCELLED";
  const status = isCancel ? "cancelled" : "scheduled";

  // Try update by external_booking_id; if no row, find latest pending row for user and attach.
  const { data: existing } = await admin
    .from("coaching_sessions")
    .select("id")
    .eq("external_booking_id", bookingUid)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    scheduled_at: startTime ?? null,
    timezone: timezone ?? null,
    status,
    booking_url: bookingUrl ?? null,
    external_booking_id: bookingUid,
    attendee_email: attendeeEmail ?? null,
    attendee_name: attendeeName ?? null,
    user_id: userId,
  };

  if (existing?.id) {
    const { error } = await admin.from("coaching_sessions").update(patch).eq("id", existing.id);
    if (error) {
      console.error("[cal-webhook] update failed", error);
      return json({ error: "DB update failed" }, 500);
    }
  } else if (!isCancel) {
    // Attach to most recent pending session for this user, else insert new row.
    const { data: pending } = await admin
      .from("coaching_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .is("external_booking_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.id) {
      const { error } = await admin.from("coaching_sessions").update(patch).eq("id", pending.id);
      if (error) {
        console.error("[cal-webhook] attach failed", error);
        return json({ error: "DB update failed" }, 500);
      }
    } else {
      const { error } = await admin.from("coaching_sessions").insert({
        ...patch,
        session_type: "scheduled",
        session_month: (startTime ?? new Date().toISOString()).slice(0, 7),
      });
      if (error) {
        console.error("[cal-webhook] insert failed", error);
        return json({ error: "DB insert failed" }, 500);
      }
    }
  }

  console.info("[cal-webhook] ok", { triggerEvent, bookingUid, userId, status });
  return json({ ok: true });
});
