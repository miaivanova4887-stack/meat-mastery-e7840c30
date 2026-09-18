# Fix Android OneLink launch

## What will change
- Add a separate Android intent filter for AppsFlyer's `carnivorex://...` marketing destinations without changing the existing authentication filters.
- Update in-app deep-link parsing so `carnivorex://home` and other approved destinations route to the correct screen.
- Preserve the verified HTTPS OneLink filter for `https://carnivorex.onelink.me/kWuX/...`.
- Bump the Android release to version code 22 / version name 1.2.4 because the manifest and bundled app code must change.

## Verification
- Confirm the merged manifest resolves both the HTTPS OneLink and `carnivorex://home` to `MainActivity`.
- Run the focused TypeScript check and production build.
- Provide line-by-line Mac commands to pull, sync, build, install, confirm version 22, verify the domain, and test both link forms before Play upload.

## Technical detail
AppsFlyer's live Android response currently runs an intent redirect to `carnivorex://home`. Version 21 cannot receive that URI because its custom-scheme filter only declares the `auth` and `callback` hosts. Its route parser also treats only the HTTPS OneLink host as a marketing link. Both sides must be corrected in the same release.
