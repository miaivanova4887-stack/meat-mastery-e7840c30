// Picks localized copy from a campaign step.
// Step shape supports two forms:
//   { title: "x", body: "y" }                         // legacy single-locale
//   { title: { en: "x", fr: "y" }, body: { en, fr } } // multilingual

export type LocalizedString = string | Record<string, string>;

export function pickLocalized(value: LocalizedString | undefined, locale: string): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const norm = normalizeLocale(locale);
  return value[norm] ?? value["en"] ?? Object.values(value)[0] ?? "";
}

export function normalizeLocale(locale: string | null | undefined): "en" | "fr" {
  if (!locale) return "en";
  return locale.toLowerCase().startsWith("fr") ? "fr" : "en";
}
