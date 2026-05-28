#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_APP_DIR="$ROOT_DIR/ios/App"
CAPAPP_PKG="$IOS_APP_DIR/CapApp-SPM/Package.swift"
SR_PKG="$ROOT_DIR/node_modules/@capacitor-community/speech-recognition/Package.swift"
LOG_DIR="$IOS_APP_DIR/spm-resolution-logs"
LOG_FILE="$LOG_DIR/resolve-$(date +%Y%m%d-%H%M%S).log"

echo "== CarnivoreX iOS SwiftPM repair =="
echo "Project: $ROOT_DIR"
echo "Log:     $LOG_FILE"

cd "$ROOT_DIR"

echo ""
echo "== Step 1/7: npm install (runs postinstall patch-package) =="
npm install

echo ""
echo "== Step 2/7: Force-run patch-package explicitly =="
npx patch-package || true

echo ""
echo "== Step 3/7: npx cap sync ios (regenerates CapApp-SPM/Package.swift) =="
npx cap sync ios

if [ ! -f "$CAPAPP_PKG" ]; then
  echo "FATAL: $CAPAPP_PKG not found after cap sync. Aborting."
  exit 1
fi
if [ ! -f "$SR_PKG" ]; then
  echo "FATAL: $SR_PKG not found. Aborting."
  exit 1
fi

echo ""
echo "== Step 4/7: Detect required capacitor-swift-pm version from CapApp-SPM =="
# Extract the version string from a line like:
#   .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.3.4"),
REQUIRED_VERSION="$(grep -E 'capacitor-swift-pm\.git"' "$CAPAPP_PKG" \
  | head -n1 \
  | sed -E 's/.*(exact|from): "([0-9]+\.[0-9]+\.[0-9]+)".*/\2/')"

if [ -z "$REQUIRED_VERSION" ]; then
  echo "FATAL: Could not parse capacitor-swift-pm version from $CAPAPP_PKG."
  grep -n "capacitor-swift-pm" "$CAPAPP_PKG" || true
  exit 1
fi
echo "CapApp-SPM requires capacitor-swift-pm exact: \"$REQUIRED_VERSION\""

echo ""
echo "== Step 5/7: Force speech-recognition Package.swift to exact: \"$REQUIRED_VERSION\" =="
echo "--- before rewrite ---"
grep -n "capacitor-swift-pm" "$SR_PKG" || true

/usr/bin/sed -i.bak -E \
  "s|\\.package\\(url: \"https://github\\.com/ionic-team/capacitor-swift-pm\\.git\",[^)]*\\)|.package(url: \"https://github.com/ionic-team/capacitor-swift-pm.git\", exact: \"$REQUIRED_VERSION\")|" \
  "$SR_PKG"
rm -f "$SR_PKG.bak"

echo "--- after rewrite ---"
grep -n "capacitor-swift-pm" "$SR_PKG" || true

# Hard assertion: speech-recognition must now pin the exact same version.
SR_VERSION="$(grep -E 'capacitor-swift-pm\.git"' "$SR_PKG" \
  | head -n1 \
  | sed -E 's/.*(exact|from): "([0-9]+\.[0-9]+\.[0-9]+)".*/\2/')"

echo ""
echo "== Evidence before resolve =="
printf "CapApp-SPM requires:          %s\n" "$REQUIRED_VERSION"
printf "speech-recognition requires: %s\n" "$SR_VERSION"

if [ "$SR_VERSION" != "$REQUIRED_VERSION" ]; then
  echo "FATAL: Versions still do not match. Aborting before xcodebuild."
  exit 1
fi
echo "OK: SwiftPM versions match."

echo ""
echo "== Step 6/7: Clear SwiftPM/Xcode caches =="
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcuserdata"
rm -rf "$IOS_APP_DIR/App.xcodeproj/xcuserdata"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/App-"* 2>/dev/null || true
rm -rf "$HOME/Library/Caches/org.swift.swiftpm" 2>/dev/null || true

mkdir -p "$LOG_DIR"

echo ""
echo "== Step 7/7: Resolving Swift packages with xcodebuild =="
echo "Command: xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App"
(
  cd "$IOS_APP_DIR"
  xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App 2>&1 | tee "$LOG_FILE"
)

echo ""
echo "== Resolver output saved =="
echo "$LOG_FILE"
