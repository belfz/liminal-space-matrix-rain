"""Fraction of 'gold' pixels (warm: red clearly above green, not dark). The green world never has
red above green, so this measures the golden hands. Usage: gold.py <png>"""
import struct, subprocess, sys, tempfile, os
out = os.path.join(tempfile.mkdtemp(), 'x.bmp')
subprocess.run(['sips', '-s', 'format', 'bmp', sys.argv[1], '--out', out], check=True, capture_output=True)
b = open(out, 'rb').read()
off, = struct.unpack_from('<I', b, 10); w, h = struct.unpack_from('<ii', b, 18); n = struct.unpack_from('<H', b, 28)[0] // 8
h = abs(h); row = (w * n + 3) & ~3
gold = 0
for y in range(h):
    r0 = off + y * row
    for x in range(w):
        bl, g, r = b[r0 + x * n], b[r0 + x * n + 1], b[r0 + x * n + 2]
        if r > 60 and r > 1.1 * g: gold += 1
print(f'{gold / (w * h):.5f}')
