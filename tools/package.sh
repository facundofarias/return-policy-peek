#!/usr/bin/env bash
# Package the extension into a Chrome Web Store-ready ZIP (manifest.json at root,
# runtime files only — no docs, tests, tooling, or VCS files).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/return-policy-peek-${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"

zip -r -X "$OUT" \
  manifest.json \
  popup.html popup.css popup.js \
  background.js \
  src \
  _locales \
  icons \
  -x "*.DS_Store"

echo "Packaged -> $OUT"
unzip -l "$OUT" | tail -n +2
