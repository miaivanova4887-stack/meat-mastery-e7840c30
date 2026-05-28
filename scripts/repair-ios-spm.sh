#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_APP_DIR="$ROOT_DIR/ios/App"
LOG_DIR="$ROOT_DIR/ios/App/spm-resolution-logs"
LOG_FILE="$LOG_DIR/resolve-$(date +%Y%m%d-%H%M%S).log"

echo "== CarnivoreX iOS SwiftPM repair =="
echo "Project: $ROOT_DIR"
echo "Log: $LOG_FILE"

cd "$ROOT_DIR"

echo "== Installing dependencies and applying patches =="
npm install

echo "== Syncing iOS native project =="
npx cap sync ios

echo "== Clearing project-local SwiftPM/Xcode package state =="
rm -rf "$IOS_APP_DIR/App.xcworkspace/xcshareddata/swiftpm"
rm -rf "$IOS_APP_DIR/App.xcworkspace/xcuserdata"
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcuserdata"
rm -rf "$IOS_APP_DIR/App.xcodeproj/xcuserdata"

mkdir -p "$LOG_DIR"

echo "== Resolving Swift packages with xcodebuild =="
echo "Command: xcodebuild -resolvePackageDependencies -workspace App.xcworkspace -scheme App"
(
  cd "$IOS_APP_DIR"
  xcodebuild -resolvePackageDependencies -workspace App.xcworkspace -scheme App 2>&1 | tee "$LOG_FILE"
)

echo "== Resolver output saved =="
echo "$LOG_FILE"