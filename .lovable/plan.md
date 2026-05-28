## Profile → Invite a Friend: Native Share Sheet

Update `src/pages/Profile.tsx` to use the native Capacitor share sheet with CarnivoreX branding.

### Changes
- Import `Share` from `@capacitor/share` and `Capacitor` from `@capacitor/core`.
- Replace the current per-channel button grid with a single "Invite a Friend" button that triggers a unified share handler.
- Update brand references from "Vore" to "CarnivoreX".

### Share handler logic
1. On native (`Capacitor.isNativePlatform()`): call `Share.share({ title, text, url, dialogTitle })` — keep `text` and `url` as separate fields for iOS.
2. On web with Web Share API: `navigator.share({ title, text, url })`.
3. Fallback: copy `text + "\n" + url` to clipboard with a toast confirmation.

### Shared payload
- title: `CarnivoreX`
- text: `Join me on CarnivoreX — recipes, tracking, coaching, and carnivore tools in one app.`
- url: `https://carnivorex.app` (TODO comment to swap for App Store URL when available)

### Out of scope
- No copy/translation changes beyond the brand rename and share text above.
- No design overhaul of the Profile page.
- `@capacitor/share` is already added to package.json from the prior step; user will need `npx cap sync` after pulling.
