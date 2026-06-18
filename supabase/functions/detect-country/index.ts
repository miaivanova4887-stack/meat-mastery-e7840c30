import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Best-effort IP geolocation for coaching-call regional pricing.
 * Returns { country: "<ISO-2>" }. Defaults to "US" on any failure so the
 * caller always has a usable value.
 */

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let country = "US";
  try {
    const ip = clientIp(req);
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      try {
        const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
          signal: ctrl.signal,
          headers: { "User-Agent": "carnivorex-detect-country/1.0" },
        });
        if (resp.ok) {
          const code = (await resp.text()).trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(code)) country = code;
        }
      } finally {
        clearTimeout(t);
      }
    }
  } catch (_e) {
    country = "US";
  }

  return new Response(JSON.stringify({ country }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
