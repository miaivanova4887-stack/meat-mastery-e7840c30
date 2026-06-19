## Direct answer

GitHub is connected, so a repo already exists under `**miaivanova4887-stack**`. The sandbox cannot print its github.com name (its internal remote points at Lovable's private storage), so you grab the exact URL from one of two places below, then clone and build from it. That repo — the one Lovable two-way syncs — is what you build the APK from (not the hand-made `carnivore-coach-aos`).

---

## Step 0 — Find the exact repo URL (pick ONE)

**Option A — from inside Lovable (fastest):**

1. Click the **Plus (+)** menu (bottom-left of the chat input).
2. Click **GitHub**.
3. It shows the connected repository with an **Open in GitHub** / repo link. Click it.
4. On GitHub, click the green **Code** button → copy the **HTTPS** URL (ends in `.git`).

**Option B — from GitHub directly:**

1. Open `https://github.com/miaivanova4887-stack?tab=repositories` in your browser.
2. Find the repo Lovable created for this project (most recently updated).
3. Open it → green **Code** button → copy the **HTTPS** URL.

You now have a URL:

[https://github.com/miaivanova4887-stack/meat-mastery.git](https://github.com/miaivanova4887-stack/meat-mastery.git)

```
https://github.com/miaivanova4887-stack/<repo-name>.git
```

---

## Step 1 — Clone it (copy-paste line by line)

Replace `<repo-name>` with what you copied in Step 0.

```
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/miaivanova4887-stack/<repo-name>.git carnivorex-aos
cd carnivorex-aos
git status
```

`git status` must print `On branch main` and `working tree clean`.

If the folder already exists from before, update instead of cloning:

```
cd ~/Projects/carnivorex-aos
git pull origin main
git status
```

---

## Step 2 — Build the APK (line by line)

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
- `apk:fresh:debug` does: clean → web build → patch verify → cap sync → JS-marker verify → re-pin `minSdk=26` → Kotlin compile → APK assemble → print SHA256 → auto-install if a device is connected.

---

## Step 3 — Evidence-first verification

Open a second terminal tab:

```
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
adb logcat -c
adb logcat -v time | grep -E 'BuildInfo|AuthVerify|authFlow|oauth:|deeplink:'
```

- Copy the two **SHA256** lines printed at the end of the build.
- Launch the app — you **must** see `[BuildInfo] ... authFlow=v8-normalized-callback-parser`. If it's missing, uninstall the old app and re-run Step 2.
- **Prove the Google re-login fix:** Sign in with Google → log out → sign in with Google again. On the second callback, `oauth:browser-close` fires, the in-app browser closes, and you land in the app with **no infinite spinner**.

---

## Technical notes

- No code changes needed: auth fix is in `src/hooks/useDeepLinks.ts` (per-flow `lastBrowserClosedFp` guard); build markers in `src/lib/authFlowBuild.ts`.
- `npm install` runs `patch-package` (speech-recognition ProGuard fix). `minSdkVersion=26` is re-pinned after every `cap sync`. `google-services.json` is intentionally absent (native FCM gated off).
- Native `android/` source and `capacitor.config.json` are committed, so a fresh clone builds a fully standalone APK.