// supabase/functions/_shared/manualEntitlement.ts
//
// Manual (admin-granted) subscription tier lookup. Rows live in
// public.manual_entitlements and are managed by admins only. Used so a member
// can be granted Pro/Elite access without a Stripe or app-store subscription.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ManualTier = "pro" | "elite";

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[MANUAL-ENTITLEMENT] ${step}${d}`);
};

/**
 * Returns the manually granted tier for a user, or null when there is none
 * (or the lookup failed — callers treat null as "no manual grant").
 */
export async function getManualTier(userId: string): Promise<ManualTier | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !key) return null;

    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from("manual_entitlements")
      .select("tier, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      log("lookup failed", { err: error.message });
      return null;
    }
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      log("grant expired", { userId, expiresAt: data.expires_at });
      return null;
    }
    const tier = data.tier === "elite" ? "elite" : data.tier === "pro" ? "pro" : null;
    if (tier) log("grant active", { userId, tier });
    return tier;
  } catch (e) {
    log("ERROR unexpected", { err: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
