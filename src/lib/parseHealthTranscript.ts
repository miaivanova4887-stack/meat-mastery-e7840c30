interface ParsedEntry {
  category: string;
  metric: string;
  value: number;
  unit: string;
  notes?: string;
}

interface ParsedResult {
  summary: string;
  entries: ParsedEntry[];
}

interface FoodItem {
  keywords: string[];
  /** Human-readable name shown to the user (e.g. "sirloin steak"). */
  displayName: string;
  refGrams: number;
  cal: number;
  protein: number;
  fat: number;
  /**
   * Logical grouping used to suppress generic fallbacks when a specific cut
   * of the same animal already matched. For example, if the user says
   * "200g sirloin steak" we match "sirloin" (group="beef") and then skip the
   * generic "steak" fallback because it is also group="beef" and flagged
   * approximated. Groups are purely for this dedupe; they don't affect the
   * `category` field on the emitted entries.
   */
  group?: string;
  /**
   * True for generic fallback entries ("steak", "chicken", "cheese", etc.)
   * where the matched keyword is ambiguous and macros are ballpark. The
   * notes field gets an "(approx.)" marker so the UI can hint that the user
   * may want to refine the input.
   */
  approximated?: boolean;
}

/*
 * Ordered most-specific first: within a category, specific cuts are matched
 * before the generic fallback so "sirloin steak" doesn't fall through to the
 * ribeye entry.
 *
 * `displayName` shown to the user. `approximated` marks generic fallbacks so
 * the UI can hint that macros are ballpark. Macros per refGrams cooked weight,
 * rounded from USDA FoodData Central + common cut averages.
 */
