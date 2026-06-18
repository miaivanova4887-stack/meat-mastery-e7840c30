## Goal
Get this Lovable project's code (including the committed Google re-login auth fix and the security fixes) onto GitHub so you can clone it locally and rebuild the APK.

## Important constraint (please read first)
Lovable's GitHub integration **creates and syncs to its own brand-new repository**. It **cannot** attach two-way sync to a repo you already created by hand (such as `carnivore-coach-aos`). I cannot click the GitHub button for you either — connecting GitHub is a one-time action you do inside the Lovable UI.

So there are two realistic paths. I recommend **Path 1**.

---

## Path 1 (recommended): Let Lovable create its repo, then clone that
You get true two-way sync (edits in Lovable auto-push, your local pushes auto-sync back). The repo name will be auto-generated, not `carnivore-coach-aos` — that's fine, it's just a name.

### Step 1 — Connect GitHub (in the Lovable editor, not the terminal)
1. In the chat input, click the **Plus (+)** menu (bottom-left).
2. Click **GitHub** → **Connect project**.
3. Authorize the **Lovable GitHub App** when GitHub opens.
4. Choose the GitHub account/organization (`miaivanova4887-stack`).
5. Click **Create Repository**. Wait until Lovable shows the repo link.
6. Copy the repository URL it gives you (looks like `https://github.com/miaivanova4887-stack/<generated-name>.git`).

### Step 2 — Clone it locally (terminal, copy-paste line by line)
```
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/miaivanova4887-stack/<generated-name>.git carnivorex-aos
cd carnivorex-aos
git status
```
`git status` must say `On branch main` and `working tree clean`.

### Step 3 — Build the APK (terminal, line by line)
```
node -v
npm install
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
"$JAVA_HOME/bin/java" -version
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
adb devices
npm run apk:fresh:debug
```
- `node -v` must be ≥ v22.
- `adb devices` must list your plugged-in phone before the last line.
- `apk:fresh:debug` does: clean → web build → patch verify → cap sync → JS-marker verify → minSdk=26 pin → Kotlin compile → APK assemble → SHA256 → auto-install if device connected.

### Step 4 — Evidence-first verification
1. Copy the two **SHA256** lines printed at the end of the build.
2. Stream logs:
```
adb logcat -c
adb logcat -v time | grep -E 'BuildInfo|AuthVerify|authFlow|oauth:|deeplink:'
```
3. Open the app — you **must** see `[BuildInfo] ... authFlow=v8-normalized-callback-parser`. If it's missing, uninstall the old app and re-run Step 3.
4. **Prove the fix:** Sign in with Google → log out → sign in again. On the second callback, `oauth:browser-close` should fire, the in-app browser closes, and you land in the app with **no infinite spinner**.

---

## Path 2 (only if you must use the exact `carnivore-coach-aos` repo)
Use this only if that specific repo URL is a hard requirement. You lose Lovable's automatic two-way sync — you manually mirror code into it.

1. Do **Path 1 Steps 1–2** first (Lovable still needs its own synced repo as the source of truth).
2. Add your existing repo as a second remote and push to it:
```
cd ~/Projects/carnivorex-aos
git remote add mirror https://github.com/miaivanova4887-stack/carnivore-coach-aos.git
git push mirror main
```
3. Every time you want updates in `carnivore-coach-aos` later:
```
cd ~/Projects/carnivorex-aos
git pull origin main
git push mirror main
```
Then build with **Path 1 Step 3** and verify with **Step 4**.

---

## Technical notes
- No code changes are needed: the Google re-login fix is committed in `src/hooks/useDeepLinks.ts` (per-flow `lastBrowserClosedFp` guard), and the build markers live in `src/lib/authFlowBuild.ts`.
- The recent connector/security-scan fixes to the `supabase/functions/*` edge functions are already in the project and will travel with the repo.
- `npm install` runs `patch-package` (speech-recognition ProGuard fix). `minSdkVersion=26` is re-pinned after every `cap sync`. `google-services.json` is intentionally absent (native FCM is gated off).
- The native `android/` source and `capacitor.config.json` (bundles `dist/`, no remote URL) are committed, so a fresh clone builds a fully standalone APK.