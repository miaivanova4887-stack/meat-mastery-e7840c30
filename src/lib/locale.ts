export type SupportedLocale = "en" | "fr";

/**
 * Normalize any locale string (including regional variants like "fr-CA",
 * "en-US", "FR_ca") to one of the supported app locales.
 * Defaults to "en".
 */
export function normalizeLocale(input?: string | null): SupportedLocale {
  return (input ?? "").toLowerCase().startsWith("fr") ? "fr" : "en";
}
