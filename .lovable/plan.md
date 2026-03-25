

## Update Smart Log Idle Card Copy

### Changes

| File | Change |
|------|--------|
| `src/i18n/en.json` (line 312) | Change `typeOrSpeakDesc` from `"Log food with text or voice — no AI credits"` to `"Tap mic to voice log your meal"` |
| `src/i18n/fr.json` (line 312) | Change `typeOrSpeakDesc` from `"Enregistrez vos repas par texte ou voix — sans crédits IA"` to `"Appuyez sur le micro pour enregistrer vocalement votre repas"` |
| `src/components/progress/VoiceRecognition.tsx` | Update the inline fallback string for `typeOrSpeakDesc` to