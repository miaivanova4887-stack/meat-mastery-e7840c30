# Add AppsFlyer OneLink deep links to Android

## What this does
Marketing links from `carnivorex.onelink.me` will open your app directly instead of bouncing to a browser page. This is what AppsFlyer needs for install/re-engagement attribution.

## Changes
1. In `android/app/src/main/AndroidManifest.xml`, add a new `intent-filter` inside the existing `MainActivity` block, kept separate from the current `aos.carnivorex.app` App Link filter:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="carnivorex.onelink.me" />
</intent-filter>
```

It stays a separate filter so it cannot interfere with verification of the existing auth callback links.

2. Bump the app version in `android/app/build.gradle` to versionCode 18 / versionName 1.2.0, since a manifest change requires a new build to take effect.

## Notes on verification
- Android verifies ownership through the assetlinks file hosted on `carnivorex.onelink.me`, which AppsFlyer serves. Your app's signing fingerprints must be listed in the AppsFlyer OneLink setup (Play App Signing SHA-256 plus your upload key). No file changes on our side for that.
- Nothing in the existing deep-link handling needs to change: the app already listens for incoming links at launch and on resume, and unknown paths fall through to the home screen.

## After approval you will need to
Rebuild and reinstall/resubmit the Android app. I will give you the exact line-by-line terminal commands once the code change is in.