const FOOD_DB: FoodItem[] = [
  // --- Beef cuts (specific first) ---
  { keywords: ["ribeye", "rib eye", "rib-eye"],            displayName: "ribeye steak",   refGrams: 300, cal: 900, protein: 75, fat: 65, group: "beef" },
  { keywords: ["sirloin", "top sirloin"],                   displayName: "sirloin steak",  refGrams: 300, cal: 630, protein: 78, fat: 33, group: "beef" },
  { keywords: ["filet mignon", "filet", "tenderloin"],     displayName: "tenderloin steak", refGrams: 300, cal: 660, protein: 78, fat: 36, group: "beef" },
  { keywords: ["new york strip", "ny strip", "strip steak", "striploin"], displayName: "strip steak", refGrams: 300, cal: 720, protein: 78, fat: 42, group: "beef" },
  { keywords: ["t-bone", "tbone", "t bone", "porterhouse"], displayName: "T-bone steak",  refGrams: 300, cal: 780, protein: 78, fat: 48, group: "beef" },
  { keywords: ["flank steak", "flank"],                     displayName: "flank steak",    refGrams: 300, cal: 600, protein: 84, fat: 27, group: "beef" },
  { keywords: ["skirt steak", "skirt"],                     displayName: "skirt steak",    refGrams: 300, cal: 720, protein: 75, fat: 45, group: "beef" },
  { keywords: ["chuck steak", "chuck"],                     displayName: "chuck steak",    refGrams: 300, cal: 750, protein: 75, fat: 48, group: "beef" },
  { keywords: ["brisket"],                                   displayName: "brisket",       refGrams: 200, cal: 600, protein: 48, fat: 44, group: "beef" },
  { keywords: ["ground beef", "mince", "minced beef", "beef mince"], displayName: "ground beef", refGrams: 200, cal: 500, protein: 40, fat: 35, group: "beef" },
  { keywords: ["burger", "hamburger", "patty"],            displayName: "beef burger",    refGrams: 150, cal: 400, protein: 30, fat: 30, group: "beef" },
  // Generic beef fallbacks last so they only match when no specific cut was
  // said. "beef" covers phrases like "grass fed beef 200gr" where the user
  // names the protein without a specific cut; "steak" covers the same for
  // steak-shaped meat.
  { keywords: ["beef"],                                      displayName: "beef (approx.)",  refGrams: 200, cal: 500, protein: 50, fat: 35, approximated: true, group: "beef" },
  { keywords: ["steak", "beef steak"],                       displayName: "steak (approx.)", refGrams: 300, cal: 750, protein: 78, fat: 42, approximated: true, group: "beef" },

  // --- Pork ---
  { keywords: ["pork chop"],                                 displayName: "pork chop",      refGrams: 200, cal: 500, protein: 50, fat: 30, group: "pork" },
  { keywords: ["pork tenderloin"],                           displayName: "pork tenderloin", refGrams: 200, cal: 290, protein: 52, fat: 8, group: "pork" },
  { keywords: ["pork belly"],                                displayName: "pork belly",     refGrams: 150, cal: 790, protein: 14, fat: 80, group: "pork" },
  { keywords: ["pork"],                                       displayName: "pork (approx.)", refGrams: 200, cal: 500, protein: 50, fat: 30, approximated: true, group: "pork" },
  { keywords: ["bacon"],                                      displayName: "bacon",         refGrams: 100, cal: 540, protein: 37, fat: 42, group: "pork" },
  { keywords: ["sausage", "sausages"],                       displayName: "sausage",       refGrams: 100, cal: 300, protein: 18, fat: 25 },
  { keywords: ["ham"],                                        displayName: "ham",           refGrams: 100, cal: 145, protein: 21, fat: 6, group: "pork" },

  // --- Poultry ---
  { keywords: ["chicken breast"],                             displayName: "chicken breast", refGrams: 200, cal: 330, protein: 62, fat: 7, group: "chicken" },
  { keywords: ["chicken thigh", "chicken thighs"],           displayName: "chicken thigh", refGrams: 200, cal: 440, protein: 52, fat: 25, group: "chicken" },
  { keywords: ["chicken wing", "chicken wings", "wings"],    displayName: "chicken wings", refGrams: 150, cal: 330, protein: 30, fat: 22, group: "chicken" },
  { keywords: ["chicken"],                                    displayName: "chicken (approx.)", refGrams: 200, cal: 360, protein: 55, fat: 14, approximated: true, group: "chicken" },
  { keywords: ["turkey breast"],                              displayName: "turkey breast", refGrams: 200, cal: 300, protein: 64, fat: 2, group: "turkey" },
  { keywords: ["turkey"],                                     displayName: "turkey (approx.)", refGrams: 200, cal: 330, protein: 58, fat: 10, approximated: true, group: "turkey" },
  { keywords: ["duck breast", "duck"],                        displayName: "duck breast",   refGrams: 200, cal: 400, protein: 44, fat: 24 },

  // --- Lamb ---
  { keywords: ["lamb chop", "lamb chops"],                   displayName: "lamb chop",     refGrams: 200, cal: 500, protein: 45, fat: 35, group: "lamb" },
  { keywords: ["lamb leg", "leg of lamb"],                   displayName: "lamb leg",      refGrams: 200, cal: 460, protein: 50, fat: 28, group: "lamb" },
  { keywords: ["lamb"],                                       displayName: "lamb (approx.)", refGrams: 200, cal: 500, protein: 45, fat: 35, approximated: true, group: "lamb" },

  // --- Organ meats ---
  { keywords: ["liver", "beef liver"],                       displayName: "beef liver",    refGrams: 100, cal: 135, protein: 21, fat: 4 },
  { keywords: ["chicken liver"],                              displayName: "chicken liver", refGrams: 100, cal: 165, protein: 24, fat: 7 },
  { keywords: ["heart", "beef heart"],                        displayName: "beef heart",   refGrams: 100, cal: 110, protein: 17, fat: 4 },
  { keywords: ["kidney", "beef kidney"],                      displayName: "kidney",       refGrams: 100, cal: 105, protein: 17, fat: 3 },

  // --- Seafood ---
  { keywords: ["salmon"],                                     displayName: "salmon",        refGrams: 200, cal: 400, protein: 40, fat: 25 },
  { keywords: ["tuna"],                                       displayName: "tuna",          refGrams: 150, cal: 180, protein: 40, fat: 1 },
  { keywords: ["cod"],                                        displayName: "cod",           refGrams: 200, cal: 180, protein: 40, fat: 2 },
  { keywords: ["mackerel"],                                   displayName: "mackerel",      refGrams: 150, cal: 300, protein: 28, fat: 20 },
  { keywords: ["trout"],                                      displayName: "trout",         refGrams: 200, cal: 310, protein: 44, fat: 14 },
  { keywords: ["shrimp", "prawns"],                           displayName: "shrimp",        refGrams: 150, cal: 130, protein: 28, fat: 2 },
  { keywords: ["sardines", "sardine"],                        displayName: "sardines",      refGrams: 100, cal: 210, protein: 25, fat: 11 },
  { keywords: ["oysters", "oyster"],                          displayName: "oysters",       refGrams: 100, cal: 80,  protein: 9,  fat: 3 },

  // --- Dairy & fats ---
  { keywords: ["butter", "ghee"],                             displayName: "butter/ghee",   refGrams: 20,  cal: 143, protein: 0,  fat: 16 },
  { keywords: ["cream cheese"],                               displayName: "cream cheese", refGrams: 30,  cal: 100, protein: 2,  fat: 10 },
  { keywords: ["heavy cream", "cream"],                       displayName: "heavy cream",   refGrams: 30,  cal: 100, protein: 1,  fat: 10 },
  { keywords: ["cheddar"],                                    displayName: "cheddar",       refGrams: 50,  cal: 200, protein: 12, fat: 16, group: "cheese" },
  { keywords: ["cheese"],                                     displayName: "cheese (approx.)", refGrams: 50, cal: 200, protein: 12, fat: 16, approximated: true, group: "cheese" },

  // --- Misc ---
  { keywords: ["bone broth", "broth"],                        displayName: "bone broth",    refGrams: 250, cal: 40,  protein: 8,  fat: 1 },
];

// Egg is count-based (not grams)
const EGG = { keywords: ["egg", "eggs"], refCount: 1, cal: 70, protein: 6, fat: 5 };

const MOOD_WORDS: Record<string, number> = {
  amazing: 5, fantastic: 5, excellent: 5,
  great: 4, awesome: 4,
  good: 3, fine: 3, decent: 3,
  okay: 2, ok: 2, alright: 2, meh: 2, so_so: 2,
  bad: 1, poor: 1, low: 1, rough: 1,
  terrible: 0, awful: 0, horrible: 0,
};

