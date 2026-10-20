# Personalized Monday progress reminders

## What changes
- Keep the existing Monday morning schedule: 9:00 AM in each recipient’s local timezone.
- Replace the generic weekly message with personal meal and wellness check-in counts for the previous Monday–Sunday.
- Count one logged meal once, not once per calorie/protein/fat row; count a multi-rating wellness check-in once.
- Use encouraging English/French messages tailored to activity. With no recorded activity, invite the user back without inventing progress.
- Include days meeting the user’s protein goal only when a valid goal and recorded protein data exist. Say “met your protein goal on X days,” rather than claiming unrecorded days were successful.
- Keep notification consent and the weekly-summary preference mandatory. Tapping the reminder opens Progress.

## Signed-in accounts
Aggregate dated account progress records when the existing weekly reminder is sent. Anchor the reporting window to that Monday’s local date, not the time a delayed send happens.

## Guests
Keep meal records, wellness ratings and notes on the phone. Schedule one upcoming local Monday notification and refresh its counts after logging, deleting entries, changing preferences, and reopening the app. Suppress the matching generic server reminder only after local scheduling succeeds, to avoid duplicates. Older app versions retain the existing generic reminder until upgraded.

An Android app update is required for guest personalization. This work stays in the AOS project; do not modify the separate iOS project or its native files.

## Technical details
- Add a pure shared aggregation/copy module usable by the client and scheduled functions, with timezone-aware calendar boundaries and sample/future-record exclusion.
- Use dated nutrition log groups and shared check-in timestamps; never infer historical counts from undated meal-plan completion flags.
- Use Capacitor local notifications for guest delivery and the existing FCM campaign flow for signed-in delivery.
- Add narrowly scoped device delivery metadata for duplicate suppression; do not upload guest health records or notes.
- Preserve the existing campaign timing and unrelated push campaigns, permissions, and database policies.

## Verification
- Test exact meal/check-in counts, previous-week boundaries, DST, zero activity, protein-goal days, consent/preference gating, and duplicate suppression.
- Exercise guest logging/check-in updates in the app and verify the resulting scheduled message through mocked native notification tests.
- Check deployed signed-in aggregation with a non-delivering preview; do not send test pushes to customers.
- Report phone delivery as unverified until the rebuilt Android app is tested on a real device.