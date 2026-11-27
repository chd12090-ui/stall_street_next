"""Paint the black-market alley and its product sprites."""

from pathlib import Path

from PIL import Image, ImageDraw

from draw_black_market import draw_black_market
from draw_pixel_scenes import box, slab, stroke


ART = Path(__file__).resolve().parents[1] / 'public/art'
PAPER, BRASS = '#d3c6a5', '#ba9e6c'


def product_sprites():
    shade, mid, light = '#4d524d', '#788077', '#a9ac9e'
    ink = '#2b312f'
    for name in ('tissue', 'coffee', 'lamp', 'radio', 'safe', 'cushion', 'ai-glasses'):
        image = Image.new('RGBA', (24, 24))
        d = ImageDraw.Draw(image)
        box(d, (4, 21, 20, 22), ink)
        if name == 'tissue':
            slab(d, [(3, 13), (8, 10), (20, 10), (22, 13), (19, 20), (3, 20)], shade)
            box(d, (3, 13, 18, 19), mid)
            slab(d, [(7, 11), (10, 8), (11, 4), (15, 3), (18, 4),
                     (16, 7), (15, 11)], PAPER)
            stroke(d, [(7, 11), (11, 9), (14, 9)], '#b0a890')
            stroke(d, [(10, 15), (10, 18)], PAPER)
            stroke(d, [(8, 16), (12, 16)], PAPER)
        elif name == 'coffee':
            slab(d, [(6, 8), (18, 8), (16, 20), (8, 20)], mid)
            box(d, (7, 12, 17, 16), '#977f61')
            box(d, (8, 13, 15, 14), '#b39e7f')
            box(d, (5, 6, 19, 8), shade)
            box(d, (7, 5, 17, 6), light)
            box(d, (6, 9, 18, 9), ink)
        elif name == 'lamp':
            box(d, (7, 7, 16, 17), shade)
            box(d, (9, 8, 14, 16), '#9c9883')
            slab(d, [(10, 14), (11, 12), (12, 10), (13, 13), (13, 15), (10, 15)], PAPER)
            box(d, (6, 17, 17, 19), mid)
            box(d, (7, 20, 16, 20), shade)
            stroke(d, [(8, 6), (9, 4), (14, 4), (15, 6)], light)
            box(d, (6, 6, 17, 7), '#a49b83')
        elif name == 'radio':
            stroke(d, [(17, 11), (19, 4), (21, 3)], light)
            box(d, (3, 10, 21, 20), shade)
            box(d, (4, 10, 20, 11), light)
            box(d, (5, 12, 13, 18), mid)
            for y in (13, 15, 17):
                box(d, (6, y, 12, y), ink)
            box(d, (15, 13, 18, 14), BRASS)
            box(d, (16, 16, 18, 18), light)
        elif name == 'safe':
            slab(d, [(4, 7), (18, 7), (21, 9), (21, 20), (4, 20)], shade)
            box(d, (5, 8, 18, 19), mid)
            box(d, (7, 10, 16, 17), '#60685f')
            box(d, (9, 8, 14, 8), ink)
            box(d, (11, 12, 13, 15), light)
            box(d, (10, 13, 14, 14), light)
        elif name == 'cushion':
            slab(d, [(3, 15), (5, 8), (8, 9), (10, 11), (14, 11),
                     (16, 9), (19, 8), (21, 15), (20, 19), (17, 21),
                     (6, 21), (3, 19)], mid)
            box(d, (7, 15, 17, 19), light)
            box(d, (7, 14, 8, 15), shade)
            box(d, (16, 14, 17, 15), shade)
            stroke(d, [(11, 17), (12, 18), (13, 17)], shade)
            box(d, (7, 20, 17, 20), '#92988b')
        else:
            frame, glass, shine = '#d3b477', '#406565', '#91c2ad'
            box(d, (2, 9, 21, 11), frame)
            box(d, (3, 10, 10, 16), frame)
            box(d, (13, 10, 20, 16), frame)
            box(d, (4, 11, 9, 15), glass)
            box(d, (14, 11, 19, 15), glass)
            stroke(d, [(5, 14), (7, 12), (8, 12)], shine)
            stroke(d, [(14, 14), (16, 12), (17, 13), (19, 11)], shine)
            box(d, (19, 6, 20, 7), PAPER)
        yield name, image


def draw_venues():
    for directory in ('pixel', 'shop'):
        (ART / directory).mkdir(parents=True, exist_ok=True)
    draw_black_market(ART / 'pixel')
    for name, image in product_sprites():
        image.save(ART / 'shop' / f'{name}.webp', lossless=True, method=6)


if __name__ == '__main__':
    draw_venues()
