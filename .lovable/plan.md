# Debug fingerprint check: already trusted

Your debug signing fingerprint

```text
A7:2B:BF:99:5D:D5:1D:0C:03:F0:4B:4F:24:CF:BF:93:7A:9B:6E:7F:FD:60:EB:00:B0:F7:83:4C:9F:F2:CE:A1
```

is already the first entry in the live `assetlinks.json` served at `https://aos.carnivorex.app/.well-known/assetlinks.json` (verified just now, HTTP 200). No code or file changes are required.

## Next step: rebuild and verify (run on your Mac, one line at a time)

```bash
cd ~/Desktop/carnivorex-android
```
```bash
git pull origin main
```
```bash
npm run apk:fresh:debug
```
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
```bash
adb shell pm verify-app-links --re-verify com.mi4labs.carnivorex
```
```bash
adb shell pm get-app-links com.mi4labs.carnivorex
```

Expected: `aos.carnivorex.app: verified`.

Then open the app, tap **Continue with Google**, complete login. Expected: Chrome closes and the app resumes signed in, with no Lovable-branded web page.

If `get-app-links` shows anything other than `verified`, paste its full output and I will diagnose from there.
