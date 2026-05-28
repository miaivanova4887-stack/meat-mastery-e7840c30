#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_APP_DIR="$ROOT_DIR/ios/App"
LOG_DIR="$ROOT_DIR/ios/App/spm-resolution-logs"
LOG_FILE="$LOG_DIR/resolve-$(date +%Y%m%d-%H%M%S).log"
SR_PKG="$ROOT_DIR/node_modules/@capacitor-community/speech-recognition/Package.swift"

echo "== CarnivoreX iOS SwiftPM repair =="
echo "Project: $ROOT_DIR"
echo "Log:     $LOG_FILE"

cd "$ROOT_DIR"

echo ""
echo "== Step 1/6: npm install (runs postinstall patch-package) =="
npm install

echo ""
echo "== Step 2/6: Force-run patch-package explicitly =="
npx patch-package || true

echo ""
echo "== Step 3/6: Verify speech-recognition Package.swift is patched =="
if [ ! -f "$SR_PKG" ]; then
  echo "FATAL: $SR_PKG not found. Aborting."
  exit 1
fi
echo "--- current contents of speech-recognition Package.swift ---"
grep -n "capacitor-swift-pm" "$SR_PKG" || true
echo "------------------------------------------------------------"

# Fallback: rewrite the SwiftPM dependency in-place if the patch did not apply.
# We accept any "from: \"8.x\"" (compatible with CapApp-SPM 8.3.x exact pin).
if ! grep -q 'capacitor-swift-pm.git", from: "8' "$SR_PKG" \
   && ! grep -q 'capacitor-swift-pm.git", exact: "8' "$SR_PKG"; then
  echo "patch-package did NOT apply (still on incompatible version)."
  echo "Applying inline fallback rewrite of speech-recognition Package.swift..."
  # Replace any capacitor-swift-pm line with a compatible 8.x from: clause.
  /usr/bin/sed -i.bak -E \
    's|\.package\(url: "https://github\.com/ionic-team/capacitor-swift-pm\.git",[^)]*\)|.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.3.0")|' \
    "$SR_PKG"
  rm -f "$SR_PKG.bak"
  echo "--- after fallback rewrite ---"
  grep -n "capacitor-swift-pm" "$SR_PKG" || true
  echo "------------------------------"
fi

# Hard assertion: must be a compatible 8.x reference now.
if ! grep -qE 'capacitor-swift-pm\.git", (from|exact): "8\.' "$SR_PKG"; then
  echo "FATAL: speech-recognition Package.swift is still not on capacitor-swift-pm 8.x."
  echo "Aborting before xcodebuild — fix the file above and re-run."
  exit 1
fi
echo "OK: speech-recognition is on capacitor-swift-pm 8.x (compatible with CapApp-SPM)."

echo ""
echo "== Step 4/6: npx cap sync ios (regenerates CapApp-SPM/Package.swift) =="
npx cap sync ios

echo ""
echo "== Step 5/6: Clear SwiftPM/Xcode caches =="
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
rm -rf "$IOS_APP_DIR/App.xcodeproj/project.xcworkspace/xcuserdata"
rm -rf "$IOS_APP_DIR/App.xcodeproj/xcuserdata"
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/App-"* 2>/dev/null || true
rm -rf "$HOME/Library/Caches/org.swift.swiftpm" 2>/dev/null || true

echo ""
echo "== Evidence before resolve =="
echo "--- CapApp-SPM/Package.swift capacitor-swift-pm line ---"
grep -n "capacitor-swift-pm" "$IOS_APP_DIR/CapApp-SPM/Package.swift" || true
echo "--- speech-recognition/Package.swift capacitor-swift-pm line ---"
grep -n "capacitor-swift-pm" "$SR_PKG" || true
echo "---------------------------------------------------------"

mkdir -p "$LOG_DIR"

echo ""
echo "== Step 6/6: Resolving Swift packages with xcodebuild =="
echo "Command: xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App"
(
  cd "$IOS_APP_DIR"
  xcodebuild -resolvePackageDependencies -project App.xcodeproj -scheme App 2>&1 | tee "$LOG_FILE"
)

echo ""
echo "== Resolver output saved =="
echo "$LOG_FILE"
