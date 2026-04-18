import { describe, it, expect } from "vitest";
import { parseHealthTranscript } from "./parseHealthTranscript";

/**
 * Pull the calorie entry for a given food label out of the parser result.
 * Handy because the parser emits calories/protein/fat as separate entries
 * sharing the same `notes` string.
 */
function caloriesFor(transcript: string): { grams: number; kcal: number; notes: string } | null {
  const { entries } = parseHealthTranscript(transcript);
  const cal = entries.find((e) => e.metric === "calories");
  if (!cal || !cal.notes) return null;
  const m = cal.notes.match(/^(\d+)\s*(?:g|ml)\s/);
  return { grams: m ? parseInt(m[1], 10) : NaN, kcal: cal.value, notes: cal.notes };
}

describe("parseHealthTranscript \u2014 bone broth quantity parsing", () => {
  it("logs 500 g when the user types '500gr bone broth'", () => {
    // refGrams=250, cal=40 \u2192 500g should produce ~80 kcal, not 1 kcal.
    const r = caloriesFor("500gr bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(500);
    expect(r!.kcal).toBe(80);
  });

  it("logs 500 g when the user says 'five hundred grams bone broth'", () => {
    // This is the exact bug report: speech recognition transcribes
    // \"500 grams\" as the spelled-out \"five hundred grams\" and the parser
    // used to log 1 kcal because \"five\" was replaced with \"5\" before
    // \"hundred\" was resolved.
    const r = caloriesFor("five hundred grams bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(500);
    expect(r!.kcal).toBe(80);
  });

  it("handles 'five hundred gr of bone broth'", () => {
    const r = caloriesFor("five hundred gr of bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(500);
    expect(r!.kcal).toBe(80);
  });

  it("handles 'I had five hundred millilitres of bone broth'", () => {
    const r = caloriesFor("I had five hundred millilitres of bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(500);
    expect(r!.notes).toMatch(/500ml bone broth/);
  });

  it("handles 'two hundred and fifty grams bone broth'", () => {
    // 250g is the refGrams, so kcal should equal the DB value exactly.
    const r = caloriesFor("two hundred and fifty grams bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(250);
    expect(r!.kcal).toBe(40);
  });

  it("handles 'one thousand grams bone broth'", () => {
    const r = caloriesFor("one thousand grams bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(1000);
    expect(r!.kcal).toBe(160);
  });

  it("handles 'a thousand millilitres of bone broth'", () => {
    const r = caloriesFor("a thousand millilitres of bone broth");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(1000);
  });

  // Voice transcripts for "half a litre" come back in many shapes depending
  // on the recogniser. These all need to resolve to 500 ml so the Progress
  // page logs the right amount regardless of phrasing.
  it.each([
    "half a litre of bone broth",
    "half of a litre of bone broth",
    "half liter of bone broth",
    "half litre bone broth",
    "a half litre of bone broth",
    "a half of a litre of bone broth",
    "half the litre of bone broth",
    "point five litres of bone broth",
    "point 5 l of bone broth",
    "0.5 litres of bone broth",
    "0.5 l of bone broth",
    ".5 litre of bone broth",
  ])("resolves '%s' to 500 ml bone broth", (input) => {
    const r = caloriesFor(input);
    expect(r).not.toBeNull();
    // bone broth is logged in ml when a fluid unit was given, in grams when
    // a weight unit was. Either way the numeric quantity must be 500.
    expect(r!.grams).toBe(500);
    expect(r!.kcal).toBe(80);
  });
});

describe("parseHealthTranscript \u2014 regression safety", () => {
  it("still parses '300g ribeye'", () => {
    const r = caloriesFor("300g ribeye");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(300);
    // ribeye refGrams=300, cal=900 \u2192 exactly 900 kcal at the reference weight.
    expect(r!.kcal).toBe(900);
  });

  it("still parses 'two eggs' as count-based", () => {
    const { entries } = parseHealthTranscript("two eggs");
    const cal = entries.find((e) => e.metric === "calories");
    expect(cal).toBeDefined();
    expect(cal!.value).toBe(140);
    expect(cal!.notes).toBe("2 egg(s)");
  });

  it("still parses 'half a litre of water'", () => {
    const { entries } = parseHealthTranscript("half a litre of water");
    const water = entries.find((e) => e.metric === "water");
    expect(water).toBeDefined();
    expect(water!.value).toBe(500);
    expect(water!.unit).toBe("ml");
  });

  it("still parses 'weight is 85 kg'", () => {
    const { entries } = parseHealthTranscript("weight is 85 kg");
    const w = entries.find((e) => e.metric === "weight");
    expect(w).toBeDefined();
    expect(w!.value).toBe(85);
  });

  it("doesn't double-match 'sirloin steak' as both sirloin and steak", () => {
    const { entries } = parseHealthTranscript("200g sirloin steak");
    // Expect exactly one food (sirloin) \u2192 three macros (cal/protein/fat).
    // No separate \"steak (approx.)\" entry.
    expect(entries.filter((e) => e.metric === "calories")).toHaveLength(1);
    const cal = entries.find((e) => e.metric === "calories");
    expect(cal!.notes).toMatch(/sirloin/);
  });

  it("doesn't misfire on 'tea' inside 'steak'", () => {
    const { entries } = parseHealthTranscript("300g steak");
    const tea = entries.find((e) => e.metric === "tea");
    expect(tea).toBeUndefined();
  });

  it("handles 'twenty five grams of butter' as 25g", () => {
    const r = caloriesFor("twenty five grams of butter");
    expect(r).not.toBeNull();
    expect(r!.grams).toBe(25);
  });

  it("handles 'I weigh one hundred and eighty pounds'", () => {
    // 180 lbs \u2248 81.6 kg, but the weight regex keeps the raw unit.
    const { entries } = parseHealthTranscript("I weigh one hundred and eighty pounds");
    const w = entries.find((e) => e.metric === "weight");
    expect(w).toBeDefined();
    expect(w!.value).toBe(180);
  });
});

describe("parseHealthTranscript - clause-scoped quantity matching", () => {
  /**
   * Pull the kcal value for a food whose notes contain the given fragment.
   * Returns undefined if no matching calorie entry was emitted.
   */
  function kcalFor(transcript: string, noteFragment: string): number | undefined {
    const { entries } = parseHealthTranscript(transcript);
    const cal = entries.find(
      (e) =>
        e.metric === "calories" &&
        (e.notes || "").toLowerCase().includes(noteFragment.toLowerCase())
    );
    return cal?.value;
  }

  it("doesn't let butter inherit ribeye's quantity in a comma+and list", () => {
    // The original bug: "30g butter" sits ~35 chars past ribeye, so the old
    // findQuantityNear (30-char window, first-match-wins) grabbed ribeye's
    // 300g. Now clause-scoped: each food sees only its own clause's numbers.
    expect(kcalFor("300g ribeye, 2 eggs, and 30g butter", "butter")).toBe(215); // 30g
    expect(kcalFor("300g ribeye, 2 eggs, and 30g butter", "ribeye")).toBe(900); // 300g
  });

  it.each([
    ["300g ribeye and 30g butter", 215],
    ["300g ribeye, 30g butter", 215],
    ["300g ribeye with 30g butter", 215],
    ["300g ribeye then 30g butter", 215],
    ["300g ribeye plus 30g butter", 215],
    ["I had 300g ribeye and then 30 grams of butter", 215],
  ])("'%s' logs butter with its own quantity", (input, expected) => {
    expect(kcalFor(input, "butter")).toBe(expected);
  });

  it("supports post-position 'butter 30g'", () => {
    expect(kcalFor("butter 30g", "butter")).toBe(215);
  });

  it("prefers the number with an explicit unit over a bare number", () => {
    // "2 eggs" sits between the keyword and the one with a unit. The parser
    // must pick "30g" for butter, not the bare "2".
    expect(kcalFor("2 eggs 30g butter", "butter")).toBe(215);
  });

  it("handles a full meal sentence end-to-end", () => {
    const input = "I had 300g ribeye, 2 eggs, and half a litre of bone broth";
    expect(kcalFor(input, "ribeye")).toBe(900);
    expect(kcalFor(input, "bone broth")).toBe(80); // 500ml
    expect(kcalFor(input, "egg")).toBe(140); // 2 eggs
  });

  it("keeps bone broth's volume from leaking into butter", () => {
    expect(kcalFor("500ml of bone broth and 30g butter", "butter")).toBe(215);
    expect(kcalFor("500ml of bone broth and 30g butter", "bone broth")).toBe(80);
  });

  it("handles salmon + butter without cross-contamination", () => {
    // salmon refGrams=200, cal=400 => 150g => 300 kcal
    // butter refGrams=20,  cal=143 => 20g  => 143 kcal
    expect(kcalFor("150g salmon and 20g butter", "salmon")).toBe(300);
    expect(kcalFor("150g salmon and 20g butter", "butter")).toBe(143);
  });
});
