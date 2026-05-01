#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
PLUGIN_SRC="$ROOT_DIR/native-plugins/android/src/main/java/app/lovable/plugins/healthconnect/HealthConnectPlugin.kt"
PLUGIN_DEST_DIR="$ANDROID_DIR/app/src/main/java/app/lovable/plugins/healthconnect"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "❌ Android project not found at: $ANDROID_DIR"
  exit 1
fi

echo "🧹 Cleaning web + Android build artifacts (incl. Gradle project cache)..."
rm -rf "$ROOT_DIR/dist" "$ANDROID_DIR/app/src/main/assets/public" "$ANDROID_DIR/app/build" "$ANDROID_DIR/.gradle"

echo "📦 Building web assets..."
npm run build

echo "🩹 Ensuring node_modules patches are applied..."
(cd "$ROOT_DIR" && npx patch-package)

PLUGIN_GRADLE="$ROOT_DIR/node_modules/@capacitor-community/speech-recognition/android/build.gradle"
echo "🔎 Verifying speech-recognition ProGuard patch..."
if [[ ! -f "$PLUGIN_GRADLE" ]]; then
  echo "❌ Missing plugin gradle file: $PLUGIN_GRADLE"
  echo "   Did 'npm install' run? Aborting before Gradle."
  exit 1
fi
if ! grep -q "proguard-android-optimize.txt" "$PLUGIN_GRADLE"; then
  echo "❌ Patch not applied: $PLUGIN_GRADLE still references the removed 'proguard-android.txt'."
  echo "   Expected 'proguard-android-optimize.txt' (see patches/@capacitor-community+speech-recognition+7.0.1.patch)."
  echo "   Try: rm -rf node_modules && npm install && npx patch-package"
  exit 1
fi
if grep -q "getDefaultProguardFile('proguard-android.txt')" "$PLUGIN_GRADLE"; then
  echo "❌ Stale reference to 'proguard-android.txt' still present in $PLUGIN_GRADLE."
  exit 1
fi
echo "✅ Patch verified: proguard-android-optimize.txt present"

echo "🔄 Syncing Capacitor Android project..."
npx cap sync android

# CRITICAL: verify the synced JS bundle actually contains the latest auth-callback
# fixes. If `dist/` was stale or `cap sync` copied the wrong tree, the APK would
# silently ship old JS and we'd debug ghosts (see prior incident: stale APK ran
# old refreshSession-only callback for 3 build cycles).
SYNCED_ASSETS_DIR="$ANDROID_DIR/app/src/main/assets/public/assets"
echo "🔎 Verifying synced web bundle contains latest auth-callback code..."
if [[ ! -d "$SYNCED_ASSETS_DIR" ]]; then
  echo "❌ Synced assets directory missing: $SYNCED_ASSETS_DIR"
  exit 1
fi
REQUIRED_MARKERS=(
  "callback:verifyOtp-call"
  "deeplink:launch-url"
  "BuildInfo"
  "build-version"
)
for marker in "${REQUIRED_MARKERS[@]}"; do
  if ! grep -qrl "$marker" "$SYNCED_ASSETS_DIR"; then
    echo "❌ Synced bundle is MISSING required marker: $marker"
    echo "   Searched: $SYNCED_ASSETS_DIR"
    echo "   This means the APK would ship stale JS. Aborting."
    echo "   Likely causes: dist/ not rebuilt, or cap sync used a cached copy."
    exit 1
  fi
done
SYNCED_BUNDLE=$(ls -1 "$SYNCED_ASSETS_DIR"/index-*.js 2>/dev/null | head -1 || true)
echo "✅ Synced bundle verified: $(basename "${SYNCED_BUNDLE:-unknown}")"
if [[ -n "$SYNCED_BUNDLE" ]] && command -v shasum >/dev/null 2>&1; then
  echo "🔐 Bundle SHA256: $(shasum -a 256 "$SYNCED_BUNDLE" | awk '{print $1}')"
fi

