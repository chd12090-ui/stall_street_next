"""Paint the ballot's polling booth and its two fictional candidates."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

from draw_pixel_animals import Attire, Cat, portrait


OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'art' / 'pixel'
SIZE = (144, 144)


def booth():
    scene = Image.new('RGB', SIZE)
    draw = ImageDraw.Draw(scene)
    shadow, light = (29, 50, 41), (64, 88, 72)
    for y in range(0, SIZE[1], 4):
        amount = 1 - abs(y - 82) / 100
        shade = tuple(round(a + (b - a) * amount) for a, b in zip(shadow, light))
        draw.rectangle((0, y, SIZE[0] - 1, y + 3), fill=shade)

    # The cloth fills both sides of the scene down to the lip of the ballot box.
    curtain = Image.new('RGBA', (30, SIZE[1]))
    cloth = ImageDraw.Draw(curtain)
    cloth.polygon(((0, 0), (29, 0), (29, 30), (26, 30), (26, 54), (23, 54), (23, 80),
                   (20, 80), (20, 100), (16, 100), (16, 123), (11, 123), (11, 143), (0, 143)),
                  fill='#203a31')
    cloth.polygon(((2, 0), (7, 0), (7, 60), (8, 60), (8, 102), (5, 102), (5, 143), (2, 143)),
                  fill='#315245')
    cloth.polygon(((11, 0), (16, 0), (16, 43), (15, 43), (15, 85), (12, 85), (12, 108),
                   (9, 108), (10, 64), (11, 64)), fill='#2b493e')
    cloth.polygon(((24, 0), (28, 0), (26, 42), (23, 69), (19, 96), (15, 112),
                   (13, 107), (17, 88), (21, 62)), fill='#3a5b4c')
    scene.paste(curtain, (0, 0), curtain)
    reflected = ImageOps.mirror(curtain)
    scene.paste(reflected, (SIZE[0] - reflected.width, 0), reflected)
    draw.rectangle((0, 0, 143, 1), fill='#22382f')
    draw.rectangle((0, 2, 143, 3), fill='#284137')
    return scene


def build():
    candidates = {
        'progressive': (
            Cat('치즈 얼룩 고양이', 'tufts', 'cap', '#f0dcb4', '#c18859', '#fff1d0', '#c0ccad'),
            Attire('suit', '#354c4a', '#56706a', ('#578477', '#385e59'), '#cbaa69'),
        ),
        'conservative': (
            Cat('푸른 회색 고양이', 'round', 'smoke', '#8191a2', '#607184', '#bcc5c6', '#c5bdb1'),
            Attire('suit', '#3c3d50', '#575b71', ('#a4584c', '#754958'), '#d1b275'),
        ),
    }
    for name, (cat, attire) in candidates.items():
        portrait(cat, 0, 0, attire).save(OUTPUT / f'election-{name}.webp', lossless=True)
    booth().save(OUTPUT / 'election-booth.webp', lossless=True)


if __name__ == '__main__':
    build()
