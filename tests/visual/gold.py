"""Fraction of 'gold' pixels (warm: red clearly above green, not dark). The green world never has
red above green, so this measures the golden hands. Usage: gold.py <png> [x0 x1]  (optional column band, fractions of width)"""
import struct, subprocess, sys, tempfile, os
out = os.path.join(tempfile.mkdtemp(), 'x.bmp')
subprocess.run(['sips', '-s', 'format', 'bmp', sys.argv[1], '--out', out], check=True, capture_output=True)
b = open(out, 'rb').read()
off, = struct.unpack_from('<I', b, 10); w, h = struct.unpack_from('<ii', b, 18); n = struct.unpack_from('<H', b, 28)[0] // 8
h = abs(h); row = (w * n + 3) & ~3
x0 = int(float(sys.argv[2]) * w) if len(sys.argv) > 3 else 0
x1 = int(float(sys.argv[3]) * w) if len(sys.argv) > 3 else w
gold = 0
for y in range(h):
    r0 = off + y * row
    for x in range(x0, x1):
        bl, g, r = b[r0 + x * n], b[r0 + x * n + 1], b[r0 + x * n + 2]
        if r > 60 and r > 1.1 * g: gold += 1
print(f'{gold / ((x1 - x0) * h):.5f}')
