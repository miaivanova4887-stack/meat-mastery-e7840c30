# Why the 7pm daily meal reminder never arrived

I checked the live setup. The reminder could not have been sent — two things are missing.

## What I found

1. **No daily reminder exists on the server.** The table of automated notification campaigns is completely empty. The "Daily reminder to log meals at 7pm" only lives as a switch in the app's profile screen; nothing on the server was ever created to actually send it. (The manual test push worked because that path doesn't use campaigns.)
2. **The account's notification choices were never saved to the server.** For mia.ivanova.4887@gmail.com, permission is granted and the phone is registered, but the saved preference list is empty. The sender only picks accounts whose "daily meal reminder" preference is explicitly on, so this account would be skipped even once a reminder exists. Preferences are only written when the switch is toggled in the app — they aren't written on first sign-in with defaults.

Timezone (Toronto) and the every-hour/every-5-minute automatic senders are correctly in place, so once the two gaps above are closed, 7pm local will fire.

## Fix plan

1. **Create the daily meal-log reminder campaign** (server side): daily, 7:00 pm local time per account, honouring a user-customised time if set, gated on the "daily meal reminder" preference, with English and French copy and a tap target of the meal-log screen.
2. **Save notification defaults on registration.** When a phone registers or consent is granted, write the default preference set (daily reminder on, time 19:00) to the account so new users are addressable without touching the switches. Backfill this for the existing accounts, including yours.
3. **Make the send window robust for non-hour times.** The reconciler currently runs once an hour and only accepts an occurrence up to 30 minutes old, so a custom time like 7:30 pm would be silently missed. Widen the accepted window to cover a full hour so any minute-of-hour setting is delivered on the next hourly pass (no extra cost, same cadence).
4. **Verify with evidence, no guessing.** Set your reminder time a few minutes ahead, close the app fully, then confirm: a queued send row appears, the sender marks it delivered with no error, and the notification lands on the phone and opens the right screen. Then restore the 7pm time and confirm one real 7pm delivery.

No app rebuild is needed for steps 1 and 3. Step 2 touches app code, so the next Android build (code 16 / 1.1.8) would carry it — but the backfill alone makes your current 1.1.7 install work, so you can verify tonight without rebuilding.

## Technical notes

- `push_campaigns` has 0 rows; `push_campaign_runs` has 0 rows. Cron jobs `push-dispatch-every-5min` and `push-reconcile-hourly` (minute 7) are active.
- `profiles.notification_preferences` = `{}` for user `5eb3afab-…b4e0`; `push_consent = granted`, `timezone = America/Toronto`, `locale = en`.
- `push-reconcile` filters `notification_preferences->>{preference_key} = 'true'` and accepts occurrences only when `0 <= now - occurrence <= 30 min`; with an hourly cron this drops any `local_time` whose minutes are not within :07–:37 of the tick. Widen to 60 min (idempotent via the `(campaign_id, user_id, scheduled_for)` unique constraint).
- Campaign shape: `trigger_type = 'scheduled'`, `schedule = {kind:'daily', local_time:'19:00', preference_key:'daily_meal_reminder', use_profile_reminder_time:true}`, one step with localized `{en, fr}` title/body and `data.route`.
- Preference defaults written via `register-device-token` payload (`pushFcm.ts` already forwards `notification_preferences`) plus a one-off SQL backfill merging `daily_meal_reminder: true`, `reminder_time: '19:00'`.
