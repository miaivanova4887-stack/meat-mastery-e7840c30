I found the immediate install blocker: `patches/@capacitor-community+speech-recognition+7.0.1.patch` is not parseable by `patch-package` because its newly appended `Package.swift` hunk uses a synthetic git index line (`index 0000000..1111111`) instead of a valid patch-package-compatible blob hash/new-file diff.

Plan:

1. Replace only the malformed patch file with a valid `patch-package` diff for `@capacitor-community/speech-recognition@7.0.1`.
2. Keep the existing Android ProGuard hunk unchanged.
3. Keep the iOS `CAPBridgedPlugin` registration hunk unchanged.
4. Keep the new `Package.swift` content unchanged, but encode it as a valid parseable patch-package new-file diff.
5. Do not touch `useVoiceCapture.ts`, auth, onboarding, paywall, purchases, or unrelated app code.

Technical details:

- Exact failing file: `patches/@capacitor-community+speech-recognition+7.0.1.patch`
- Exact failing area: lines 38-70, the appended `Package.swift` new-file diff metadata
- Required fix type: patch-file formatting only, not a broad refactor
- After approval, I will update only that patch file and verify with a non-build patch parser/apply check if possible.