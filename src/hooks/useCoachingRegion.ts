import { useCallback, useEffect, useState } from "react";
import {
  COACHING_PRICING,
  DEFAULT_COACHING_COUNTRY,
  detectCoachingCountry,
  getCoachingOverride,
  getCoachingPricing,
  setCoachingOverride,
  type CoachingCountry,
  type CoachingPricing,
} from "@/lib/coachingRegion";

/**
 * Resolves the web/Android coaching region (US/CA) for display + checkout.
 * Honors a saved manual override, otherwise detects via IP/locale on mount.
 * iOS coaching does NOT use this — it reads StoreKit pricing directly.
 */
export function useCoachingRegion() {
  const [country, setCountryState] = useState<CoachingCountry>(
    () => getCoachingOverride() ?? DEFAULT_COACHING_COUNTRY
  );

  useEffect(() => {
    let active = true;
    // If the user already chose, keep it; otherwise auto-detect.
    if (getCoachingOverride()) return;
    detectCoachingCountry().then((c) => {
      if (active) setCountryState(c);
    });
    return () => {
      active = false;
    };
  }, []);

  const setCountry = useCallback((c: CoachingCountry) => {
    setCoachingOverride(c);
    setCountryState(c);
  }, []);

  const pricing: CoachingPricing = getCoachingPricing(country);

  return { country, setCountry, pricing, options: COACHING_PRICING };
}
