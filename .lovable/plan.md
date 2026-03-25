

## Move "Type or Speak" to Top & Match Height with Snap & Log

### Changes

**1. `src/pages/Progress.tsx`** — Reorder JSX: move `<VoiceRecognition />` (line 82-83) to right after `<NutrientBreakdown />` (after line 70), before the Pro-gated PhotoRecognition and BarcodeScanner blocks.

**2. `src/components/progress/VoiceRecognition.tsx`** — Match idle card styling with PhotoRecognition's idle card:
- Idle card (line 167-184): add `p-5` (already has it), add `flex flex-col items-center gap-2` wrapper matching PhotoRecognition's structure. The key difference is PhotoRecognition's idle button uses the same `p-5` layout. Both already match structurally — but to ensure equal height when **expanded/active**, update the expanded input