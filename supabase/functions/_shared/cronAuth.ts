// Shared authorization for cron-invoked dispatchers.
//
// Two accepted callers:
//   1. Service-role bearer token (manual/internal invocations, tests).
//   2. pg_cron, which sends `x-cron-secret` matching the token stored in
//      private.internal_config (never exposed to the client API).
//
// The DB lookup is cached per isolate to avoid a query on every tick.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cachedCronSecret: string | null = null;

async function loadCronSecret(): Promise<string | null> {
  if (cachedCronSecret) return cachedCronSecret;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return null;
  const admin = createClient(url, serviceKey, {
    db: { schema: "private" },
    auth: { persistSession: false },
  });
  const { data, error } = await admin
    .from("internal_config")
    .select("value")
    .eq("key", "cron_secret")
    .maybeSingle();
  if (error) {
    console.error("[cronAuth] cron_secret lookup failed", error.message);
    return null;
  }
  cachedCronSecret = (data?.value as string | undefined) ?? null;
  return cachedCronSecret;
}

/** True when the request comes from pg_cron or a service-role caller. */
export async function isCronAuthorized(req: Request): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (serviceKey && bearer === serviceKey) return true;

  const headerSecret = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!headerSecret) return false;
  const cronSecret = await loadCronSecret();
  return !!cronSecret && headerSecret === cronSecret;
}
