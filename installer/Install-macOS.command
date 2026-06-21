#!/bin/bash
# One-click installer for Mycelium for Solibri (macOS).
# Installs the right app for your Mac into /Applications, ad-hoc signs it, and
# clears the quarantine flag so Gatekeeper lets it open.
set -e
cd "$(dirname "$0")"

# Pick the build matching this Mac's CPU (Apple Silicon vs Intel).
if [ "$(uname -m)" = "arm64" ]; then
  APP="Mycelium for Solibri (Apple Silicon).app"
else
  APP="Mycelium for Solibri (Intel).app"
fi

if [ ! -d "$APP" ]; then
  echo "Could not find \"$APP\" next to this installer."
  read -r -p "Press Enter to close…"
  exit 1
fi

DEST="/Applications/Mycelium for Solibri.app"
echo "Installing \"$APP\" → $DEST"
rm -rf "$DEST"
cp -R "$APP" "$DEST"

# Ad-hoc sign (required for Apple Silicon) and drop the download quarantine.
codesign --force --deep --sign - "$DEST" 2>/dev/null || true
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo ""
echo "Installed. Find \"Mycelium for Solibri\" in your Applications folder."
echo "First launch creates ~/MyceliumForSolibri/solibri.config.json — edit it to"
echo "point at Solibri Desktop's REST API, then launch again."
echo ""
read -r -p "Press Enter to close…"
