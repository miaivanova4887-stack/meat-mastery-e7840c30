# Automated reminders: no rebuild needed, content list, and French check

## Do you need to rebuild first?

No. Everything needed for the 7pm reminder to work lives on the server side and is already live:

- The reminder settings are now saved on your account (7:00 PM meal reminder on).
- The six recurring reminder programs exist and are active.
- The hourly sender now looks back a full hour.

Version 1.1.8 (code 16) only matters for future installs: it makes the app save a complete set of reminder settings whenever someone turns notifications on, so new users are covered automatically. Your currently installed 1.1.7 can receive all six reminders as-is.

One thing is still required, and it is not a rebuild: your phone's notification registration is no longer in our records (it disappears when the app is reinstalled). Open the installed app, sign in, leave it open ~15 seconds, and tell me — then I re-run the live send test.

## The content created for each automated reminder

Every message exists in English and Canadian French, and each opens a specific screen when tapped.

| Reminder | When (user's local time) | Opens |
| --- | --- | --- |
| Daily meal log | Every day at the time chosen in settings (default 7:00 PM) | Progress |
| Streak nudge | Every day at 8:00 PM | Progress |
| Weekly progress summary | Mondays at 9:00 AM | Progress |
| New recipes & meal ideas | Wednesdays at 6:00 PM | Recipes |
| Fasting & ketosis updates | Saturdays at 10:00 AM | Fasting timer |
| Coaching tips | Sundays at 9:00 AM | Coaching |
| Coaching call reminder | 1 hour before a booked call (already working) | The booked session |

Wording, English then French:

1. Daily meal log — "Log today's meals" / "Two taps keeps your streak and your numbers accurate."
   "Enregistrez vos repas" / "Deux touches suffisent pour garder votre série et vos chiffres à jour."
2. Streak nudge — "Your streak is still open" / "Log a meal before midnight to keep it alive."
   "Votre série est encore ouverte" / "Enregistrez un repas avant minuit pour la conserver."
3. Weekly summary — "Your week in review" / "See your protein, weight and streak trends from last week."
   "Votre semaine en résumé" / "Consultez vos tendances de protéines, de poids et de série."
4. Recipes — "Fresh recipe ideas" / "New cuts, new cooks — find tonight's dinner in seconds."
   "Nouvelles idées de recettes" / "Nouvelles coupes, nouvelles recettes — trouvez votre dîner en quelques secondes."
5. Fasting & ketosis — "Where are you in ketosis?" / "Check your fasting phase and what your body is doing right now."
   "Où en êtes-vous dans la cétose ?" / "Vérifiez votre phase de jeûne et ce que votre corps fait maintenant."
6. Coaching tips — "This week's coaching tip" / "One small adjustment that makes the next seven days easier."
   "Le conseil coaching de la semaine" / "Un petit ajustement pour faciliter les sept prochains jours."

## French / Canada status

Confirmed already in place: the sender reads each account's saved language and picks the French text when it is French. Accounts created from a French phone (including fr-CA) are stored as French, and reminder times always follow each person's own timezone, so a Quebec user gets 7:00 PM Eastern, not 7:00 PM UTC.

Remaining work is verification only — proving a French reminder actually arrives in French.

## Proposed verification steps

1. You open the app on the phone so the notification registration is restored; I confirm it server-side.
2. I run a live English test of the daily meal reminder through the real scheduled path and confirm delivery on your phone.
3. I temporarily switch your account to French, run the same test, and confirm the French wording arrives, then switch it back to English.
4. I confirm tapping each message opens the right screen (spot check: Progress, Recipes, Fasting timer, Coaching).
5. I report the final state; no further app rebuild is required for reminders unless step 2-4 uncover an app-side problem.

## Technical notes

- Campaigns live in `push_campaigns` as `trigger_type='scheduled'`, each with a `schedule` (`kind`, `local_time`, optional `weekday`, `preference_key`, `use_profile_reminder_time` for the daily one) and one localized step with `data.route`.
- `push-reconcile` (hourly, minute 7) enqueues per-user occurrences using `profiles.timezone`; window widened from 30 to 60 minutes; idempotent via the unique `(campaign_id, user_id, scheduled_for)` index.
- `push-scheduler` (every 5 min) sends via FCM, choosing copy with `pickLocalized(step.title, normalizeLocale(profiles.locale))`; now logs when a user has no device token.
- `normalize_profile_locale` trigger maps any `fr*` value to `fr`, so `fr-CA` resolves correctly.
- Client 1.1.8 changes: canonical preference keys in `src/lib/notificationPrefs.ts`, consent sheet and Profile settings both write the full set, `register-device-token` seeds defaults as a server-side safety net.
