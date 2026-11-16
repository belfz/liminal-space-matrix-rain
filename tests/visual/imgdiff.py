"""Fraction of pixels that differ noticeably between two same-size PNGs (via macOS sips -> BMP)."""
import struct, subprocess, sys, tempfile, os

def load(png):
    out = os.path.join(tempfile.mkdtemp(), 'x.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', png, '--out', out], check=True, capture_output=True)
    b = open(out, 'rb').read()
    off, = struct.unpack_from('<I', b, 10)
    w, h = struct.unpack_from('<ii', b, 18)
    bpp, = struct.unpack_from('<H', b, 28)
    return w, abs(h), bpp // 8, b[off:]

w1, h1, n1, a = load(sys.argv[1])
w2, h2, n2, b = load(sys.argv[2])
assert (w1, h1, n1) == (w2, h2, n2), 'size mismatch'
row = (w1 * n1 + 3) & ~3
diff = 0
for y in range(h1):
    r = y * row
    for x in range(0, w1 * n1, n1):
        i = r + x
        if max(abs(a[i] - b[i]), abs(a[i + 1] - b[i + 1]), abs(a[i + 2] - b[i + 2])) > int(sys.argv[3] if len(sys.argv) > 3 else 24):
            diff += 1
print(f'{diff / (w1 * h1):.5f}')
