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

echo "🧹 Cleaning web + Android build artifacts..."
rm -rf "$ROOT_DIR/dist" "$ANDROID_DIR/app/src/main/assets/public" "$ANDROID_DIR/app/build"

echo "📦 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor Android project..."
npx cap sync android

if [[ -f "$PLUGIN_SRC" ]]; then
  echo "🧩 Copying native Health Connect plugin..."
  mkdir -p "$PLUGIN_DEST_DIR"
  cp "$PLUGIN_SRC" "$PLUGIN_DEST_DIR/HealthConnectPlugin.kt"
fi

echo "🏗️ Assembling fresh debug APK (no cache)..."
(cd "$ANDROID_DIR" && ./gradlew clean :app:assembleDebug --no-build-cache --rerun-tasks)

if [[ ! -f "$APK_PATH" ]]; then
  echo "❌ APK build failed. Expected file not found: $APK_PATH"
  exit 1
fi

echo "✅ Fresh APK ready: $APK_PATH"
if command -v shasum >/dev/null 2>&1; then
  echo "🔐 SHA256:"
  shasum -a 256 "$APK_PATH"
fi

echo "Tip: uninstall old app from device before installing this APK."