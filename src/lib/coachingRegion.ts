/**
 * Single source of truth for the web/Android coaching-call regional pricing.
 *
 * Coaching on web/Android is purchased via Stripe Checkout (a web redirect),
 * which has NO access to the Google Play account country. So we determine the
 * region with a best-effort proxy:
 *   1. A saved manual override (user explicitly picked a region), else
 *   2. Server-side IP geolocation via the `detect-country` edge function, else
 *   3. The device locale region (Intl), else
 *   4. Default to US.
 *
 * iOS coaching uses RevenueCat/StoreKit and is completely separate — it never
 * imports this module.
 */

import { supabase } from "@/integrations/supabase/client";

export type CoachingCountry = "US" | "CA";

export interface CoachingPricing {
  country: CoachingCountry;
  currency: "USD" | "CAD";
  /** Amount in minor units (cents) — informational, kept in sync with Stripe. */
  amount: number;
  /** Display string for UI labels. */
  display: string;
  /** Human-readable region name for the override toggle. */
  label: string;
}

export const COACHING_PRICING: Record<CoachingCountry, CoachingPricing> = {
  US: {
    country: "US",
    currency: "USD",
    amount: 9999,
    display: "$99.99",
    label: "United States",
  },
  CA: {
    country: "CA",
    currency: "CAD",
    amount: 12999,
    display: "$129.99 CAD",
    label: "Canada",
  },
};

export const DEFAULT_COACHING_COUNTRY: CoachingCountry = "US";

const OVERRIDE_KEY = "coaching_region_override";

export function getCoachingPricing(country: CoachingCountry): CoachingPricing {
  return COACHING_PRICING[country] ?? COACHING_PRICING[DEFAULT_COACHING_COUNTRY];
}

/** Normalize an arbitrary ISO country code to a supported coaching region. */
export function normalizeCoachingCountry(raw?: string | null): CoachingCountry {
  return String(raw ?? "").toUpperCase() === "CA" ? "CA" : DEFAULT_COACHING_COUNTRY;
}

/** Read a previously saved manual override, if any. */
export function getCoachingOverride(): CoachingCountry | null {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    if (v === "US" || v === "CA") return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Persist (or clear) the user's manual region override. */
export function setCoachingOverride(country: CoachingCountry | null): void {
  try {
    if (country) localStorage.setItem(OVERRIDE_KEY, country);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** Device-locale fallback (e.g. en-CA → CA). */
function localeCountry(): CoachingCountry {
  try {
    const region =
      (Intl.DateTimeFormat().resolvedOptions() as { locale?: string }).locale ??
      (typeof navigator !== "undefined" ? navigator.language : "");
    if (/[-_]CA$/i.test(region)) return "CA";
  } catch {
    /* ignore */
  }
  return DEFAULT_COACHING_COUNTRY;
}

/**
 * Resolve the coaching region. Honors a saved override first; otherwise tries
 * server-side IP geolocation, then device locale, then defaults to US. Never
 * throws — always resolves to a supported region.
 */
export async function detectCoachingCountry(): Promise<CoachingCountry> {
  const override = getCoachingOverride();
  if (override) return override;

  try {
    const { data, error } = await supabase.functions.invoke("detect-country");
    if (!error && data?.country) {
      return normalizeCoachingCountry(data.country);
    }
  } catch {
    /* fall through to locale */
  }

  return localeCountry();
}
