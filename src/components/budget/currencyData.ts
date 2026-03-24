export type CurrencyCode = "CAD" | "USD" | "GBP" | "AUD" | "NZD" | "EUR";

export interface CurrencyInfo {
  symbol: string;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  CAD: { symbol: "CA$", label: "🇨🇦 CAD" },
  USD: { symbol: "$", label: "🇺🇸 USD" },
  GBP: { symbol: "£", label: "🇬🇧 GBP" },
  AUD: { symbol: "A$", label: "🇦🇺 AUD" },
  NZD: { symbol: "NZ$", label: "🇳🇿 NZD" },
  EUR: { symbol: "€", label: "🇪🇺 EUR" },
};

const TIMEZONE_TO_CURRENCY: Record<string, CurrencyCode> = {
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
  "Australia/Sydney": "AUD",
  "Australia/Melbourne": "AUD",
  "Australia/Brisbane": "AUD",
  "Australia/Perth": "AUD",
  "Australia/Adelaide": "AUD",
  "Pacific/Auckland": "NZD",
  "Pacific/Chatham": "NZD",
};

export function detectCurrency(): CurrencyCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_CURRENCY[tz]) {
      return TIMEZONE_TO_CURRENCY[tz];
    }
    const lang = navigator.language || "";
    if (lang.startsWith("en-GB")) return "GBP";
    if (lang.startsWith("en-AU")) return "AUD";
    if (lang.startsWith("en-NZ")) return "NZD";
    if (lang.startsWith("en-CA") || lang.startsWith("fr-CA")) return "CAD";
    if (lang.startsWith("fr") || lang.startsWith("de") || lang.startsWith("es") || lang.startsWith("it") || lang.startsWith("nl")) return "EUR";
  } catch {}
  return "USD";
}
