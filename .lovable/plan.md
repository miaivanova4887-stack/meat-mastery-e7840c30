
Goal
- Make custom pages truly editable in CMS and make Parent Page use the full registry of existing pages.

What I found
- `CmsEditor.tsx` still keeps a mutable `activePage` object and manually re-syncs it after refresh. That makes cross-tab hydration fragile.
- `CmsPagesTab.tsx` hydrates settings via a state write during render instead of an effect.
- Both parent selectors (`CmsLayoutBuilder.tsx` create flow and `CmsPagesTab.tsx` settings) are built from `customPages` only, so app pages never appear.
- `CmsLayoutBuilder.tsx` can save `"__none__"` into `parent_slug`.
- The current UI already has custom-page editing logic, but zero-block custom pages still feel broken because the editor body becomes a passive empty state instead of a clear next step.
- Session replay confirms the Parent Page picker is only surfacing limited options instead of the full page set.

Implementation plan
1. Canonicalize page selection in `src/pages/CmsEditor.tsx`
   - Store `activeSlug` as the single source of truth.
   - Derive `activePage` from the shared `pages` registry on each render.
   - Preserve the selected page automatically after `refreshPages`.
   - After creating a custom page, auto-select it so Pages, Content, and Layout open the same record immediately.

2. Fix Parent Page options everywhere
   - In `src/components/cms/CmsLayoutBuilder.tsx`, build the create-page Parent Page dropdown from all `pages`, not only custom pages.
   - In `src/components/cms/CmsPagesTab.tsx`, do the same for Page Settings.
   - Exclude the current page from its own parent list.
   - Normalize the sentinel value so “No parent” saves `null`, never `"__none__"`.

3. Make Page Settings hydrate reliably
   - Move `CmsPagesTab` form initialization into `useEffect`.
   - Ensure selecting any custom page loads title, route, publish state, and parent into the settings panel immediately.
   - Keep parent behavior CMS-only grouping, not route nesting.

4. Make custom pages usable in Content
   - Keep custom content editing sourced from `activePage.blocks`.
   - Add a persistent page summary/header so the tab always hydrates with a real editor state.
   - Replace the passive empty state with actionable controls like “Open Layout Builder” and “Open Page Settings”.
   - Keep block-instance editing as the save model for repeated blocks.

5. Make grouping work with any parent page
   - Update list/grouping logic in Pages and Layout Builder to resolve `parent_slug` against the full page registry, so a custom page can be grouped under an app page or another custom page.
   - Keep this organizational only.

Files to update
- `src/pages/CmsEditor.tsx`
- `src/components/cms/CmsPagesTab.tsx`
- `src/components/cms/CmsLayoutBuilder.tsx`
- `src/components/cms/CmsContentEditor.tsx`
- `src/components/cms/cmsPages.ts` if shared parent/grouping helpers are needed

Technical note
- No database migration is needed. This is a CMS state/model and UI hydration fix.

Acceptance criteria
- Parent Page lists every existing page, not just custom pages.
- “No parent” stores no parent value.
- Creating or selecting a custom page opens usable state in Pages, Content, and Layout.
- A custom page with no blocks shows a clear empty state with next-step actions, not a blank editor.
- Switching tabs keeps the same page selected and hydrated from the latest data.
