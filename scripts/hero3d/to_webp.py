"""PNG (RGBA) -> WebP with alpha, into public/hero-seq/<aspect>/. Usage: python to_webp.py portrait|landscape"""
import glob, os, sys
from PIL import Image
a = sys.argv[1]
src = os.path.join(os.path.dirname(__file__), "out", a)
dst = os.path.join(os.path.dirname(__file__), "..", "..", "public", "hero-seq", a)
os.makedirs(dst, exist_ok=True)
tot = 0
files = sorted(glob.glob(src + "/f_*.png"))
for f in files:
    im = Image.open(f).convert("RGBA")
    out = os.path.join(dst, os.path.basename(f).replace(".png", ".webp"))
    im.save(out, "WEBP", quality=82, alpha_quality=90, method=5)
    tot += os.path.getsize(out)
print(a, len(files), "frames", round(tot / 1e6, 2), "MB", round(tot / max(len(files), 1) / 1e3), "KB avg")
