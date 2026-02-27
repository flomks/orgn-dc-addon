#!/bin/bash
# Create simple colored PNG icons using ImageMagick if available
# Fallback: Create data URIs that work

for size in 16 32 48 128; do
  if command -v convert &> /dev/null; then
    convert -size ${size}x${size} xc:'#5865F2' -fill white -draw "circle $((size/2)),$((size/2)) $((size/2)),$((size/4))" icon${size}.png
  else
    # Copy SVG as fallback
    cp icon${size}.svg icon${size}.png 2>/dev/null || true
  fi
done
