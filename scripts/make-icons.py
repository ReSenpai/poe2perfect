import os
import re

from PIL import Image, ImageDraw, ImageFont

# Extension icons (public/icon/*.png): python scripts/make-icons.py
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BG = (22, 24, 29, 255)        # --surface
RING = (42, 45, 51, 255)      # --border
ACCENT = (232, 161, 90, 255)  # --accent

SIZE = 1024
FONT = r'C:\Windows\Fonts\seguibl.ttf' if os.path.exists(r'C:\Windows\Fonts\seguibl.ttf') else r'C:\Windows\Fonts\segoeuib.ttf'


def master():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 24
    radius = 220
    d.rounded_rectangle([pad, pad, SIZE - pad, SIZE - pad], radius=radius, fill=BG, outline=RING, width=20)
    # Accent underline, like the active tab.
    d.rounded_rectangle([300, 790, SIZE - 300, 840], radius=25, fill=ACCENT)

    font = ImageFont.truetype(FONT, 560)
    text = 'P2'
    box = d.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (SIZE - w) / 2 - box[0]
    y = (SIZE - h) / 2 - box[1] - 60
    d.text((x, y), text, font=font, fill=ACCENT)
    return img


os.makedirs('public/icon', exist_ok=True)
base = master()
for size in (16, 32, 48, 96, 128):
    base.resize((size, size), Image.LANCZOS).save(f'public/icon/{size}.png')
print('icons written to public/icon')
