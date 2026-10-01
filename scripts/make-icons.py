import os

from PIL import Image, ImageEnhance

# Extension icons (public/icon/*.png) from the medallion: python scripts/make-icons.py
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SOURCE = 'reference/icon-medallion.png'
SIZES = (16, 32, 48, 96, 128)
# A browser draws the icon on toolbars of either colour, so the art keeps its own transparent ground.
MARGIN = 0.02


def master() -> Image.Image:
    art = Image.open(SOURCE).convert('RGBA')
    art = art.crop(art.getbbox())

    side = round(max(art.size) * (1 + MARGIN * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((side - art.width) // 2, (side - art.height) // 2))
    return canvas


# At toolbar sizes the long spikes leave the medallion a blob, so the small icons close in on its body.
CLOSE_UP = {16: 0.75, 32: 0.80, 48: 0.90}


def icon(base: Image.Image, size: int) -> Image.Image:
    art = base
    keep = CLOSE_UP.get(size)
    if keep:
        side = round(base.width * keep)
        edge = (base.width - side) // 2
        art = base.crop((edge, edge, edge + side, edge + side))
    small = art.resize((size, size), Image.LANCZOS)
    # Fine gold tracery on dark metal: a touch more contrast keeps it legible once it is this small.
    return ImageEnhance.Contrast(small).enhance(1.2) if size <= 48 else small


os.makedirs('public/icon', exist_ok=True)
base = master()
for size in SIZES:
    icon(base, size).save(f'public/icon/{size}.png', optimize=True)
print('icons written to public/icon from', SOURCE)
