

## Combine Text Input + Voice into Single Native Component (No AI Credits)

### Goal
Replace the current AI-powered `VoiceRecognition` component with a unified **Smart Log** component that offers both text input and voice-to-text — all parsed locally on-device with zero AI credit cost.

### New File: `src/lib/parseHealthTranscript.ts`

A pure client-side parser using keyword matching and regex. Takes a string, returns `{ summary, entries[] }` matching the current `ParsedVoiceResult` shape.

**Parsing rules (from the edge function's prompt):**
- **Food**: Match keywords — "ribeye"/"steak" 300g → 900 cal, 75g protein, 65g fat; "ground beef" 200g → 500/40/35; "eggs" 2 → 140/12/10; "bacon" 100g → 540/37/42; "salmon" 200g → 400/40/25; "chicken", "burger", "liver", "butter" with reasonable defaults
- **Quantity extraction**: Regex for `(\d+)\s*(g|oz|kg|lb)?` before/after food keyword; scale proportionally from reference portions
- **Weight**: "weight" or "weigh" + number → `body_measurements.weight`
- **Blood pressure**: "bp" or "blood pressure" + two numbers → `vitals.bp_systolic/diastolic`
- **Heart rate**: "heart rate"/"pulse"/"bpm" + number → `vitals.heart_rate`
- **Mood/energy**: "mood"/"energy"/"sleep"/"clarity" + descriptor (great=4, good=3, okay=2, bad=1, terrible=0)
- **Symptoms**: "headache"/"bloating"/"joint pain"/"fatigue"/"cravings" + severity words (0-4 scale)
- **Ketones/glucose**: "ketones" + number → `vitals.ketones`; "glucose"/"blood sugar" + number → `vitals.blood_glucose`

### Modified: `src/components/progress/VoiceRecognition.tsx` → Unified Smart Log

Replace the current voice-only UI with a combined component:

1. **Default state**: Show a text input field with a placeholder like "e.g. 300g ribeye, 2 eggs" and a submit button. Next to submit, a mic icon button to trigger voice input.

2. **Text flow**: User types → taps submit → `parseHealthTranscript(text)` → show confirmation UI (same as current parsed result view) → Log All / Dismiss

3. **Voice flow**: User taps mic → native speech recognition (existing `useVoiceCapture`) → transcript populates the text input → user can edit → taps submit → local parser → confirmation UI

4. **Remove** the `supabase.functions.invoke("voice-log")` call entirely. Replace with synchronous `parseHealthTranscript()` call. No `processing` spinner needed (parsing is instant).

5. **Keep** the confirmation UI (parsed entries list with Log All / Dismiss buttons) and `logEntries` function unchanged.

### Files Changed

| File | Change |
|------|--------|
| `src/lib/parseHealthTranscript.ts` | New — client-side keyword/regex parser |
| `src/components/progress/VoiceRecognition.tsx` | Replace AI call with local parser; add text input field; mic button fills text field with transcript |

### What is NOT changed
- `useVoiceCapture` hook — untouched (still handles native speech recognition)
- `AddEntryDrawer` — untouched (manual metric-by-metric entry)
- Edge function `voice-log` — left in place but no longer invoked
- `logEntries` flow and database sync — unchanged

