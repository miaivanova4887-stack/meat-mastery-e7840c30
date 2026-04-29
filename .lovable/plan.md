# Fix voice log on Progress page (Android)

## Root cause

On Android, `useVoiceCapture` starts `SpeechRecognition` with `popup: true` (the Google system voice overlay). In this mode the plugin emits **no `partialResults` events** — only a single final transcript via the `start()` promise resolution.

In `src/hooks/useVoiceCapture.ts` (lines 337–350), the final transcript is only written into state when `receivedInputRef.current === true`:

```ts
if (finalMatch) {
  if (receivedInputRef.current) {  // ← always false on Android popup mode
    setTranscriptSafe(finalMatch);
  }
}
```

`receivedInputRef` is only flipped to `true` inside the `partialResults` listener. Since no partials fire on Android, the final transcript from Google's voice UI is silently dropped. The textarea stays empty, so:

- `useEffect` syncing transcript → `setTextInput` never runs
- `stopVoice()` and the natural-stop effect both gate on `receivedInput()` and skip auto-submit
- Result: speech is captured by Google STT, transcribed, but never committed → no meal logged, no macros

The Type path is untouched because it bypasses the voice ref entirely.

## Fix

In `src/hooks/useVoiceCapture.ts`, treat the final result of the `start()` promise as authoritative input on platforms that don't emit partials. Specifically, when we receive a non-empty `finalMatch` and the platform was started in popup mode (Android), set `receivedInputRef.current = true` and write the transcript regardless of prior partials. The iOS stale-echo guard (which is the reason that `if` exists) is only meaningful when partials are enabled, so it's safe to bypass for popup-mode Android.

Concretely, capture `usePartialResults` in the start promise closure and use it to decide:

```ts
if (finalMatch) {
  if (!usePartialResults) {
    // Android popup mode: no partials ever fire, so the final match
    // from the system voice UI is the only signal we get. Trust it.
    receivedInputRef.current = true;
    setTranscriptSafe(finalMatch);
  } else if (receivedInputRef.current) {
    // iOS: only trust the final if a real partial already arrived,
    // otherwise it may be a cached replay from a stuck audio session.
    setTranscriptSafe(finalMatch);
  }
}
```

This restores the Android voice → textarea → auto-submit → parse → log flow without changing iOS behavior or the typed path.

## Diagnostics

Add `console.info` logs to make this verifiable in logcat:

- `src/components/progress/VoiceRecognition.tsx`
  - on mic tap (`handleStartListening`): `[VoiceLog] mic tap`
  - inside `stopVoice`: `[VoiceLog] stop captured=<len> heard=<bool>`
  - inside the natural-stop effect just before `submitText`: `[VoiceLog] natural stop submitting len=<len>`
  - inside `submitText`: `[VoiceLog] submit input=<len> entries=<n>`
  - inside `logEntries`: `[VoiceLog] saving entries=<n>` and on success `[VoiceLog] save success` / on failure `[VoiceLog] save failed`
- `src/hooks/useVoiceCapture.ts`
  - in the native start promise `.then` when `finalMatch` is non-empty: `[VoiceLog] native final received len=<len> usePartialResults=<bool>`
  - in `partialResults` listener when accepting: `[VoiceLog] native partial accepted len=<len>`

## Files to change

- `src/hooks/useVoiceCapture.ts` — adjust the final-match acceptance logic; add logs
- `src/components/progress/VoiceRecognition.tsx` — add logs only

## Out of scope

- iOS partials / stale-echo behavior (unchanged)
- Typed input path (unchanged)
- Parser (`parseHealthTranscript`) and `useAddEntry` mutation (unchanged)
- Onboarding, Health Connect, push, campaign code (unchanged)
