/**
 * Unified CMS page registry — single source of truth for app + custom pages.
 */

import { normalizeLayoutBlocks } from "./cmsLayout";

export interface CmsPageRecord {
  source: "app" | "custom";
  slug: string;
  route: string;
  title: string;
  /** Key used in content_blocks table (app pages only) */
  contentKey: string;
  /** page_layouts row id, if exists */
  pageLayoutId?: string;
  isPublished: boolean;
  parentSlug: string | null;
  blocks: any[];
  updatedAt: string | null;
}

export interface PageLayoutRow {
  id: string;
  page_slug: string;
  title: string;
  blocks: any[];
  is_published: boolean;
  parent_slug: string | null;
  created_at: string;
  updated_at: string;
}

export const APP_PAGES: { title: string; slug: string; route: string; contentKey: string }[] = [
  { title: "Navigation", slug: "nav", route: "/", contentKey: "nav" },
  { title: "Home", slug: "home", route: "/", contentKey: "home" },
  { title: "Authentication", slug: "auth", route: "/auth", contentKey: "auth" },
  { title: "Onboarding", slug: "onboarding", route: "/onboarding", contentKey: "onboarding" },
  { title: "Benefits", slug: "benefits", route: "/benefits", contentKey: "benefits" },
  { title: "Recipes", slug: "recipes", route: "/recipes", contentKey: "recipes" },
  { title: "Ketosis Timer", slug: "timer", route: "/timer", contentKey: "ketosis" },
  { title: "Meal Plan", slug: "meal-plan", route: "/meal-plan", contentKey: "mealPlan" },
  { title: "Ingredients", slug: "ingredients", route: "/ingredients", contentKey: "ingredients" },
  { title: "Exercise", slug: "exercise", route: "/exercise", contentKey: "exercise" },
  { title: "Cravings", slug: "cravings", route: "/cravings", contentKey: "cravings" },
  { title: "Sustain Results", slug: "sustain", route: "/sustain", contentKey: "sustain" },
  { title: "Myths Busted", slug: "myths", route: "/myths", contentKey: "myths" },
  { title: "Complete Guide", slug: "guide", route: "/guide", contentKey: "guide" },
  { title: "First 30 Days", slug: "getting-started", route: "/getting-started", contentKey: "gettingStarted" },
  { title: "Budget Eating", slug: "budget", route: "/budget", contentKey: "budget" },
  { title: "Athletic Performance", slug: "athletic", route: "/athletic", contentKey: "athletic" },
  { title: "Community", slug: "community", route: "/community", contentKey: "community" },
  { title: "Progress", slug: "progress", route: "/progress", contentKey: "progress" },
  { title: "News Feed", slug: "news", route: "/news", contentKey: "news" },
  { title: "Profile", slug: "profile", route: "/profile", contentKey: "profile" },
  { title: "Success Stories", slug: "stories", route: "/stories", contentKey: "stories" },
  { title: "Shopping Bag", slug: "shopping", route: "/shopping-bag", contentKey: "shopping" },
  { title: "Privacy Policy", slug: "privacy", route: "/privacy", contentKey: "privacy" },
  { title: "Terms of Service", slug: "terms", route: "/terms", contentKey: "terms" },
  { title: "Disclaimer", slug: "disclaimer", route: "/disclaimer", contentKey: "disclaimer" },
];

const APP_SLUG_SET = new Set(APP_PAGES.map(p => p.slug));

export function isAppPage(slug: string): boolean {
  return APP_SLUG_SET.has(slug);
}

export function buildPageRegistry(layouts: PageLayoutRow[]): CmsPageRecord[] {
  const pages: CmsPageRecord[] = [];

  // App pages
  for (const ap of APP_PAGES) {
    const layout = layouts.find(l => l.page_slug === ap.slug);
    pages.push({
      source: "app",
      slug: ap.slug,
      route: ap.route,
      title: ap.title,
      contentKey: ap.contentKey,
      pageLayoutId: layout?.id,
      isPublished: layout?.is_published ?? false,
      parentSlug: null,
      blocks: normalizeLayoutBlocks(layout?.blocks ?? [], ap.slug),
      updatedAt: layout?.updated_at ?? null,
    });
  }

  // Custom pages
  for (const l of layouts) {
    if (APP_SLUG_SET.has(l.page_slug)) continue;
    pages.push({
      source: "custom",
      slug: l.page_slug,
      route: `/p/${l.page_slug}`,
      title: l.title,
      contentKey: l.page_slug,
      pageLayoutId: l.id,
      isPublished: l.is_published,
      parentSlug: l.parent_slug || null,
      blocks: normalizeLayoutBlocks(l.blocks ?? [], l.page_slug),
      updatedAt: l.updated_at,
    });
  }

  return pages;
}

/** Map from contentKey (used in i18n flat keys) back to slug */
export function contentKeyToSlug(contentKey: string): string | undefined {
  const ap = APP_PAGES.find(p => p.contentKey === contentKey);
  return ap?.slug;
}

export function slugToContentKey(slug: string): string {
  const ap = APP_PAGES.find(p => p.slug === slug);
  return ap?.contentKey ?? slug;
}
