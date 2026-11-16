"""Glyph-column spacing (px) on a wall seen face-on: the period of the column brightness profile,
found by autocorrelation. Usage: colperiod.py <png>  (uses the middle band of rows)."""
import struct, subprocess, sys, tempfile, os
out = os.path.join(tempfile.mkdtemp(), 'x.bmp')
subprocess.run(['sips', '-s', 'format', 'bmp', sys.argv[1], '--out', out], check=True, capture_output=True)
b = open(out, 'rb').read()
off, = struct.unpack_from('<I', b, 10); w, h = struct.unpack_from('<ii', b, 18); n = struct.unpack_from('<H', b, 28)[0] // 8
h = abs(h); row = (w * n + 3) & ~3
prof = [0.0] * w
for y in range(h // 4, 3 * h // 4):
    r = off + y * row
    for x in range(w):
        prof[x] += b[r + x * n + 1]  # green channel
m = sum(prof) / w
p = [v - m for v in prof]
def ac(l): return sum(p[i] * p[i + l] for i in range(w - l)) / (w - l)
a0 = ac(0)
vals = [ac(l) for l in range(w // 3)]
# first local maximum after the first dip below zero, strong enough to be the column period
dipped = False
for l in range(2, len(vals) - 1):
    if vals[l] < 0: dipped = True
    if dipped and vals[l] > vals[l - 1] and vals[l] >= vals[l + 1] and vals[l] > 0.15 * a0:
        print(l); break
else:
    print(0)
