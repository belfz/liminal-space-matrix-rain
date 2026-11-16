#!/bin/sh
# Usage: tools/shot.sh "<query>" <out.png> [WxH]
# Headless Chrome screenshot of index.html (software WebGL via SwiftShader).
set -e
cd "$(dirname "$0")/.."
SIZE="${3:-1280,720}"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size="$SIZE" --virtual-time-budget=3000 \
  --screenshot="$2" "file://$PWD/index.html?$1" 2>/dev/null
