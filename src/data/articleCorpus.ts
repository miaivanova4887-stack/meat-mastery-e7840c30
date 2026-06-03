/**
 * Shared corpus of dismissible article-style content blocks.
 *
 * Each entry is plain data (no JSX factories). `CorpusItemRenderer` knows how
 * to render each `ContentKind`. Used by `useArticleSlots` to swap a dismissed
 * article for a thematically related one.
 */

export type ContentKind =
  // ContentSection-style blocks (Athletic, Guide, Budget, GettingStarted, Myths)
  | {
      kind: "section";
      sectionType: "overview" | "key_points" | "tips" | "data";
      titleKey: string;
      titlePrefix?: string;
      questionKey?: string;
      itemsKey?: string;
      dataRowsKey?: string;
      bodyKey?: string;
    }
  // Icon card (Benefits / Cravings / Sustain)
  | {
      kind: "iconCard";
      iconName: string;
      ns: "benefits" | "cravings" | "sustain";
      itemKey: string;
      link?: string;
    }
  // Success Stories
  | {
      kind: "story";
      story: {
        name: string;
        duration: string;
        lost: string;
        quote: string;
        highlight: string;
        q: string;
      };
    };

export type ArticleCorpusItem = {
  id: string;
  theme: string;
  page: string;
  /** When true, item is gated by sex and only included if it matches. */
  sex?: "male" | "female";
  content: ContentKind;
};

// ---------- Benefits ----------
const benefits: ArticleCorpusItem[] = [
  ["inflammation", "Flame"],
  ["autophagy", "Sparkles"],
  ["clarity", "Brain"],
  ["fatloss", "Scale"],
  ["gut", "Shield"],
  ["energy", "BatteryCharging"],
].map(([id, iconName]) => ({
  id: `benefits-${id}`,
  theme: "benefits",
  page: "benefits",
  content: { kind: "iconCard", iconName, ns: "benefits", itemKey: id },
}));

benefits.push({
  id: "benefits-hormones_f",
  theme: "benefits",
  page: "benefits",
  sex: "female",
  content: { kind: "iconCard", iconName: "Heart", ns: "benefits", itemKey: "hormones_f" },
});
benefits.push({
  id: "benefits-testosterone",
  theme: "benefits",
  page: "benefits",
  sex: "male",
  content: { kind: "iconCard", iconName: "Zap", ns: "benefits", itemKey: "testosterone" },
});
benefits.push({
  id: "benefits-lean_muscle",
  theme: "benefits",
  page: "benefits",
  sex: "male",
  content: { kind: "iconCard", iconName: "Shield", ns: "benefits", itemKey: "lean_muscle" },
});
for (const [id, iconName] of [
  ["clean", "Leaf"],
  ["glow", "Eye"],
  ["no_counting", "Scale"],
  ["sports", "Zap"],
  ["stress", "Shield"],
] as const) {
  benefits.push({
    id: `benefits-${id}`,
    theme: "benefits",
    page: "benefits",
    content: { kind: "iconCard", iconName, ns: "benefits", itemKey: id },
  });
}

// ---------- Cravings ----------
const cravings: ArticleCorpusItem[] = (
  [
    ["fat", "Utensils"],
    ["hydrate", "Droplets"],
    ["coffee", "Coffee"],
    ["sleep", "Moon"],
    ["withdrawal", "Brain"],
    ["temptation", "ShieldCheck"],
  ] as const
).map(([id, iconName]) => ({
  id: `cravings-${id}`,
  theme: "cravings",
  page: "cravings",
  content: { kind: "iconCard", iconName, ns: "cravings", itemKey: id },
}));

