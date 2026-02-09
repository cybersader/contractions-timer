#!/usr/bin/env bash
# Generate PWA PNG icons from icon.svg
# Requires: Inkscape, ImageMagick (convert), or rsvg-convert
# Run from web/ directory

set -euo pipefail
cd "$(dirname "$0")/.."

if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 192 -h 192 public/icon.svg -o public/icon-192.png
  rsvg-convert -w 512 -h 512 public/icon.svg -o public/icon-512.png
  cp public/icon-192.png public/apple-touch-icon.png
  echo "Icons generated with rsvg-convert"
elif command -v convert &>/dev/null; then
  convert -background none -resize 192x192 public/icon.svg public/icon-192.png
  convert -background none -resize 512x512 public/icon.svg public/icon-512.png
  cp public/icon-192.png public/apple-touch-icon.png
  echo "Icons generated with ImageMagick"
else
  echo "No SVG-to-PNG tool found. Install librsvg2-bin or imagemagick."
  echo "Creating placeholder PNGs from favicon.svg..."
  # Fallback: copy SVG as-is (browsers handle SVG icons)
  cp public/icon.svg public/icon-192.svg
  cp public/icon.svg public/icon-512.svg
  echo "SVG icons copied. Replace with PNGs for full PWA support."
  exit 1
fi

echo "Done: icon-192.png, icon-512.png, apple-touch-icon.png"
