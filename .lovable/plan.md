## Diagnosis

`startNativeListening` (`src/hooks/useVoiceCapture.ts`) is throwing between `AudioSession.resetAudioSession()` (L227) and the SR permission log (L256). The thrown error bubbles up to `startListening`'s catch at **L503–509**, which is the only path that emits the observed user-facing string `"Unable to start voice recognition."` (L507).

Existing logs prove the boundaries:

- Last log seen: `[VoiceLog] iOS mic permission result = granted` (L216) and `resetAudioSession` reported `{ok:true}`.
- Never-seen logs: `[VoiceLog] SR permission status before request` (L256) and `[VoiceLog] recorder start invoked` (L344).

So the unhandled throw is in exactly one of these unprotected awaits between L227 and L256:

1. `await SpeechRecognition.available()` — L249
2. `await SpeechRecognition.checkPermissions()` — L255

Most likely candidate is `SpeechRecognition.available()` on iOS (the community plugin throws — does not reject with a friendly value — when `SFSpeechRecognizer(locale:)` returns nil for the device's current locale, which lines up with "Siri/Apple Intelligence is active" but no SR logs at all). `checkPermissions()` is the secondary suspect.

No gating state is at fault: `listening` is the only short-circuit in `startListening` (L499) and would return `true` silently, not throw. There is no auth/paywall/keyboard guard in this hook.

## Minimal fix

Edit only `src/hooks/useVoiceCapture.ts`, only inside `startNativeListening`, between L227 and L265. No other file, no other function.

1. **L228 (immediately after `await AudioSession.resetAudioSession(...)`):** add
  ```ts
   console.info("[VoiceLog] after resetAudioSession ok");
  ```
2. **Wrap L249–L265 (the `available()` + `checkPermissions()` + `requestPermissions()` block) in a single try/catch.** On catch:
  - log `console.error("[VoiceLog] SR availability/permission threw step=", lastStep, "err=", String(err), "stack=", (err as any)?.stack)`
  - if `messageIncludesPermissionBlock(err)` → `onPermissionBlocked?.()` else `onError?.("Voice recognition unavailable on this device.")`
  - `return false` (so `startListening`'s outer catch never fires the generic "Unable to start voice recognition." string and we get a precise message + log).
   Track `lastStep` as a local string: `"available"` before L249, `"checkPermissions"` before L255, `"requestPermissions"` before L259, `"granted"` after L264.
3. **Add early-return reason logs** at the existing 3 return paths inside `startNativeListening`:
  - L179 (busy): `console.info("[VoiceLog] early return: busy stopping/starting")`
  - L219 (mic denied): `console.info("[VoiceLog] early return: mic permission denied")`
  - L252 (SR unavailable): `console.info("[VoiceLog] early return: SR not available")`
  - L263 (SR denied): `console.info("[VoiceLog] early return: SR permission denied")`
  - The new catch above also gets `console.info("[VoiceLog] early return: SR availability/permission threw")` before `return false`.
4. **Gating-state log at top of `startListening` (L499):** one line —
  ```ts
   console.info("[VoiceLog] startListening listening=", listening, "isNative=", isNative);
  ```

Log the exact locale/language before `available()`.

No other changes. No refactor of `stopListening`, listeners, web path, native plugin, auth, onboarding, paywall, or push.

## Expected log sequence on iOS after fix

```
[VoiceLog] startListening listening= false isNative= true
[VoiceLog] iOS mic permission status before request = granted
[VoiceLog] after resetAudioSession ok
[VoiceLog] SR permission status before request = { speechRecognition: "granted" }
[VoiceLog] recorder start invoked platform= ios language= en-US
[VoiceLog] recorder started
```

Failure case (proves exact stop point):

```
[VoiceLog] after resetAudioSession ok
[VoiceLog] SR availability/permission threw step= available err= <native msg> stack= <…>
[VoiceLog] early return: SR availability/permission threw
```

## Verification checklist

1. Elite/iOS user taps mic on Home → above happy-path sequence prints; transcript appears.
2. If SFSpeechRecognizer is genuinely unavailable for the locale, user sees "Voice recognition unavailable on this device." (not the generic string) and log identifies `step=available`.
3. Android voice unaffected (code path untouched outside the iOS branch's neighbors).
4. No regression in auth, onboarding, paywall, coaching, push.

## Out of scope

Native Swift plugin changes, refactors of `stopListening`, web path, any non-voice feature.