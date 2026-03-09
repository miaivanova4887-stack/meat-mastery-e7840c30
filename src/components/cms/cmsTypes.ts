export type ComponentCategory = 
  | "basic" 
  | "container" 
  | "data" 
  | "form" 
  | "navigation" 
  | "media"
  | "interactive";

export interface CmsComponentDefinition {
  type: string;
  label: string;
  category: ComponentCategory;
  icon: string; // lucide icon name
  defaultProps: Record<string, unknown>;
  defaultWidth: number;
  defaultHeight: number;
}

export interface PlacedComponent {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Record<string, unknown>;
}

export const COMPONENT_LIBRARY: CmsComponentDefinition[] = [
  // Basic
  { type: "text", label: "Text", category: "basic", icon: "Type", defaultProps: { content: "Text block" }, defaultWidth: 200, defaultHeight: 40 },
  { type: "heading", label: "Heading", category: "basic", icon: "Heading", defaultProps: { content: "Heading", level: 2 }, defaultWidth: 300, defaultHeight: 50 },
  { type: "button", label: "Button", category: "basic", icon: "RectangleHorizontal", defaultProps: { text: "Click me", variant: "primary" }, defaultWidth: 140, defaultHeight: 44 },
  { type: "image", label: "Image", category: "basic", icon: "Image", defaultProps: { src: "", alt: "Image" }, defaultWidth: 200, defaultHeight: 150 },
  { type: "divider", label: "Divider", category: "basic", icon: "Minus", defaultProps: {}, defaultWidth: 300, defaultHeight: 4 },
  { type: "spacer", label: "Spacer", category: "basic", icon: "MoveVertical", defaultProps: { height: 32 }, defaultWidth: 300, defaultHeight: 32 },

  // Container
  { type: "card", label: "Card", category: "container", icon: "Square", defaultProps: { title: "Card Title" }, defaultWidth: 300, defaultHeight: 200 },
  { type: "panel", label: "Panel", category: "container", icon: "PanelTop", defaultProps: {}, defaultWidth: 400, defaultHeight: 250 },
  { type: "tabs", label: "Tabs", category: "container", icon: "LayoutList", defaultProps: { tabs: ["Tab 1", "Tab 2"] }, defaultWidth: 400, defaultHeight: 200 },
  { type: "accordion", label: "Accordion", category: "container", icon: "ChevronsUpDown", defaultProps: { items: ["Section 1", "Section 2"] }, defaultWidth: 350, defaultHeight: 120 },

  // Data Display
  { type: "table", label: "Table", category: "data", icon: "Table", defaultProps: { rows: 3, cols: 3 }, defaultWidth: 400, defaultHeight: 180 },
  { type: "list", label: "List", category: "data", icon: "List", defaultProps: { items: ["Item 1", "Item 2", "Item 3"] }, defaultWidth: 250, defaultHeight: 120 },
  { type: "badge", label: "Badge", category: "data", icon: "Tag", defaultProps: { text: "Badge" }, defaultWidth: 80, defaultHeight: 28 },
  { type: "tooltip", label: "Tooltip", category: "data", icon: "MessageSquare", defaultProps: { text: "Hover me" }, defaultWidth: 100, defaultHeight: 36 },

  // Form
  { type: "input", label: "Text Input", category: "form", icon: "TextCursorInput", defaultProps: { placeholder: "Enter text...", label: "Label" }, defaultWidth: 280, defaultHeight: 68 },
  { type: "textarea", label: "Textarea", category: "form", icon: "AlignLeft", defaultProps: { placeholder: "Enter text..." }, defaultWidth: 280, defaultHeight: 100 },
  { type: "select", label: "Select", category: "form", icon: "ChevronDown", defaultProps: { options: ["Option 1", "Option 2"] }, defaultWidth: 280, defaultHeight: 44 },
  { type: "checkbox", label: "Checkbox", category: "form", icon: "CheckSquare", defaultProps: { label: "Check me" }, defaultWidth: 180, defaultHeight: 28 },
  { type: "toggle", label: "Toggle", category: "form", icon: "ToggleLeft", defaultProps: { label: "Toggle" }, defaultWidth: 180, defaultHeight: 28 },

  // Navigation
  { type: "navbar", label: "Menu Bar", category: "navigation", icon: "Menu", defaultProps: { items: ["Home", "About", "Contact"] }, defaultWidth: 500, defaultHeight: 56 },
  { type: "breadcrumb", label: "Breadcrumb", category: "navigation", icon: "ChevronRight", defaultProps: { items: ["Home", "Page"] }, defaultWidth: 250, defaultHeight: 28 },
  { type: "pagination", label: "Pagination", category: "navigation", icon: "MoreHorizontal", defaultProps: { pages: 5 }, defaultWidth: 300, defaultHeight: 40 },

  // Media
  { type: "carousel", label: "Carousel", category: "media", icon: "GalleryHorizontal", defaultProps: {}, defaultWidth: 400, defaultHeight: 250 },
  { type: "video", label: "Video", category: "media", icon: "Play", defaultProps: { src: "" }, defaultWidth: 400, defaultHeight: 250 },

  // Interactive — App Feature Widgets
  { type: "progress_milestone", label: "Progress Milestone", category: "interactive", icon: "Trophy", defaultProps: { icon: "🏆", title: "Goal Reached: Weight", desc: "You hit your target of 80kg!", color: "emerald" }, defaultWidth: 350, defaultHeight: 90 },
  { type: "milestone_streak", label: "Streak Counter", category: "interactive", icon: "Flame", defaultProps: { days: 7, label: "Day Logging Streak" }, defaultWidth: 200, defaultHeight: 80 },
  { type: "favorite_button", label: "Favorite Button", category: "interactive", icon: "Heart", defaultProps: { label: "Add to Favorites", filled: false }, defaultWidth: 180, defaultHeight: 44 },
  { type: "share_card", label: "Invite / Share", category: "interactive", icon: "Share2", defaultProps: { title: "Invite a Friend", description: "Share the carnivore lifestyle" }, defaultWidth: 350, defaultHeight: 140 },
  { type: "feed_card", label: "Feed Article", category: "interactive", icon: "Newspaper", defaultProps: { category: "Science", title: "Article Title", summary: "Article summary text goes here…", color: "blue" }, defaultWidth: 350, defaultHeight: 120 },
  { type: "stat_card", label: "Stat Card", category: "interactive", icon: "TrendingUp", defaultProps: { icon: "🔥", label: "Calories", value: "2,400", unit: "kcal" }, defaultWidth: 160, defaultHeight: 90 },
  { type: "goal_progress", label: "Goal Progress", category: "interactive", icon: "Target", defaultProps: { label: "Daily Protein", current: 120, target: 180, unit: "g" }, defaultWidth: 280, defaultHeight: 80 },
];

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  basic: "Basic",
  container: "Containers",
  data: "Data Display",
  form: "Form",
  navigation: "Navigation",
  media: "Media",
  interactive: "Interactive Widgets",
};
