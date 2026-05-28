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
# Capacitor 6+ uses an xcodeproj-only setup (no .xcworkspace).
# SwiftPM state lives under the xcodeproj's embedded workspace.
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcuserdata"
rm -rf "$IOS_APP_DIR/App.xcodeproj/xcuserdata"

echo "== Clearing user-level Xcode caches for this app =="
# DerivedData often caches a stale CapApp-SPM product reference between runs.
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/App-"* 2>/dev/null || true
# Safe to remove; SwiftPM will repopulate on next resolve.
rm -rf "$HOME/Library/Caches/org.swift.swiftpm" 2>/dev/null || true

mkdir -p "$LOG_DIR"

echo "== Resolving Swift packages with xcodebuild =="
echo "Command: xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App"
(
  cd "$IOS_APP_DIR"
  xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App 2>&1 | tee "$LOG_FILE"
)

echo ""
echo "== Resolver output saved =="
echo "$LOG_FILE"
