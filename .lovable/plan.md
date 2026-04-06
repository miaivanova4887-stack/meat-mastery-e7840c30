## Fix CMS Internal Linking — Plan

### Root Cause

The CMS has **two separate page storage systems** that don't talk to each other:

1. `**page_layouts` table** — used by Layout Builder to store block-based pages with EN/FR content
2. `**cms_pages` table** — used by `CmsPageView.tsx` (the `/p/:slug` route) to render published custom pages

When you create a custom page in Layout Builder, it saves to `page_layouts`. But when a visitor hits `/p/my-page`, `CmsPageView` queries `cms_pages` — which has nothing in it. Custom pages are invisible to end users.

The internal link picker already works correctly (it lists app pages + custom pages from `page_layouts`). The hierarchy support also works. The missing piece is **rendering**.

### Changes

#### 1. Fix `CmsPageView.tsx` to read from `page_layouts` and render blocks

**File: `src/pages/CmsPageView.tsx**`

Replace the current `cms_pages` query with a `page_layouts` query:

- Query `page_layouts` where `page_slug = slug` and `is_published = true`
- Read the `blocks` JSON array (which contains `LayoutBlock[]` with field content)
- Render each block based on its `blockType` using a simple block renderer

Add a `LayoutBlockRenderer` component that maps `blockType` to styled output:

- `rich_text` → renders body as paragraph text
- `title_body` → renders title as heading + body as paragraph
- `cta_button` → renders a styled button/link using the `link` field value
- `notice` → renders a notice card with title + body
- `image_block` → renders an `<img>` with alt text
- `spacer` → renders a `<div>` with fixed height

Use the current locale (from `i18n`) to pick `content[field.key].en` or `.fr`.

#### 2. Ensure the link picker includes all custom pages

**File: `src/components/cms/CmsLayoutBuilder.tsx**`

The `linkOptions` memo (line 153) already combines `APP_PAGES` + `customPages`. This works correctly — no change needed here.

#### 3. Ensure custom pages always show in sidebar and Pages tab

The sidebar (line 353) shows custom pages only when `customPages.length > 0`. The `customPages` memo (line 144) correctly filters `layouts` for non-app-page slugs. The Pages tab (`CmsPagesTab.tsx`) also queries `page_layouts` and shows all entries.

**No change needed** — both already work. The issue was only that `/p/:slug` couldn't render the pages.

### What stays unchanged

- Layout Builder block templates, save flow, sidebar, publish toggle
- Pages tab table view and hierarchy display
- `cms_pages` table (kept for backward compatibility with any drag-drop canvas pages)
- `page_layouts` table schema, RLS policies
- Internal link picker logic
- Parent-child hierarchy support

### Files to edit

1. `**src/pages/CmsPageView.tsx**` — rewrite to query `page_layouts` instead of `cms_pages`, add block renderer with locale support

- Query `page_layouts` by `page_slug = slug` and `is_published = true`.
- Use `maybeSingle()` or equivalent safe handling for missing pages.
- Treat `page_layouts` as the source of truth for block-based custom pages.
- For locale selection, use current locale first, then fall back to `en` if the localized field is empty.

For CTA blocks, prefer semantic links:

- internal links render with router navigation if possible,
- external links use normal anchors.