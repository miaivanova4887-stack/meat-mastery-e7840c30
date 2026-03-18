export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "ZAR" | "INR" | "BRL";

export interface CurrencyInfo {
  symbol: string;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { symbol: "$", label: "🇺🇸 USD" },
  EUR: { symbol: "€", label: "🇪🇺 EUR" },
  GBP: { symbol: "£", label: "🇬🇧 GBP" },
  CAD: { symbol: "CA$", label: "🇨🇦 CAD" },
  AUD: { symbol: "A$", label: "🇦🇺 AUD" },
  ZAR: { symbol: "R", label: "🇿🇦 ZAR" },
  INR: { symbol: "₹", label: "🇮🇳 INR" },
  BRL: { symbol: "R$", label: "🇧🇷 BRL" },
};

/**
 * Map timezones to currencies for auto-detection.
 * Falls back to USD if no match.
 */
const TIMEZONE_TO_CURRENCY: Record<string, CurrencyCode> = {
  // Americas
  "America/New_York": "USD",
  "America/Chicago": "USD",
  "America/Denver": "USD",
  "America/Los_Angeles": "USD",
  "America/Phoenix": "USD",
  "America/Anchorage": "USD",
  "Pacific/Honolulu": "USD",
  "America/Toronto": "CAD",
  "America/Vancouver": "CAD",
  "America/Edmonton": "CAD",
  "America/Winnipeg": "CAD",
  "America/Halifax": "CAD",
  "America/St_Johns": "CAD",
  "America/Sao_Paulo": "BRL",
  "America/Fortaleza": "BRL",
  "America/Recife": "BRL",
  "America/Manaus": "BRL",
  // Europe
  "Europe/London": "GBP",
  "Europe/Paris": "EUR",
  "Europe/Berlin": "EUR",
  "Europe/Rome": "EUR",
  "Europe/Madrid": "EUR",
  "Europe/Amsterdam": "EUR",
  "Europe/Brussels": "EUR",
  "Europe/Vienna": "EUR",
  "Europe/Dublin": "EUR",
  "Europe/Lisbon": "EUR",
  "Europe/Helsinki": "EUR",
  "Europe/Athens": "EUR",
  // Africa
  "Africa/Johannesburg": "ZAR",
  "Africa/Cape_Town": "ZAR",
  // Asia-Pacific
  "Asia/Kolkata": "INR",
  "Asia/Calcutta": "INR",
  "Asia/Mumbai": "INR",
  "Australia/Sydney": "AUD",
  "Australia/Melbourne": "AUD",
  "Australia/Brisbane": "AUD",
  "Australia/Perth": "AUD",
  "Australia/Adelaide": "AUD",
};

export function detectCurrency(): CurrencyCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_CURRENCY[tz]) {
      return TIMEZONE_TO_CURRENCY[tz];
    }
    // Fallback: check language
    const lang = navigator.language || "";
    if (lang.startsWith("en-GB")) return "GBP";
    if (lang.startsWith("en-AU")) return "AUD";
    if (lang.startsWith("en-CA") || lang.startsWith("fr-CA")) return "CAD";
    if (lang.startsWith("en-ZA") || lang.startsWith("af")) return "ZAR";
    if (lang.startsWith("hi") || lang.startsWith("en-IN")) return "INR";
    if (lang.startsWith("pt-BR")) return "BRL";
    if (lang.startsWith("fr") || lang.startsWith("de") || lang.startsWith("es") || lang.startsWith("it") || lang.startsWith("nl")) return "EUR";
  } catch {}
  return "USD";
}
