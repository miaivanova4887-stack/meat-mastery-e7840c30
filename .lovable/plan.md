## Fix

The "Notification preferences" card and all deriving paths and subtitle in `src/pages/Profile.tsx` (lines 1037–1038) are hardcoded English strings instead of `t(...)` calls, so they don't translate when the app is in French.

## Changes

1. `**src/i18n/en.json**` (profile section): add
  - `notifPrefTitle`: "Notification preferences"
  - `notifPrefDesc`: "Choose what reminders and updates you receive."
2. `**src/i18n/fr.json**` (profile section): add
  - `notifPrefTitle`: "Préférences de notifications"
  - `notifPrefDesc`: "Choisissez les rappels et mises à jour que vous recevez."
3. `**src/pages/Profile.tsx**` lines 1037–1038: replace hardcoded text with `t("profile.notifPrefTitle")` and `t("profile.notifPrefDesc")`.

No other behaviour, layout, or styling changes.