// ---------- Sustain ----------
const sustain: ArticleCorpusItem[] = (
  [
    ["goals", "Target", "/progress"],
    ["prep", "Calendar", "/meal-plan"],
    ["rotate", "RefreshCw", "/ingredients"],
    ["community", "Users", "/community"],
    ["track", "BarChart3", "/progress"],
    ["lifestyle", "BookHeart", "/guide"],
  ] as const
).map(([id, iconName, link]) => ({
  id: `sustain-${id}`,
  theme: "sustain",
  page: "sustain",
  content: { kind: "iconCard", iconName, ns: "sustain", itemKey: id, link },
}));

// ---------- Athletic ----------
const athletic: ArticleCorpusItem[] = [
  { id: "athletic-adapt", section: "key_points", base: "athletic.adapt" },
  { id: "athletic-pre", section: "tips", base: "athletic.pre" },
  { id: "athletic-post", section: "key_points", base: "athletic.post" },
  { id: "athletic-endurance", section: "key_points", base: "athletic.endurance" },
  {
    id: "athletic-strength",
    section: "data",
    base: "athletic.strength",
    rowsKey: "athletic.strength.rows",
  },
  { id: "athletic-benefits", section: "key_points", base: "athletic.benefits" },
].map((s) => ({
  id: s.id,
  theme: "athletic",
  page: "athletic",
  content: {
    kind: "section",
    sectionType: s.section as "key_points" | "tips" | "data",
    titleKey: `${s.base}.title`,
    questionKey: `${s.base}.q`,
    itemsKey: s.section === "data" ? undefined : `${s.base}.items`,
    dataRowsKey: (s as { rowsKey?: string }).rowsKey,
  },
}));

// ---------- Guide ----------
const guide: ArticleCorpusItem[] = [
  { id: "guide-what", section: "overview", base: "guide.whatIs", body: "guide.whatIs.content" },
  { id: "guide-eat", section: "key_points", base: "guide.foodsToEat" },
  { id: "guide-avoid", section: "key_points", base: "guide.foodsToAvoid" },
  { id: "guide-why", section: "key_points", base: "guide.whyTry" },
  { id: "guide-start", section: "key_points", base: "guide.gettingStarted" },
  {
    id: "guide-electrolytes",
    section: "data",
    base: "guide.electrolytes",
    rowsKey: "guide.electrolytes.rows",
  },
].map((s) => ({
  id: s.id,
  theme: "guide",
  page: "guide",
  content: {
    kind: "section",
    sectionType: s.section as "overview" | "key_points" | "data",
    titleKey: `${s.base}.title`,
    questionKey: `${s.base}.q`,
    itemsKey:
      s.section === "key_points" || s.section === "tips" ? `${s.base}.items` : undefined,
    bodyKey: (s as { body?: string }).body,
    dataRowsKey: (s as { rowsKey?: string }).rowsKey,
  },
}));

// ---------- Budget ----------
const budget: ArticleCorpusItem[] = [
  { id: "budget-cuts", section: "key_points", base: "budget.cuts" },
  { id: "budget-shopping", section: "tips", base: "budget.shopping" },
  { id: "budget-bulk", section: "key_points", base: "budget.bulk" },
  { id: "budget-free", section: "tips", base: "budget.free" },
  { id: "budget-prep", section: "key_points", base: "budget.prep" },
].map((s) => ({
  id: s.id,
  theme: "budget",
  page: "budget",
  content: {
    kind: "section",
    sectionType: s.section as "key_points" | "tips",
    titleKey: `${s.base}.title`,
    questionKey: `${s.base}.q`,
    itemsKey: `${s.base}.items`,
  },
}));

// ---------- Getting Started ----------
const started: ArticleCorpusItem[] = [
  { id: "started-w1", base: "gettingStarted.week1" },
  { id: "started-w2", base: "gettingStarted.week2" },
  { id: "started-w3", base: "gettingStarted.week3" },
  { id: "started-w4", base: "gettingStarted.week4" },
  { id: "started-tips", base: "gettingStarted.tips", isTips: true },
].map((s) => ({
  id: s.id,
  theme: "started",
  page: "started",
  content: {
    kind: "section",
    sectionType: (s as { isTips?: boolean }).isTips ? "tips" : "key_points",
    titleKey: `${s.base}.title`,
    questionKey: `${s.base}.q`,
    itemsKey: `${s.base}.items`,
  },
}));

