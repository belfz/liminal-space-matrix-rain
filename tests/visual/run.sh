#!/bin/sh
# Visual regression checks (headless Chrome + SwiftShader). Usage: tests/visual/run.sh
cd "$(dirname "$0")/../.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
T=$(mktemp -d)
fail=0
WIN=$(grep -o 'const WIN = [0-9]*' index.html | grep -o '[0-9]*$')
H=$((WIN / 2))
shot() { tools/shot.sh "$1" "$T/$2.png" 480,270; }
same() { # name a b maxfrac
  r=$(python3 tests/visual/imgdiff.py "$T/$2.png" "$T/$3.png")
  if python3 -c "import sys; sys.exit(0 if $r <= $4 else 1)"; then echo "ok   $1 (diff $r)"; else echo "FAIL $1 (diff $r > $4)"; fail=1; fi
}

# 1. Rain must not change when the map window re-centres (same pose, different window origin).
Q="seed=3&still=1&x=33.5&y=3.5&a=0.3"
shot "$Q&ox=$((33 - H))&oy=$((3 - H))" o1
shot "$Q&ox=$((33 - H + 7))&oy=$((3 - H - 5))" o2
same "origin-stable rain" o1 o2 0.002

# 2. Far walls must not vanish at the window edge just before a re-centre (player 12 tiles past centre).
# Pose with a 29-tile straight sightline along +y (found by search in World for seed 1):
# visible when the window is centred, beyond the edge when the player is 12 tiles past centre.
Q="seed=1&still=1&x=3.5&y=128.5&a=1.5708"
shot "$Q&ox=$((3 - H))&oy=$((128 - H))" e1
shot "$Q&ox=$((3 - H))&oy=$((128 - H - 12))" e2
same "no window-edge void" e1 e2 0.002

# 3. Motes stay put in the world when the player crosses a tile line.
dump() { "$CHROME" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=480,270 \
  --virtual-time-budget=2000 --dump-dom "file://$PWD/index.html?$1" 2>/dev/null \
  | grep -o 'data-mote-world="[^"]*"' | sed 's/data-mote-world="//;s/"$//;s/&quot;/"/g'; }
A=$(dump "seed=1&still=1&x=4.5&y=4.95&a=0"); B=$(dump "seed=1&still=1&x=4.5&y=5.05&a=0")
if python3 -c "
import json,sys
a,b=json.loads(sys.argv[1]),json.loads(sys.argv[2])
ok=all(min(abs(p[k]-q[k]), abs(abs(p[k]-q[k])-12)) < 1e-3 for p,q in zip(a,b) for k in (0,1))
sys.exit(0 if ok and len(a)==len(b)>0 else 1)" "$A" "$B"; then echo "ok   motes world-stable"; else echo "FAIL motes world-stable"; fail=1; fi

# 4. Mouse look works after "click to enter" even when pointer lock is refused.
node tests/visual/mouse-look.mjs "file://$PWD/index.html" || fail=1

# 5. Rain density: 2x means twice the glyph columns on the same wall (half the column spacing).
#    Face-on close wall (seed=2 spawn, facing +y).
shot "seed=2&still=1&a=1.5708&density=1" d1
shot "seed=2&still=1&a=1.5708&density=2" d2
P1=$(python3 tests/visual/colperiod.py "$T/d1.png"); P2=$(python3 tests/visual/colperiod.py "$T/d2.png")
if python3 -c "import sys; r = $P1 / max($P2, 1); sys.exit(0 if $P2 > 0 and 1.7 <= r <= 2.3 else 1)"; then echo "ok   density 2x halves column spacing ($P1 px -> $P2 px)"; else echo "FAIL density 2x halves column spacing ($P1 px -> $P2 px)"; fail=1; fi
node tests/visual/menu.mjs "file://$PWD/index.html" || fail=1

rm -rf "$T"
exit $fail
