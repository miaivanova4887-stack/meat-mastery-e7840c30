

## Problem

The build fails because some dependencies (e.g. `androidx.activity:activity:1.11.0`) now require `compileSdk 36`, but your `android/app/build.gradle` is set to `35`.

## Fix

Open `android/app/build.gradle` in a text editor and change **one number**:

Find this line:
```
compileSdk 35
```
Change it to:
```
compileSdk 36
```

Leave `targetSdkVersion 35` as-is — only `compileSdk` needs to go up.

Then rebuild:
```bash
npx cap sync android
```
And in Android Studio: **Build → Generate Signed APK** again.

