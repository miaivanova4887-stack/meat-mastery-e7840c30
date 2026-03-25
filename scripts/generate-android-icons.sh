#!/usr/bin/env bash
set -euo pipefail

# Generates Android adaptive icon resources from public/app-icon.png
# Requires ImageMagick (install via: brew install imagemagick)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/public/app-icon.png"
RES_DIR="$ROOT_DIR/android/app/src/main/res"

if [[ ! -f "$SRC" ]]; then
  echo "❌ Source icon not found: $SRC"
  exit 1
fi

declare -A SIZES=(
  [mipmap-mdpi]=48
  [mipmap-hdpi]=72
  [mipmap-xhdpi]=96
  [mipmap-xxhdpi]=144
  [mipmap-xxxhdpi]=192
)

for folder in "${!SIZES[@]}"; do
  size=${SIZES[$folder]}
  dir="$RES_DIR/$folder"
  mkdir -p "$dir"
  convert "$SRC" -resize "${size}x${size}" "$dir/ic_launcher.png"
  convert "$SRC" -resize "${size}x${size}" "$dir/ic_launcher_round.png"
  convert "$SRC" -resize "${size}x${size}" "$dir/ic_launcher_foreground.png"
  echo "✅ $folder: ${size}x${size}"
done

echo "🎉 All Android icons generated!"