const SYMPTOM_SEVERITY: Record<string, number> = {
  severe: 4, intense: 4, extreme: 4,
  moderate: 3, noticeable: 3, quite: 3,
  mild: 2, slight: 2, little: 2, minor: 2,
  barely: 1, faint: 1, tiny: 1,
};

function extractNumber(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function extractTwoNumbers(text: string): [number, number] | null {
  const m = [...text.matchAll(/(\d+(?:\.\d+)?)/g)];
  if (m.length >= 2) return [parseFloat(m[0][1]), parseFloat(m[1][1])];
  return null;
}

/**
 * Whole-word keyword search. Returns the first index where `keyword` appears
 * as a standalone token in `haystack`, or -1 if not found.
 *
 * We use this instead of `String.prototype.indexOf` everywhere that would
 * otherwise false-positive on substrings (e.g. matching `"tea"` inside
 * `"steak"`, `"ham"` inside `"shame"`, or `"cod"` inside `"code"`). A
 * character counts as a word character if it's alphanumeric; everything else
 * (spaces, punctuation, digits when the keyword is text) is a boundary.
 *
 * Multi-word keywords like `"bone broth"` work fine too because the check
 * only runs against the first and last characters of the match.
 */
function findWord(haystack: string, keyword: string, fromIndex = 0): number {
  if (!keyword) return -1;
  const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/i.test(c);
  let searchFrom = fromIndex;
  while (searchFrom <= haystack.length - keyword.length) {
    const idx = haystack.indexOf(keyword, searchFrom);
    if (idx === -1) return -1;
    const before = idx > 0 ? haystack[idx - 1] : undefined;
    const after = idx + keyword.length < haystack.length ? haystack[idx + keyword.length] : undefined;
    // For text keywords we want no letter/digit directly adjacent. (This also
    // means "2eggs" still matches because the digit is considered a word
    // char of the same class only when the keyword itself is alphanumeric at
    // that edge — but all our food keywords start/end with a letter, so a
    // digit next to them is an acceptable boundary.)
    const boundaryBefore = !isWordChar(before) || !/[a-z]/i.test(keyword[0]);
    const boundaryAfter = !isWordChar(after) || !/[a-z]/i.test(keyword[keyword.length - 1]);
    if (boundaryBefore && boundaryAfter) return idx;
    searchFrom = idx + 1;
  }
  return -1;
}

/**
 * Convert a numeric literal + optional unit token into a canonical
 * { value, unit } pair. Weight units collapse to grams, fluid units to ml.
 * Returns null for unknown units (shouldn't happen since the caller's
 * regex already whitelists units).
 */
function canonicaliseQuantity(val: number, rawUnit: string): { value: number; unit: string } | null {
  const u = rawUnit.toLowerCase();
  if (u === "oz" || u === "ounce" || u === "ounces") return { value: val * 28.35, unit: "g" };
  if (u === "kg" || u === "kilogram" || u === "kilograms") return { value: val * 1000, unit: "g" };
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return { value: val * 453.6, unit: "g" };
  if (u === "g" || u === "gr" || u === "gram" || u === "grams" || u === "") return { value: val, unit: "g" };
  if (u === "ml" || u === "milliliter" || u === "milliliters" || u === "millilitre" || u === "millilitres") return { value: val, unit: "ml" };
  if (u === "l" || u === "liter" || u === "liters" || u === "litre" || u === "litres") return { value: val * 1000, unit: "ml" };
  // Household servings ("piece", "slice", "tablespoon", …) aren't a weight
  // or volume on their own — they're a count that scales the food's default
  // refGrams. Signal that by returning unit="serving".
  if (isHouseholdUnit(u)) return { value: val, unit: "serving" };
  return null;
}

// Shared numeric+unit regex. Accepts weight (g/oz/kg/lb + long forms) and
// fluid (ml/l + long forms) units, plus household servings that scale the
// food's default `refGrams` by a count ("one piece of cheese" → 50g,
// "two slices of bacon" → 200g). "gr" is included as the EU/Russian
// shorthand. Longer alternatives come first so "grams" doesn't get chopped
// to "gr". "g"/"l" are the short forms that must be last.
//
// The household unit group (pieces/slices/etc) ends with "?:of\s+"? so that
// "one piece of cheese" and "one piece cheese" both parse the same way.
const HOUSEHOLD_UNIT_RE =
  "pieces?|slices?|sticks?|tablespoons?|tbsps?|teaspoons?|tsps?|" +
  "scoops?|servings?|portions?|handfuls?|chunks?|cubes?|wedges?|" +
  "strips?|rashers?|fillets?|filets?|patt(?:y|ies)|cans?|jars?|" +
  "bowls?|plates?";
const QTY_TOKEN = new RegExp(
  "(\\d+(?:\\.\\d+)?)\\s*" +
    // Group 2: weight/volume unit (optional).
    "(ml|milliliters?|millilitres?|liters?|litres?|grams?|kilograms?|kg|pounds?|lbs?|ounces?|oz|gr|g|l|" +
    // or a household serving unit.
    HOUSEHOLD_UNIT_RE +
    ")?\\b",
  "gi",
);

/** True when `u` is one of the household serving words. */
function isHouseholdUnit(u: string): boolean {
  return new RegExp(`^(?:${HOUSEHOLD_UNIT_RE})$`, "i").test(u);
}

/**
 * Locate the clause window around a keyword. We treat commas, "and", "plus",
 * "with", and "then" as clause boundaries so that e.g. in
 *   "300g ribeye, 2 eggs, and 30g butter"
 * the quantity search for "butter" starts AFTER the last "and"/comma rather
 * than scooping up the ribeye's 300g from earlier in the sentence.
 *
 * Returns the [start, end) half-open span of the clause in `text`.
 */
function clauseBoundsAround(text: string, keywordIndex: number, keywordLength: number): [number, number] {
  // Regex for a clause boundary. Treated as a *token*, so "and" inside
  // "handsome" doesn't qualify (we'd match " and " with surrounding spaces,
  // but easier to use word-boundary regex with lookahead).
  const boundaryRe = /,|\bplus\b|\band\b|\bwith\b|\bthen\b/gi;
  // Find the latest boundary strictly before the keyword.
  let start = 0;
  boundaryRe.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = boundaryRe.exec(text)) !== null) {
    if (m.index >= keywordIndex) break;
    start = m.index + m[0].length;
  }
  // Find the earliest boundary at or after the keyword ends.
  const kwEnd = keywordIndex + keywordLength;
  boundaryRe.lastIndex = kwEnd;
  const next = boundaryRe.exec(text);
  const end = next ? next.index : text.length;
  return [start, end];
}

