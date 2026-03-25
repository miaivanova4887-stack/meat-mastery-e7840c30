

## Update TTS Voice Parameters

**File:** `src/components/exercise/YogaFlowProgram.tsx`

**Change:** On line 46, add `rate`, `pitch`, and `volume` parameters to the single `TextToSpeech.speak()` call inside the `speak` callback:

```typescript
// Before
await TextToSpeech.speak({ text, lang: ttsLang });

// After
await TextToSpeech.speak({ text, lang: ttsLang, rate: 0.85, pitch: 1.05, volume: 1.0 });
```

This is the only `speak()` invocation — all pose announcements, side switches, and completion messages flow through this one callback. No other changes.

