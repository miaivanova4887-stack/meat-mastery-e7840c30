## Fix CMS Page Authoring + Internal Linking

### Problem

Lines 424–461 of `CmsLayoutBuilder.tsx` show the current "Add Block" flow: it asks users to name a block and manually define fields (label + type). This is a schema builder, not a content authoring tool. New pages get 0 blocks and no fast way to add content.

### Changes

#### 1. Replace schema builder with block template picker

**File: `src/components/cms/CmsLayoutBuilder.tsx**`

Replace lines 424–461 (the `showAddBlock` form) with a template grid. Define a `BLOCK_TEMPLATES` constant:

```text
BLOCK_TEMPLATES:
  rich_text      → fields: [{ key: "body", label: "Body", type: "text" }]
  title_body     → fields: [{ key: "title", ... "text" }, { key: "body", ... "text" }]
  cta_button     → fields: [{ key: "label", ... "text" }, { key: "link", ... "link" }]
  notice         → fields: [{ key: "title", ... "text" }, { key: "body", ... "text" }]
  image_block    → fields: [{ key: "src", ... "image_url" }, { key: "alt", ... "text" }]
  spacer         → fields: []
```

When tapped, each template immediately inserts a `LayoutBlock` with pre-configured fields, empty EN/FR content, and a `blockType` property. No form, no naming step.

Keep a small "Custom Block" button at the bottom that opens the existing schema form for power users.

Remove state: `newBlockName`, `newBlockFields`, `showAddBlock`. Replace with `showTemplatePicker` boolean. Keep `addFieldToNewBlock`, `updateNewBlockField`, `removeNewBlockField` for the custom block fallback.

#### 2. Add internal link picker for `type: "link"` fields

**File: `src/components/cms/CmsLayoutBuilder.tsx**`

In the field rendering section (lines 382–411), when `field.type === "link"`, render a `Select` dropdown above the manual URL input. The dropdown lists:

- All `APP_PAGES` (title + route)
- All custom pages from `layouts` (title + `/p/{slug}`)

Selecting a page sets the field value to its route path. The manual input remains as fallback for external URLs. Use the existing `Select` component from `@/components/ui/select`.

#### 3. Add `parent_slug` for page hierarchy

**Migration:** Add `parent_slug text` column to `page_layouts`.

**File: `src/components/cms/CmsLayoutBuilder.tsx**`

- In the "Create Page" form (lines 274–283), add an optional "Parent Page" `Select` listing existing custom pages.
- In the sidebar (lines 304–323), group custom pages: show parents first, indent children with `pl-4`.

**File: `src/components/cms/CmsPagesTab.tsx**`

- Sort/group `allPages` so children appear indented under their parent in the table.

#### 4. Add `blockType` to `LayoutBlock` interface

Add optional `blockType?: string` to the `LayoutBlock` interface (

**Add** `blockType` **to** `LayoutBlock`

Add optional `blockType?: string` to the `LayoutBlock` interface so inserted template blocks preserve their origin and can be edited/rendered consistently. Existing blocks without `blockType` must remain supported for backward compatibility.

## **5. Define hierarchy behavior**

Clarify whether `parent_slug` is:

- **organizational only** for sidebar/table nesting, or
- part of the actual route structure for custom pages