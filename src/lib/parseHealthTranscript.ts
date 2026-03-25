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
  refGrams: number;
  cal: number;
  protein: number;
  fat: number;
}

const FOOD_DB: FoodItem[] = [
  { keywords: ["ribeye", "rib eye", "steak"],      refGrams: 300, cal: 900, protein: 75, fat: 65 },
  { keywords: ["ground beef", "mince", "minced beef"], refGrams: 200, cal: 500, protein: 40, fat: 35 },
  { keywords: ["bacon"],                            refGrams: 100, cal: 540, protein: 37, fat: 42 },
  { keywords: ["salmon"],                           refGrams: 200, cal: 400, protein: 40, fat: 25 },
  { keywords: ["chicken breast", "chicken"],        refGrams: 200, cal: 330, protein: 62, fat: 7 },
  { keywords: ["burger", "hamburger", "patty"],     refGrams: 150, cal: 400, protein: 30, fat: 30 },
  { keywords: ["liver"],                            refGrams: 100, cal: 135, protein: 21, fat: 4 },
  { keywords: ["butter"],                           refGrams: 20,  cal: 143, protein: 0,  fat: 16 },
  { keywords: ["pork chop", "pork"],                refGrams: 200, cal: 500, protein: 50, fat: 30 },
  { keywords: ["lamb", "lamb chop"],                refGrams: 200, cal: 500, protein: 45, fat: 35 },
  { keywords: ["sausage", "sausages"],              refGrams: 100, cal: 300, protein: 18, fat: 25 },
  { keywords: ["brisket"],                          refGrams: 200, cal: 600, protein: 48, fat: 44 },
  { keywords: ["tuna"],                             refGrams: 150, cal: 180, protein: 40, fat: 1 },
  { keywords: ["shrimp", "prawns"],                 refGrams: 150, cal: 130, protein: 28, fat: 2 },
  { keywords: ["sardines", "sardine"],              refGrams: 100, cal: 210, protein: 25, fat: 11 },
  { keywords: ["bone broth", "broth"],              refGrams: 250, cal: 40,  protein: 8,  fat: 1 },
  { keywords: ["cheese", "cheddar"],                refGrams: 50,  cal: 200, protein: 12, fat: 16 },
  { keywords: ["cream cheese"],                     refGrams: 30,  cal: 100, protein: 2,  fat: 10 },
  { keywords: ["heavy cream", "cream"],             refGrams: 30,  cal: 100, protein: 1,  fat: 10 },
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

function findQuantityNear(text: string, keywordIndex: number, keywordLength: number): { value: number; unit: string } | null {
  // Look in a window around the keyword
  const before = text.slice(Math.max(0, keywordIndex - 30), keywordIndex);
  const after = text.slice(keywordIndex + keywordLength, keywordIndex + keywordLength + 30);
  const combined = before + " " + after;
  const m = combined.match(/(\d+(?:\.\d+)?)\s*(g|oz|kg|lb|lbs|grams|ounces|pounds)?/i);
  if (m) {
    const val = parseFloat(m[1]);
    const rawUnit = (m[2] || "").toLowerCase();
    // Convert to grams
    if (rawUnit === "oz" || rawUnit === "ounces") return { value: val * 28.35, unit: "g" };
    if (rawUnit === "kg") return { value: val * 1000, unit: "g" };
    if (rawUnit === "lb" || rawUnit === "lbs" || rawUnit === "pounds") return { value: val * 453.6, unit: "g" };
    if (rawUnit === "g" || rawUnit === "grams" || rawUnit === "") return { value: val, unit: rawUnit || "g" };
  }
  return null;
}

export function parseHealthTranscript(transcript: string): ParsedResult {
  const entries: ParsedEntry[] = [];
  const lower = transcript.toLowerCase().trim();
  const matched = new Set<string>();

  // --- Food matching ---
  for (const food of FOOD_DB) {
    for (const kw of food.keywords) {
      const idx = lower.indexOf(kw);
      if (idx === -1) continue;
      if (matched.has(kw)) continue;

      // Check longer keywords haven't already matched
      const alreadyCovered = [...matched].some(m => kw.includes(m) || m.includes(kw));
      if (alreadyCovered) continue;

      matched.add(kw);
      const qty = findQuantityNear(lower, idx, kw.length);
      const grams = qty ? qty.value : food.refGrams;
      const scale = grams / food.refGrams;

      entries.push({ category: "diet_trends", metric: "calories", value: Math.round(food.cal * scale), unit: "kcal", notes: `${Math.round(grams)}g ${kw}` });
      entries.push({ category: "diet_trends", metric: "protein", value: Math.round(food.protein * scale), unit: "g", notes: `${Math.round(grams)}g ${kw}` });
      entries.push({ category: "diet_trends", metric: "fat", value: Math.round(food.fat * scale), unit: "g", notes: `${Math.round(grams)}g ${kw}` });
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
  } else if (!matched.has("egg") && (lower.includes("egg") || lower.includes("eggs"))) {
    // "eggs" without a count → assume 2
    entries.push({ category: "diet_trends", metric: "calories", value: 140, unit: "kcal", notes: "2 egg(s)" });
    entries.push({ category: "diet_trends", metric: "protein", value: 12, unit: "g", notes: "2 egg(s)" });
    entries.push({ category: "diet_trends", metric: "fat", value: 10, unit: "g", notes: "2 egg(s)" });
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