function findQuantityNear(text: string, keywordIndex: number, keywordLength: number): { value: number; unit: string } | null {
  // Restrict the search to the current clause so we don't pull numbers that
  // belong to a sibling food item (e.g. don't let "butter" inherit the
  // "300g" from "300g ribeye, ..., 30g butter").
  const [clauseStart, clauseEnd] = clauseBoundsAround(text, keywordIndex, keywordLength);
  const kwEnd = keywordIndex + keywordLength;
  // Collect every numeric literal in the clause, each tagged with its
  // distance to the keyword and whether it sits before or after. A number
  // that overlaps the keyword span itself (shouldn't happen, but guard)
  // is skipped.
  type Candidate = { value: number; unit: string; distance: number; hasUnit: boolean; position: "before" | "after" };
  const candidates: Candidate[] = [];
  QTY_TOKEN.lastIndex = clauseStart;
  let m: RegExpExecArray | null;
  while ((m = QTY_TOKEN.exec(text)) !== null) {
    if (m.index >= clauseEnd) break;
    const numStart = m.index;
    const numEnd = m.index + m[0].length;
    // Skip a number that overlaps the keyword itself.
    if (numEnd > keywordIndex && numStart < kwEnd) continue;
    const qty = canonicaliseQuantity(parseFloat(m[1]), (m[2] || ""));
    if (!qty) continue;
    const position: "before" | "after" = numEnd <= keywordIndex ? "before" : "after";
    const distance = position === "before" ? keywordIndex - numEnd : numStart - kwEnd;
    candidates.push({ value: qty.value, unit: qty.unit, distance, hasUnit: !!m[2], position });
  }
  if (candidates.length === 0) return null;

  // Preference order:
  //   1. A number with an explicit weight/volume unit wins over a bare
  //      number ("30g" beats "2" for "2 eggs, 30g butter" if both are in
  //      range).
  //   2. Numbers immediately before the keyword win over ones after
  //      (English order is "300g ribeye", not "ribeye 300g").
  //   3. Closer wins over farther.
  candidates.sort((a, b) => {
    if (a.hasUnit !== b.hasUnit) return a.hasUnit ? -1 : 1;
    if (a.position !== b.position) return a.position === "before" ? -1 : 1;
    return a.distance - b.distance;
  });
  const best = candidates[0];
  return { value: best.value, unit: best.unit };
}

/**
 * Replace spoken word-numbers with digits so downstream regexes can find
 * them. Examples:
 *   "half a litre of water"   → "0.5 litre of water"
 *   "two eggs"                → "2 eggs"
 *   "a cup of coffee"         → "240ml coffee"   (handled via CUP pre-sub)
 *   "one and a half kilos"    → "1.5 kilos"
 *
 * Only applied once up front. Order matters: longer phrases first so
 * "one and a half" beats "one".
 */
/**
 * Resolve English number words up to 9,999 into a digit string. Returns
 * null if the phrase isn't a recognisable number word. Handles:
 *   "one hundred"                      → "100"
 *   "five hundred"                     → "500"
 *   "two hundred fifty"                → "250"
 *   "two hundred and fifty"            → "250"
 *   "one thousand" / "a thousand"      → "1000"
 *   "two thousand five hundred"        → "2500"
 *   "twenty five" / "twenty-five"      → "25"
 *   "fifteen"                          → "15"
 */