// ---------- Myths (8 items, index in i18n array) ----------
const myths: ArticleCorpusItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `myths-${i}`,
  theme: "myths",
  page: "myths",
  content: {
    kind: "section" as const,
    sectionType: "overview" as const,
    titleKey: `myths.items.${i}.title`,
    titlePrefix: `${i + 1}. `,
    questionKey: "myths.feedbackQ",
    bodyKey: `myths.items.${i}.content`,
  },
}));

// ---------- Stories (static EN-only) ----------
const storyData = [
  {
    id: "mike",
    name: "Mike, 42",
    duration: "8 months",
    lost: "65 lbs",
    quote:
      "I reversed my pre-diabetes and got off blood pressure medication. My doctor couldn't believe the blood work. Energy through the roof.",
    highlight: "Reversed pre-diabetes",
    q: "Did this story inspire you?",
  },
  {
    id: "sarah",
    name: "Sarah, 35",
    duration: "6 months",
    lost: "40 lbs",
    quote:
      "Lifelong eczema — gone in 3 weeks. I'd tried every cream and diet. Turns out it was plants causing the inflammation all along.",
    highlight: "Cleared chronic eczema",
    q: "Can you relate to Sarah's experience?",
  },
  {
    id: "james",
    name: "James, 28",
    duration: "1 year",
    lost: "30 lbs",
    quote:
      "I was skinny-fat with zero energy. Now I deadlift 405 lbs and have visible abs for the first time. Carnivore changed my body composition completely.",
    highlight: "Gained muscle, lost fat",
    q: "Is body recomposition your goal too?",
  },
  {
    id: "linda",
    name: "Linda, 55",
    duration: "4 months",
    lost: "25 lbs",
    quote:
      "Joint pain from rheumatoid arthritis made daily life miserable. Two weeks into carnivore, the pain started fading. Now I walk 5 miles daily.",
    highlight: "Joint pain eliminated",
    q: "Do you deal with joint issues?",
  },
  {
    id: "carlos",
    name: "Carlos, 38",
    duration: "10 months",
    lost: "80 lbs",
    quote:
      "I was 310 lbs and felt hopeless. Carnivore was the first 'diet' that didn't feel like a diet. I eat until full and the weight melts off.",
    highlight: "Lost 80 lbs effortlessly",
    q: "Would you like more weight loss stories?",
  },
  {
    id: "emma",
    name: "Emma, 31",
    duration: "5 months",
    lost: "20 lbs",
    quote:
      "Chronic bloating, IBS, and anxiety — all resolved. I sleep better, think clearer, and my mood is stable for the first time in my adult life.",
    highlight: "IBS & anxiety resolved",
    q: "Have you experienced similar improvements?",
  },
];

const stories: ArticleCorpusItem[] = storyData.map((s) => ({
  id: `stories-${s.id}`,
  theme: "stories",
  page: "stories",
  content: {
    kind: "story",
    story: {
      name: s.name,
      duration: s.duration,
      lost: s.lost,
      quote: s.quote,
      highlight: s.highlight,
      q: s.q,
    },
  },
}));

export const ARTICLE_CORPUS: ArticleCorpusItem[] = [
  ...benefits,
  ...cravings,
  ...sustain,
  ...athletic,
  ...guide,
  ...budget,
  ...started,
  ...myths,
  ...stories,
];

const BY_ID = new Map(ARTICLE_CORPUS.map((i) => [i.id, i]));

export function getCorpusItem(id: string): ArticleCorpusItem | undefined {
  return BY_ID.get(id);
}

export function getPageItems(page: string): ArticleCorpusItem[] {
  return ARTICLE_CORPUS.filter((i) => i.page === page);
}
