import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n/index";

interface ContentBlock {
  page: string;
  section: string;
  key: string;
  type: string;
  locale: string;
  value: string;
}

// Reconstruct a nested i18n key from page/section/key
// e.g. page='home', section='features', key='benefits' → 'home.features.benefits'
// e.g. page='home', section='general', key='title' → 'home.title'
function toI18nKey(page: string, section: string, key: string): string {
  if (section === "general") return `${page}.${key}`;
  return `${page}.${section}.${key}`;
}

// Build a nested object from dot-path and value
function setNested(obj: Record<string, any>, path: string, value: any) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  // Try to parse JSON arrays/objects
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) || typeof parsed === "object") {
      current[parts[parts.length - 1]] = parsed;
      return;
    }
  } catch {
    // not JSON, use as string
  }
  current[parts[parts.length - 1]] = value;
}

let overridesLoaded = false;
let loadPromise: Promise<void> | null = null;

export function useContentOverrides() {
  const [loaded, setLoaded] = useState(overridesLoaded);

  useEffect(() => {
    if (overridesLoaded) {
      setLoaded(true);
      return;
    }

    if (!loadPromise) {
      loadPromise = fetchAndApplyOverrides().then(() => {
        overridesLoaded = true;
      });
    }

    loadPromise.then(() => setLoaded(true));
  }, []);

  return { loaded };
}

async function fetchAndApplyOverrides() {
  try {
    const { data, error } = await (supabase as any)
      .from("content_blocks")
      .select("page, section, key, type, locale, value")
      .order("page");

    if (error || !data || data.length === 0) return;

    const byLocale: Record<string, Record<string, any>> = {};

    for (const block of data as ContentBlock[]) {
      if (!byLocale[block.locale]) byLocale[block.locale] = {};
      const i18nKey = toI18nKey(block.page, block.section, block.key);
      setNested(byLocale[block.locale], i18nKey, block.value);
    }

    // Merge overrides into i18n resources (deep merge, overrides win)
    for (const [locale, overrides] of Object.entries(byLocale)) {
      i18n.addResourceBundle(locale, "translation", overrides, true, true);
    }
    // Notify components to re-render with new resources
    i18n.emit("languageChanged", i18n.language);
  } catch (err) {
    console.warn("Failed to load content overrides:", err);
  }
}

// Force reload overrides (called after CMS edits)
export async function reloadContentOverrides() {
  overridesLoaded = false;
  loadPromise = null;
  await fetchAndApplyOverrides();
  overridesLoaded = true;
  // Trigger re-render in all components using useTranslation
  i18n.emit("languageChanged", i18n.language);
}