# Capacitor sync regenerates android/variables.gradle with minSdkVersion = 24,
# but androidx.health.connect:connect-client requires minSdk >= 26. Re-pin it
# here so every fresh build self-heals.
VARIABLES_GRADLE="$ANDROID_DIR/variables.gradle"
echo "🔎 Pinning minSdkVersion = 26 in variables.gradle (Health Connect requirement)..."
if [[ ! -f "$VARIABLES_GRADLE" ]]; then
  echo "❌ Missing $VARIABLES_GRADLE after cap sync"
  exit 1
fi
sed -i.bak -E 's/(minSdkVersion[[:space:]]*=[[:space:]]*)[0-9]+/\126/' "$VARIABLES_GRADLE"
rm -f "$VARIABLES_GRADLE.bak"
if ! grep -qE "minSdkVersion[[:space:]]*=[[:space:]]*26" "$VARIABLES_GRADLE"; then
  echo "❌ Failed to pin minSdkVersion = 26 in $VARIABLES_GRADLE"
  exit 1
fi
echo "✅ minSdkVersion = 26 confirmed"

APP_GRADLE="$ANDROID_DIR/app/build.gradle"
echo "🔎 Verifying kotlin-android plugin is applied in app/build.gradle..."
if ! grep -q "apply plugin: 'kotlin-android'" "$APP_GRADLE"; then
  echo "⚠️  kotlin-android plugin missing after cap sync — restoring it."
  # Insert right after the com.android.application apply line
  awk 'NR==1 && /com.android.application/ {print; print "apply plugin: '\''kotlin-android'\''"; next} {print}' "$APP_GRADLE" > "$APP_GRADLE.tmp" && mv "$APP_GRADLE.tmp" "$APP_GRADLE"
  if ! grep -q "apply plugin: 'kotlin-android'" "$APP_GRADLE"; then
    echo "❌ Could not restore kotlin-android plugin in $APP_GRADLE"
    exit 1
  fi
fi
echo "✅ kotlin-android plugin present"

if [[ -f "$PLUGIN_SRC" ]]; then
  # NOTE: The destination file is GENERATED on every build and is git-ignored
  # (see .gitignore). Never edit it directly — edit $PLUGIN_SRC instead.
  echo "🧩 Copying native Health Connect plugin (generated, do not edit destination)..."
  mkdir -p "$PLUGIN_DEST_DIR"
  cp "$PLUGIN_SRC" "$PLUGIN_DEST_DIR/HealthConnectPlugin.kt"

  # Guard against stale native source — fail loudly if the latest fixes
  # (365-day weight window + latest-record diagnostic + safe permission
  # contract) didn't make it into the copied file.
  COPIED="$PLUGIN_DEST_DIR/HealthConnectPlugin.kt"
  for marker in "readWeight latest" "365L \* 24L \* 60L \* 60L" "PermissionController.createRequestPermissionResultContract"; do
    if ! grep -q "$marker" "$COPIED"; then
      echo "❌ Native HealthConnectPlugin.kt is missing required fix marker: $marker"
      echo "   Source: $PLUGIN_SRC"
      echo "   Aborting before producing a stale APK."
      exit 1
    fi
  done
  # Reject the broken Android-14 manual intent path
  if grep -q 'android.health.connect.action.REQUEST_HEALTH_PERMISSIONS' "$COPIED"; then
    echo "❌ Native plugin still launches the manual REQUEST_HEALTH_PERMISSIONS intent."
    echo "   This causes a SecurityException on Samsung Android 14 devices."
    exit 1
  fi
  echo "✅ Native HealthConnectPlugin.kt fix markers present"
fi