const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const TEENS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/**
 * Collapse multi-word number phrases in the transcript into digit strings,
 * in place. Runs BEFORE the per-word single-digit substitutions so that
 * "five hundred grams" becomes "500 grams" rather than "5 hundred grams"
 * (which used to parse as just `5` and caused 500gr logs to estimate as 1g).
 *
 * We scan left-to-right, greedily consuming as many number tokens as still
 * form a valid English compound. Anything non-numeric is passed through.
 */
function collapseCompoundNumbers(input: string): string {
  // Split on runs of whitespace/hyphens so "twenty-five" tokenises cleanly
  // but we can rejoin non-number text with single spaces without caring about
  // the original whitespace (we preserve punctuation tokens separately).
  // Tokenise: words, numbers, or single non-word chars.
  const tokens = input.match(/[a-z]+|\d+(?:\.\d+)?|[^a-z\d\s]+|\s+/gi) || [];
  const out: string[] = [];
  const isNumberWord = (t: string) =>
    t in ONES || t in TEENS || t in TENS || t === "hundred" || t === "thousand" || t === "a" || t === "an";

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const lowTok = tok.toLowerCase();
    // Try to start a number phrase here. Require the first token to be an
    // actual number word (not bare "a"/"and") — except "a hundred"/
    // "a thousand" which we allow as a leading "a".
    const startsPhrase =
      lowTok in ONES || lowTok in TEENS || lowTok in TENS ||
      ((lowTok === "a" || lowTok === "an") && looksLikeMagnitudeAhead(tokens, i));
    if (!startsPhrase) {
      out.push(tok);
      i++;
      continue;
    }

    // Greedy consume. We track:
    //   total      — finalised sum (accumulates after each "hundred"/"thousand")
    //   current    — partial sum being built before the next magnitude word
    //   consumed   — how many tokens we've absorbed (incl. whitespace/hyphens)
    //   lastWasNumberWord — so we don't accidentally absorb a trailing "and"
    //                        that belongs to the next clause.
    // Model: `total` is the finalised accumulator; `part` is the small
    // number currently being built (0–99) that a following "hundred" or
    // "thousand" will scale. Each magnitude word folds `part` into `total`
    // with the appropriate multiplier and resets `part` to 0.
    let total = 0;
    let part = 0;
    let sawOnes = false; // prevent "twenty five six" — once ones are set, stop.
    let sawTens = false; // prevent "twenty thirty".
    let sawTeens = false; // teens exclude ones & tens.
    let produced = false;
    let j = i;

    const reset = () => { part = 0; sawOnes = false; sawTens = false; sawTeens = false; };

    while (j < tokens.length) {
      const t = tokens[j];
      const lt = t.toLowerCase();
      // Skip whitespace / hyphens between number words.
      if (/^\s+$/.test(t) || t === "-") {
        j++;
        continue;
      }
      // "and" is allowed between hundreds and the remainder
      // (e.g. "two hundred and fifty"), but only mid-phrase.
      if (lt === "and" && produced) {
        j++;
        continue;
      }
      if ((lt === "a" || lt === "an") && !produced) {
        // Only absorb a leading "a"/"an" if immediately followed by
        // hundred/thousand. Otherwise bail.
        if (!looksLikeMagnitudeAhead(tokens, j)) break;
        part = 1;
        produced = true;
        j++;
        continue;
      }
      if (lt in ONES) {
        if (sawOnes || sawTeens) break;
        // Ones are only valid alone or after a tens word ("twenty five").
        if (!sawTens && part !== 0) break;
        part += ONES[lt];
        sawOnes = true;
        produced = true;
        j++;
        continue;
      }
      if (lt in TEENS) {
        if (sawOnes || sawTens || sawTeens) break;
        part += TEENS[lt];
        sawTeens = true;
        produced = true;
        j++;
        continue;
      }
      if (lt in TENS) {
        if (sawOnes || sawTens || sawTeens) break;
        part += TENS[lt];
        sawTens = true;
        produced = true;
        j++;
        continue;
      }
      if (lt === "hundred") {
        if (part === 0) part = 1; // "hundred" on its own → 100
        total += part * 100;
        reset();
        produced = true;
        j++;
        continue;
      }
      if (lt === "thousand") {
        // Fold whatever is in `part` and whatever hundreds are already in
        // `total` from the current thousand-group into the thousands.
        // e.g. "two thousand" → total=0, part=2 → total=2000.
        // e.g. "twelve hundred" is rare; we treat it as 1200 via the
        // hundred branch above, then a following thousand would be weird,
        // so we guard by grouping: (existing total + part) * 1000.
        const group = total + part;
        total = (group === 0 ? 1 : group) * 1000;
        reset();
        produced = true;
        j++;
        continue;
      }
      // Non-number token — end of phrase.
      break;
    }

    if (!produced) {
      out.push(tok);
      i++;
      continue;
    }

    // Finalise: add whatever tens/ones are still sitting in `part`.
    total += part;
    out.push(String(total));
    // Re-emit a single space so the number stays separated from whatever
    // token follows (otherwise "500grams" could merge with the next word).
    // Only if the following token isn't already whitespace.
    if (j < tokens.length && !/^\s+$/.test(tokens[j])) {
      out.push(" ");
    }
    i = j;
  }
  return out.join("");
}

