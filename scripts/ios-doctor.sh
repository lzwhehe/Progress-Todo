#!/usr/bin/env bash
set -euo pipefail

echo "Progress Todo iOS environment check"
echo

if [[ -d /Applications/Xcode.app ]]; then
  echo "✓ Xcode found: /Applications/Xcode.app"
else
  echo "✗ Xcode.app was not found in /Applications"
  echo "  Install Xcode from the App Store, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

developer_dir="$(xcode-select -p 2>/dev/null || true)"
if [[ "$developer_dir" == "/Applications/Xcode.app/Contents/Developer" ]]; then
  echo "✓ xcode-select points to full Xcode"
else
  echo "✗ xcode-select currently points to: ${developer_dir:-not configured}"
  echo "  Run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

xcodebuild -version
xcrun simctl list devices available | sed -n '1,24p'

echo
echo "Next steps:"
echo "  npm run ios:open"
echo "  Select your Apple Development Team in Xcode"
echo "  Run the App target on an iPhone simulator or device"