echo "🎨 Copying app launcher icons..."
ICON_SRC="$ROOT_DIR/public/android-icons"
RES_DIR="$ANDROID_DIR/app/src/main/res"
if [[ -d "$ICON_SRC" ]]; then
  for folder in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
    dest="$RES_DIR/$folder"
    mkdir -p "$dest"
    cp "$ICON_SRC/$folder/"*.png "$dest/"
  done

  # Copy adaptive icon XMLs
  ANYDPI_SRC="$ICON_SRC/mipmap-anydpi-v26"
  ANYDPI_DEST="$RES_DIR/mipmap-anydpi-v26"
  if [[ -d "$ANYDPI_SRC" ]]; then
    mkdir -p "$ANYDPI_DEST"
    cp "$ANYDPI_SRC/"*.xml "$ANYDPI_DEST/"
  fi

  # Copy color resource for adaptive icon background
  VALUES_SRC="$ICON_SRC/values"
  VALUES_DEST="$RES_DIR/values"
  if [[ -d "$VALUES_SRC" ]]; then
    mkdir -p "$VALUES_DEST"
    cp "$VALUES_SRC/colors.xml" "$VALUES_DEST/"
  fi

  echo "✅ Icons + adaptive XMLs copied"

  # Build-time validation: ensure adaptive icon resources exist
  if [[ ! -f "$ANYDPI_DEST/ic_launcher.xml" ]]; then
    echo "❌ Missing adaptive icon XML: $ANYDPI_DEST/ic_launcher.xml"
    exit 1
  fi
  if [[ ! -f "$VALUES_DEST/colors.xml" ]]; then
    echo "❌ Missing icon background color: $VALUES_DEST/colors.xml"
    exit 1
  fi
  echo "✅ Adaptive icon validation passed"
fi

echo "🛠️  Pre-compiling Kotlin to verify HealthConnectPlugin produces a class file..."
(cd "$ANDROID_DIR" && ./gradlew :app:compileDebugKotlin --no-build-cache --rerun-tasks)

KOTLIN_CLASS="$ANDROID_DIR/app/build/tmp/kotlin-classes/debug/app/lovable/plugins/healthconnect/HealthConnectPlugin.class"
if [[ ! -f "$KOTLIN_CLASS" ]]; then
  echo "❌ Kotlin compile produced no class file at:"
  echo "   $KOTLIN_CLASS"
  echo "   This means the .kt file is not being seen by the Kotlin compiler."
  echo "   Check that 'apply plugin: kotlin-android' is at the top of android/app/build.gradle"
  echo "   and that the file lives under android/app/src/main/java/app/lovable/plugins/healthconnect/."
  exit 1
fi
echo "✅ HealthConnectPlugin.class generated"

echo "🏗️ Assembling fresh debug APK (no cache)..."
(cd "$ANDROID_DIR" && ./gradlew :app:assembleDebug --no-build-cache --rerun-tasks)

if [[ ! -f "$APK_PATH" ]]; then
  echo "❌ APK build failed. Expected file not found: $APK_PATH"
  exit 1
fi

echo "✅ Fresh APK ready: $APK_PATH"
if command -v shasum >/dev/null 2>&1; then
  echo "🔐 APK SHA256:"
  shasum -a 256 "$APK_PATH"
fi

# Optional: install + verify on a connected device. Skip silently if no adb/device.
if command -v adb >/dev/null 2>&1 && [[ -n "$(adb devices | awk 'NR>1 && $2=="device"{print $1}')" ]]; then
  echo "📲 Installing APK on connected device..."
  adb install -r "$APK_PATH" >/dev/null
  INSTALLED_VERSION=$(adb shell dumpsys package com.mi4labs.carnivorex 2>/dev/null | awk -F'=' '/versionName=/{print $2; exit}')
  echo "✅ Installed. versionName=${INSTALLED_VERSION:-unknown}"
  echo ""
  echo "👉 Now run:  adb logcat -c && adb logcat -v time | grep -E 'BuildInfo|AuthVerify'"
  echo "   Open the app — you MUST see [BuildInfo] fingerprint=build-<timestamp>"
  echo "   If the fingerprint is older than this build, the install did not take."
else
  echo ""
  echo "ℹ️  No adb device detected — install manually with:"
  echo "    adb install -r $APK_PATH"
fi

echo ""
echo "Tip: uninstall old app from device before installing this APK if you see stale behavior."