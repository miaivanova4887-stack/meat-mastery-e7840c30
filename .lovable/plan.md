
Goal: make custom pages a real, hydrated editor target across Pages, Content, and Layout. A visible row/title is not enough.

What’s actually broken
- CMS page state is fragmented: each tab fetches/builds pages differently, and only a loose slug is shared.
- App page definitions are duplicated and inconsistent across tabs (`mealPlan` vs `meal-plan`, `gettingStarted` vs `getting-started`, etc.), so page resolution is unreliable.
- `CmsPagesTab` is only a table/actions view; it does not hydrate a selected page into a settings editor.
- `CmsContentEditor` synthesizes custom-page fields from `page_layouts.blocks`, but keys them by `page|section|field`. That collapses duplicate blocks and leaves zero-block pages with a blank body.
- `CmsLayoutBuilder` can load blocks, but it does not treat page metadata/settings + empty state as first-class editor state.

Implementation plan

1. Create one shared CMS page model
- Add a shared helper/config used by all CMS tabs.
- Normalize every page into one shape:
  - `source: "app" | "custom"`
  - `slug`
  - `route`
  - `title`
  - `contentKey` for app-page `content_blocks`
  - `layout` / `pageLayoutId`
  - `isPublished`
  - `parentSlug`
- Build all sidebars, tables, and link pickers from this single registry.

2. Lift page selection into `CmsEditor`
- Replace “shared slug only” with one shared active page record/identity.
- Fetch `page_layouts` once in the CMS shell and pass `pages`, `activePage`, `onSelectPage`, and `refreshPages` to all tabs.
- This makes every tab hydrate from the same resolved page, not its own lookup rules.

3. Turn Pages into a real metadata/settings editor
- Keep the page list/table, but make row selection drive the shared active page.
- Add a right-side editor panel for the selected page:
  - title
  - slug/path
  - type
  - publish state
  - parent grouping if custom
- Custom pages save back to `page_layouts`.
- App pages get a read-only settings summary plus layout status.
- If no page is selected, show a clear placeholder.

4. Fix Content tab hydration for custom pages
- Stop keying custom-page edits by section name only.
- Use block-instance keys instead, e.g. `page|blockId|fieldKey|locale`, so repeated block types hydrate/save correctly.
- Render a page summary/settings card at the top so the editor never appears “empty” without context.
- If a custom page has no editable fields yet, show:
  `This page has no editable content yet. Create layout/content or open page settings.`
- Keep app-page content editing on `content_blocks`, but resolve through the shared `contentKey`.

5. Fix Layout Builder hydration and empty states
- Hydrate directly from the shared active page record.
- For custom pages, use `page_layouts.blocks` as the source of truth.
- Show page metadata/settings summary in the builder header/body.
- If there are zero blocks, show an explicit empty-state card plus “Add Block”, not a silent blank editor area.
- Keep preview routing driven by the shared page model.

6. Unify internal page pickers
- Make all link pickers read from the same shared page registry.
- This ensures app pages, custom pages, and future child pages appear consistently everywhere.

7. Keep hierarchy secondary
- Do not expand hierarchy behavior until core hydration is solid.
- Keep `parent_slug` as CMS-only organizational metadata for now.
- No route nesting.

Files to update
- `src/pages/CmsEditor.tsx`
- `src/components/cms/CmsPagesTab.tsx`
- `src/components/cms/CmsContentEditor.tsx`
- `src/components/cms/CmsLayoutBuilder.tsx`
- Add one shared CMS page config/helper module for normalized page definitions

Technical notes
- No database migration is needed for this fix; `parent_slug` already exists.
- The most important fix is block-instance hydration in Content. Without that, custom pages with repeated blocks cannot ever load/edit reliably.
- The shared page model should map route slugs and content namespaces so app/custom pages behave consistently across tabs.

Acceptance criteria
- Selecting a custom page in Pages opens a usable metadata/settings editor.
- Selecting the same custom page in Content shows editable fields or the explicit empty-state message.
- Selecting the same custom page in Layout shows saved blocks or the explicit empty-state message.
- Switching tabs keeps the same page selected.
- A custom page with multiple similar blocks hydrates and saves each block independently.
- Internal page pickers list app + custom pages from the same source.
