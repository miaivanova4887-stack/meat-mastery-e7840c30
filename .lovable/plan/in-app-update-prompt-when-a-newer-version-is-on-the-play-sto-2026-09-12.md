# In-app update prompt when a newer version is on the Play Store

## What the user will see

When someone opens the app and a newer version is live on Google Play, Google's own update sheet slides up inside the app. They tap "Update", the download runs in the background, and the app restarts on the new version — they never leave CarnivoreX.

The prompt is dismissible. If they skip it, it will not nag them again for 24 hours, then reappear on a later app open.

If no update is available, or the app was installed outside Google Play (a debug build sideloaded from your Mac), nothing appears and nothing breaks.

## Behaviour rules

- Checked on app start and again whenever the app returns to the foreground, at most once per hour.
- Skip is remembered for 24 hours on the device.
- Android only. On the web version nothing is shown.
- Never blocks the app; failures are silent.

## Technical notes

- Add `@capawesome/capacitor-app-update` and use `getAppUpdateInfo()` → if `updateAvailability === UPDATE_AVAILABLE`, call `startFlexibleAppUpdate()`, then `completeFlexibleUpdate()` when the download finishes. Fall back to `openAppStore()` if the flexible flow reports it is unavailable.
- New `src/lib/appUpdate.ts` holding the check, the once-per-hour throttle, and the 24-hour snooze key in `localStorage`.
- New `src/hooks/useAppUpdatePrompt.ts` mounted once in `App.tsx`, wired to Capacitor `App.appStateChange` for the foreground re-check; guarded by `Capacitor.isNativePlatform()` and platform `android`.
- Version bump for the rebuild: `versionCode 17`, `versionName 1.1.9` in `android/app/build.gradle`.
- Requires `npm install`, `npm run build`, `npx cap sync android`, then a fresh build — the update flow only works for builds actually installed from Google Play, so it can be verified end-to-end only via internal testing (a locally signed debug build will report no update available).

## Build steps after approval

Line-by-line terminal commands for the pull, install, build, sync, and signed AAB will be provided once the code changes are in.
