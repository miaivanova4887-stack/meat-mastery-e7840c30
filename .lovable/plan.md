

## Unify Visual Style Across Smart Log, Snap & Log, and Scan Barcode

### Problem
The three logging components have inconsistent idle-state UIs:
- **Snap & Log** / **Scan Barcode**: Large card with centered icon circle + title + subtitle, dashed border, gradient overlay
- **Smart Log (Voice/Text)**: Bare input row with mic/send buttons, no icon, no title, different padding

### Solution
Give the Smart Log component the same card-style idle state as the other two, then reveal the input row on tap — creating a consistent "action card" pattern across all three.

### Changes (single file: `src/components/progress/VoiceRecognition.tsx`)

**Idle state** (when `!parsedResult` and no active input):
- Add a new `expanded` state (`false` by default)
- When `!expanded`: render a card matching PhotoRecognition/BarcodeScanner style:
  - `rounded-xl border border-dashed border-primary/30 bg-card p-5` with centered layout
  - `w-12 h-12 rounded-full bg-primary/10` icon circle containing a `Keyboard` icon (from lucide)
  - Title: "Type or Speak" (use i18n key `progress.typeOrSpeak`)
  - Subtitle: "Log food with text or voice — no AI credits" (i18n key `progress.typeOrSpeakDesc`)
  - Subtle gradient overlay matching the other cards
  - On click → set `expanded = true`
- When `expanded`: show the existing input row (text field + mic + send) plus a collapse hint
- Auto-collapse when `parsedResult` is dismissed

**Result state** (when `parsedResult` exists): unchanged — already matches the other components' result cards.

### Visual Consistency Checklist
| Property | Snap & Log | Scan Barcode | Smart Log (after) |
|----------|-----------|-------------|------------------|
| Border | dashed primary/30 | dashed primary/30 | dashed primary/30 |
| Icon circle | 48px, primary/10 | 48px, primary/10 | 48px, primary/10 |
| Gradient overlay | yes (0.04) | yes (0.04) | yes (0.04) |
| Title size | text-sm font-semibold | text-sm font-semibold | text-sm font-semibold |
| Subtitle | text-[11px] muted | text-[11px] muted | text-[11px] muted |
| Padding | p-5 | p-5 | p-5 |

### Files Changed

| File | Change |
|------|--------|
| `src/components/progress/VoiceRecognition.tsx` | Add `expanded` state; render card-style idle UI matching other components; expand to input row on tap |