/** Peek past whitespace/hyphens from position i+1 for "hundred"|"thousand". */
function looksLikeMagnitudeAhead(tokens: string[], i: number): boolean {
  for (let k = i + 1; k < tokens.length; k++) {
    const t = tokens[k];
    if (/^\s+$/.test(t) || t === "-") continue;
    const lt = t.toLowerCase();
    return lt === "hundred" || lt === "thousand";
  }
  return false;
}

function normaliseWordNumbers(input: string): string {
  // First collapse multi-word number phrases ("five hundred" → "500") so
  // that simple single-word substitutions below don't clobber them.
  let s = collapseCompoundNumbers(input);
  // Then fold "point N" / "point N N" into a decimal literal. We run this
  // after collapseCompoundNumbers so "point five" is already "point 5",
  // then becomes "0.5". Also fix a bare leading ".5" (voice transcripts
  // occasionally drop the leading zero) by inserting a 0.
  s = s.replace(/\bpoint\s+(\d)(?:\s+(\d))?(?:\s+(\d))?\b/g, (_m, a, b, c) => {
    const frac = [a, b, c].filter(Boolean).join("");
    return `0.${frac}`;
  });
  s = s.replace(/(^|[^\d.])\.(\d)/g, "$10.$2");
  // IMPORTANT: order matters. Compound phrases that include an article/unit
  // must run before simple "half" → "0.5" (which would otherwise leave a
  // dangling "a" in the middle of "half a litre" → "0.5 a litre").
  const pairs: Array<[RegExp, string]> = [
    // --- Compound + unit phrases (run FIRST) ---
    // "half a litre" → "500ml" directly, skipping the messy middle.
    // Also "half of a litre" (a voice transcript variant we've actually
    // seen) and "half of the litre" for safety.
    [/\bhalf (?:of )?(?:a |the )?(liter|litre|l)\b/g, "500ml"],
    [/\ba half (?:of )?(?:a |the )?(liter|litre|l)\b/g, "500ml"],
    [/\bhalf (?:a |the )?kilo(gram)?\b/g, "500g"],
    [/\bhalf (?:a |the )?kg\b/g, "500g"],
    [/\bhalf (?:a |the )?pound\b/g, "227g"],
    [/\bhalf (?:a |the )?cup\b/g, "120ml"],
    [/\bhalf (?:a |the )?glass\b/g, "120ml"],
    [/\bquarter (of (?:a |the )?)?(liter|litre|l)\b/g, "250ml"],
    [/\bquarter (of (?:a |the )?)?kilo(gram)?\b/g, "250g"],
    // "a cup" / "a glass" (no leading number) → default serving
    [/\ba cup\b/g, "240ml"],
    [/\bone cup\b/g, "240ml"],
    [/\ba glass\b/g, "240ml"],
    [/\bone glass\b/g, "240ml"],
    // "a liter/litre" without a number → "1 litre"
    [/\ba (liter|litre|l)\b/g, "1 $1"],
    // --- Compound number words ---
    // Note: pure digit-word phrases like "five hundred", "twenty five",
    // "two thousand five hundred" are already resolved to digits by
    // collapseCompoundNumbers() upstream; the substitutions below only
    // need to handle fractional phrases and leftover single words.
    [/\b1 and a half\b/g, "1.5"],
    [/\b2 and a half\b/g, "2.5"],
    [/\b3 and a half\b/g, "3.5"],
    // --- Standalone fractions ---
    [/\bhalf\b/g, "0.5"],
    [/\bquarter\b/g, "0.25"],
    [/\bthree quarters?\b/g, "0.75"],
    // --- Whole numbers ---
    [/\bzero\b/g, "0"],
    [/\bone\b/g, "1"],
    [/\btwo\b/g, "2"],
    [/\bthree\b/g, "3"],
    [/\bfour\b/g, "4"],
    [/\bfive\b/g, "5"],
    [/\bsix\b/g, "6"],
    [/\bseven\b/g, "7"],
    [/\beight\b/g, "8"],
    [/\bnine\b/g, "9"],
    [/\bten\b/g, "10"],
    [/\beleven\b/g, "11"],
    [/\btwelve\b/g, "12"],
  ];
  for (const [re, rep] of pairs) s = s.replace(re, rep);
  return s;
}

