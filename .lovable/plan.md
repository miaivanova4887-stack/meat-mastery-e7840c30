# Add to Calendar → Apple Calendar on iOS

## Problem

Tapping **Add to calendar** on an upcoming coaching session currently opens a Google Calendar **template page** in the in-app browser on iOS. The user expects it to open **Apple Calendar's native "Add Event"** sheet (the system "New Event" pre-filled card).

Root cause: `addToCalendar()` in `src/components/CoachingSessionsList.tsx` routes both iOS and Android through `buildGoogleCalendarUrl()` + `openExternalUrl()`. iOS never sees a `.ics` payload that the system can hand to Calendar.app.

## Fix

Split native behavior by platform:

- **iOS** → write the generated `.ics` to a temp file via `@capacitor/filesystem` (Cache directory) and open it with `@capacitor/file-opener`. iOS recognizes `text/calendar` and presents the system **Add Event** sheet that writes directly into Apple Calendar. No browser, no share sheet, no Google page.
- **Android** → keep the current Google Calendar template URL (already drops into the Google Calendar app, which is the Android-native equivalent).
- **Web** → keep current `.ics` blob download (unchanged).

Fallback chain on iOS if file-opener fails: Google Calendar template URL → share sheet with `.ics`. Same toast-on-failure behavior as today.

## Changes

1. `package.json` — add `@capacitor/filesystem` and `@capawesome/capacitor-file-opener` (or `@capacitor-community/file-opener`, whichever is maintained for Capacitor 6+).
2. `ios/App/Podfile` is auto-updated by `npx cap sync` (user step, already in their workflow).
3. `src/components/CoachingSessionsList.tsx`
   - New helper `openIcsOnIos(session)` that writes the `.ics` to `Directory.Cache` and calls `FileOpener.openFile({ path: uri, mimeType: "text/calendar" })`.
   - In `addToCalendar()`, branch: `platform === "ios"` → `openIcsOnIos`; `platform === "android"` → current Google template URL path; web → unchanged.
4. No changes to `cal-webhook`, RevenueCat, Onboarding, or any other surface.

## User-visible result

iOS tap on **Add to calendar** → Apple Calendar's native event sheet appears pre-filled with title (`CarnivoreX Coaching Call (1 hr)`), start/end time, location (Cal.com join URL), and description. User taps **Add** to save to their default calendar.

## Out of scope

- EventKit native plugin (would need writing a custom Capacitor plugin + `NSCalendarsUsageDescription`). The `.ics`-via-file-opener path is simpler, ships today, and matches what users expect from "Add to calendar" links.
- Changing Android behavior.
- Recurring events, reminders/alarms, attendee invites.

## Verification (user must do on device after `npx cap sync` + rebuild)

1. Open an upcoming coaching session → tap **Add to calendar**.
2. Expect: Apple Calendar's **Add Event** sheet appears (not Safari, not the share sheet, not a Google page).
3. Tap **Add** → event appears in Apple Calendar at the correct local time with the Cal.com join URL in Location.
