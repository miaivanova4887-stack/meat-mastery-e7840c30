# Goal

Pull this project's latest code (including the Google re-login infinite-buffering fix in `src/hooks/useDeepLinks.ts`) onto your Mac and rebuild + verify the Android debug APK.

Key facts (already confirmed):
- You cannot reuse another project's repo. Each Lovable project syncs to its **own** GitHub repo. This project isn't connected yet, so you connect it once (creates a new repo), then clone.
- The native `android/` project source is committed to the repo, and `capacitor.config.json` bundles `dist/` (no remote URL), so a fresh clone builds a standalone APK.
- Your Mac already has Android Studio, the SDK, `adb`, and Node 22+ installed.

---

## Part A — Connect THIS project to GitHub (in Lovable, no terminal)

1. In the Lovable editor, click the **plus (+) icon** at the bottom-left of the chat input.
2. Click **GitHub** → **Connect project**.
3. On GitHub, click **Authorize the Lovable GitHub App** (sign in if asked).
4. Choose the GitHub account/organization for the new repo.
5. Back in Lovable, click **Create Repository**.
6. Open the new repo on GitHub and **copy its URL**, e.g. `https://github.com/YOUR-USERNAME/carnivorex-aos.git`.

From now on, my changes auto-push to that repo and your pushes auto-sync back.

## Part B — Clone fresh (terminal, one line at a time)

```
cd ~
```
```
mkdir -p ~/Projects
```
```
cd ~/Projects
```
```
git clone https://github.com/YOUR-USERNAME/carnivorex-aos.git
```
```
cd carnivorex-aos
```
```
git status
```
Expect: `On branch main` and `nothing to commit, working tree clean`.

## Part C — Build the APK

```
git pull
```
```
node -v
```
(Must be `v22` or higher.)
```
npm install
```
```
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```
```
"$JAVA_HOME/bin/java" -version
```
```
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
```
Plug in the phone (USB debugging on), then:
```
adb devices
```
(Device should show with `device` next to it.)
```
npm run apk:fresh:debug
```
This one command runs: clean → web build → patch verify → `cap sync` → JS-marker verify → minSdk=26 pin → Kotlin compile → assemble debug APK → SHA256 → auto-install if a device is connected.

## Part D — Evidence-first verification (non-negotiable)

1. Copy the two SHA256 lines printed at the end (`🔐 Bundle SHA256:` and `🔐 APK SHA256:`) and save them.
2. Stream logs:
```
adb logcat -c && adb logcat -v time | grep -E 'BuildInfo|AuthVerify|authFlow|oauth:|deeplink:'
```
3. Open the app. You **must** see:
```
[BuildInfo] ... authFlow=v8-normalized-callback-parser
```
If missing or older than this build, the install didn't take — uninstall the old app and re-run `npm run apk:fresh:debug`.
4. Prove the fix: sign in with Google → log out from Profile → sign in with Google **again**. The second sign-in should close the in-app browser and land in the app (no infinite spinner).

## Part E — Future updates

After I make more changes here:
```
cd ~/Projects/carnivorex-aos
```
```
git pull
```
```
npm install
```
```
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```
```
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
```
```
npm run apk:fresh:debug
```
Then repeat Part D verification.

---

## Technical notes

- No code changes are required for this task — it's a connect/clone/build runbook. The auth fix is already committed in `src/hooks/useDeepLinks.ts` and will be present after `git pull`.
- `npm install` runs `postinstall` → `patch-package`, applying the speech-recognition ProGuard patch the build script verifies.
- The build script re-pins `minSdkVersion = 26` after every `cap sync` (Health Connect requirement), so no manual Gradle edits are needed.
- `google-services.json` is intentionally absent; native FCM is gated off, so its absence will not break the build.