export function parseHealthTranscript(transcript: string): ParsedResult {
  const entries: ParsedEntry[] = [];
  // Normalise: strip common provenance/modifier phrases that users say but
  // shouldn't prevent a keyword match. "grass fed beef" should match "beef";
  // "pasture raised chicken" should match "chicken"; etc. We just blank the
  // modifier out (keeping a space) rather than removing chars so that any
  // character-offset logic downstream stays stable-ish. Then convert spoken
  // number words to digits so findQuantityNear's numeric regex picks them up.
  const lower = normaliseWordNumbers(
    transcript
      .toLowerCase()
      .trim()
      .replace(/\b(grass[- ]fed|grass fed|pasture[- ]raised|pasture raised|free[- ]range|free range|organic|wild[- ]caught|wild caught|100%)\b/g, " ")
  );
  const matched = new Set<string>();
  // Character spans in the transcript already "claimed" by a prior match.
  // A later, more generic keyword whose position overlaps an existing span
  // is skipped (so "sirloin steak" doesn't double-count as sirloin + steak).
  const matchedSpans: Array<[number, number]> = [];
  const overlapsExisting = (start: number, end: number) =>
    matchedSpans.some(([s, e]) => start < e && end > s);
  // Groups already claimed by a specific match. Used to suppress generic
  // approximated fallbacks (e.g. skip "steak" if "sirloin" already matched,
  // even when the word "steak" appears separately in the sentence).
  const matchedGroups = new Set<string>();

  // --- Food matching ---
  for (const food of FOOD_DB) {
    // Suppress the generic fallback if any specific cut from the same group
    // already matched. Non-approximated items always go through so we can
    // correctly log multiple specific cuts in the same category.
    if (food.approximated && food.group && matchedGroups.has(food.group)) continue;
    for (const kw of food.keywords) {
      // Whole-word match so "tea" doesn't fire on "steak", "ham" on "shame",
      // "cod" on "code", etc. findWord handles multi-word keywords too.
      const idx = findWord(lower, kw);
      if (idx === -1) continue;
      if (matched.has(kw)) continue;
      if (overlapsExisting(idx, idx + kw.length)) continue;

      matched.add(kw);
      matchedSpans.push([idx, idx + kw.length]);
      if (food.group && !food.approximated) matchedGroups.add(food.group);
      const qty = findQuantityNear(lower, idx, kw.length);
      // Resolve the effective weight in grams:
      //   - no quantity found          → one default serving (refGrams)
      //   - household count ("serving") → count × refGrams (so "one piece
      //     of cheese" = 50g, "two slices of bacon" = 200g)
      //   - explicit weight/volume     → use the value directly
      const grams =
        !qty
          ? food.refGrams
          : qty.unit === "serving"
            ? qty.value * food.refGrams
            : qty.value;
      const scale = grams / food.refGrams;

      // Note text shows the resolved food name + quantity. Generic fallbacks
      // already carry "(approx.)" in their displayName so the user knows the
      // macros are ballpark; no extra suffix needed.
      // Use the user's spoken unit in the note when it's volumetric (ml),
      // otherwise fall back to grams. This makes "500ml bone broth" show up
      // as "500ml bone broth" rather than "500g bone broth".
      const qtyLabel = qty?.unit === "ml" ? `${Math.round(grams)}ml` : `${Math.round(grams)}g`;
      const note = `${qtyLabel} ${food.displayName}`;

      entries.push({ category: "diet_trends", metric: "calories", value: Math.round(food.cal * scale), unit: "kcal", notes: note });
      entries.push({ category: "diet_trends", metric: "protein", value: Math.round(food.protein * scale), unit: "g", notes: note });
      entries.push({ category: "diet_trends", metric: "fat", value: Math.round(food.fat * scale), unit: "g", notes: note });
      break; // one match per food item
    }
  }

  // --- Eggs (count-based) ---
  const eggMatch = lower.match(/(\d+)\s*eggs?/);
  if (eggMatch) {
    const count = parseInt(eggMatch[1], 10) || 1;
    entries.push({ category: "diet_trends", metric: "calories", value: EGG.cal * count, unit: "kcal", notes: `${count} egg(s)` });
    entries.push({ category: "diet_trends", metric: "protein", value: EGG.protein * count, unit: "g", notes: `${count} egg(s)` });
    entries.push({ category: "diet_trends", metric: "fat", value: EGG.fat * count, unit: "g", notes: `${count} egg(s)` });
  } else if (!matched.has("egg") && (findWord(lower, "egg") !== -1 || findWord(lower, "eggs") !== -1)) {
    // "eggs" without a count → assume 2
    entries.push({ category: "diet_trends", metric: "calories", value: 140, unit: "kcal", notes: "2 egg(s)" });
    entries.push({ category: "diet_trends", metric: "protein", value: 12, unit: "g", notes: "2 egg(s)" });
    entries.push({ category: "diet_trends", metric: "fat", value: 10, unit: "g", notes: "2 egg(s)" });
  }

  // --- Fluids / hydration ---
  // Catches "1 liter of water", "500ml water", "two coffees", "1L tea", etc.
  // Records a volume entry in ml under the "hydration" category. Each fluid
  // keyword looks for a volume quantity near it; when none is present we fall
  // back to a sensible default serving (1 cup = 240ml).
  const FLUIDS: { keywords: string[]; displayName: string; defaultMl: number; metric: string }[] = [
    { keywords: ["water"],                      displayName: "water",  defaultMl: 500, metric: "water" },
    { keywords: ["coffee", "espresso"],         displayName: "coffee", defaultMl: 240, metric: "coffee" },
    { keywords: ["tea"],                         displayName: "tea",    defaultMl: 240, metric: "tea" },
    { keywords: ["milk"],                        displayName: "milk",   defaultMl: 240, metric: "milk" },
    { keywords: ["kefir"],                       displayName: "kefir",  defaultMl: 240, metric: "kefir" },
  ];
  for (const fluid of FLUIDS) {
    for (const kw of fluid.keywords) {
      // Whole-word match — otherwise "tea" fires inside "steak" and we log a
      // phantom beverage alongside a real meat entry.
      const idx = findWord(lower, kw);
      if (idx === -1) continue;
      if (matched.has(kw)) continue;
      if (overlapsExisting(idx, idx + kw.length)) continue;

      matched.add(kw);
      matchedSpans.push([idx, idx + kw.length]);
      const qty = findQuantityNear(lower, idx, kw.length);
      // Only trust the quantity when it's a volume unit (ml). Weight units
      // near a fluid word are almost certainly meant for a food later in the
      // sentence, so we ignore them here and use the default serving.
      const ml = qty && qty.unit === "ml" ? Math.round(qty.value) : fluid.defaultMl;
      entries.push({
        category: "hydration",
        metric: fluid.metric,
        value: ml,
        unit: "ml",
        notes: `${ml}ml ${fluid.displayName}`,
      });
      break;
    }
  }

  // --- Weight ---
  const weightMatch = lower.match(/(?:weigh|weight)\s*(?:is|was|at)?\s*(\d+(?:\.\d+)?)\s*(kg|lbs?|pounds?)?/i);
  if (weightMatch) {
    let val = parseFloat(weightMatch[1]);
    const unit = (weightMatch[2] || "kg").replace(/s$/, "");
    entries.push({ category: "body_measurements", metric: "weight", value: val, unit });
  }

  // --- Blood pressure ---
  if (/\b(blood pressure|bp)\b/.test(lower)) {
    const nums = extractTwoNumbers(lower.slice(lower.search(/\b(blood pressure|bp)\b/)));
    if (nums) {
      entries.push({ category: "vitals", metric: "bp_systolic", value: nums[0], unit: "mmHg" });
      entries.push({ category: "vitals", metric: "bp_diastolic", value: nums[1], unit: "mmHg" });
    }
  }

  // --- Heart rate ---
  const hrMatch = lower.match(/(?:heart rate|pulse|hr)\s*(?:is|was|at)?\s*(\d+)/);
  if (hrMatch) {
    entries.push({ category: "vitals", metric: "heart_rate", value: parseInt(hrMatch[1], 10), unit: "bpm" });
  }
  const bpmMatch = lower.match(/(\d+)\s*bpm/);
  if (bpmMatch && !hrMatch) {
    entries.push({ category: "vitals", metric: "heart_rate", value: parseInt(bpmMatch[1], 10), unit: "bpm" });
  }

  // --- Ketones ---
  const ketoneMatch = lower.match(/ketones?\s*(?:is|was|at|level)?\s*(\d+(?:\.\d+)?)/);
  if (ketoneMatch) {
    entries.push({ category: "vitals", metric: "ketones", value: parseFloat(ketoneMatch[1]), unit: "mmol/L" });
  }

  // --- Glucose ---
  const glucoseMatch = lower.match(/(?:glucose|blood sugar)\s*(?:is|was|at|level)?\s*(\d+(?:\.\d+)?)/);
  if (glucoseMatch) {
    entries.push({ category: "vitals", metric: "blood_glucose", value: parseFloat(glucoseMatch[1]), unit: "mg/dL" });
  }

  // --- Mood / Energy / Sleep / Clarity ---
  for (const metric of ["mood", "energy", "sleep", "clarity"]) {
    const moodRegex = new RegExp(`${metric}\\s+(?:is|was|feeling)?\\s*(\\w+)`, "i");
    const moodMatch2 = lower.match(moodRegex);
    if (moodMatch2) {
      const descriptor = moodMatch2[1].toLowerCase();
      const val = MOOD_WORDS[descriptor];
      if (val !== undefined) {
        entries.push({ category: "wellbeing", metric, value: val, unit: "score" });
      }
    }
  }

  // --- Symptoms ---
  const symptoms = ["headache", "bloating", "joint pain", "fatigue", "cravings", "nausea", "diarrhea", "constipation", "insomnia"];
  for (const symptom of symptoms) {
    if (!lower.includes(symptom)) continue;
    const idx = lower.indexOf(symptom);
    const surroundingText = lower.slice(Math.max(0, idx - 20), idx + symptom.length + 20);
    let severity = 2; // default mild
    for (const [word, val] of Object.entries(SYMPTOM_SEVERITY)) {
      if (surroundingText.includes(word)) { severity = val; break; }
    }
    entries.push({ category: "symptoms", metric: symptom.replace(/\s+/g, "_"), value: severity, unit: "severity" });
  }

  // --- Calorie-only input: "2000 calories" / "2000 cal" / "2000 kcal" ---
  if (entries.length === 0) {
    const calMatch = lower.match(/(\d+)\s*(?:calories|cal|kcal)/);
    if (calMatch) {
      entries.push({ category: "diet_trends", metric: "calories", value: parseInt(calMatch[1], 10), unit: "kcal" });
    }
  }

  // Build summary
  const summary = entries.length > 0
    ? `Parsed ${entries.length} entries from your input`
    : "Couldn't recognize any health data. Try something like '300g ribeye' or 'weight 85 kg'.";

  return { summary, entries };
}
