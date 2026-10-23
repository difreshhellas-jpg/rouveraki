import sys, glob
from PIL import Image
files = sorted(glob.glob(sys.argv[1] + "/f_*.png"))
ims = []
for f in files:
    im = Image.open(f).convert("RGBA")
    bg = Image.new("RGBA", im.size, (12, 10, 9, 255))
    bg.alpha_composite(im)
    ims.append(bg.convert("RGB"))
w, h = ims[0].size
sheet = Image.new("RGB", (w * len(ims), h))
for i, im in enumerate(ims):
    sheet.paste(im, (i * w, 0))
sheet.save(sys.argv[2])
print(sheet.size)
