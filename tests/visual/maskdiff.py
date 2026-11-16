"""Static-region check. mask = pixels where A (text on, t1) differs from C (text off, t1), i.e. the
text block. Prints '<mask pixels> <fraction of mask that changes between A and B (text on, t2)>'."""
import struct, subprocess, sys, tempfile, os
def load(png):
    out = os.path.join(tempfile.mkdtemp(), 'x.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', png, '--out', out], check=True, capture_output=True)
    b = open(out, 'rb').read()
    off, = struct.unpack_from('<I', b, 10); w, h = struct.unpack_from('<ii', b, 18)
    return w, abs(h), struct.unpack_from('<H', b, 28)[0] // 8, b[off:]
(w, h, n, a), (_, _, _, b), (_, _, _, c) = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
row = (w * n + 3) & ~3
d = lambda p, q, i: max(abs(p[i] - q[i]), abs(p[i + 1] - q[i + 1]), abs(p[i + 2] - q[i + 2]))
mask = changed = 0
for y in range(h):
    for x in range(w):
        i = y * row + x * n
        if d(a, c, i) > 24:
            mask += 1
            if d(a, b, i) > 24: changed += 1
print(mask, f'{changed / max(mask, 1):.4f}')
