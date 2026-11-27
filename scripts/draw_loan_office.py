"""Paint the private lender on the same pixel grid as the bank teller."""

from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

from draw_pixel_scenes import SIZE, box, slab, stroke

ART = Path(__file__).resolve().parent / 'artwork'


@lru_cache(maxsize=1)
def chairman_canvas():
    with Image.open(ART / 'radish-chairman.webp') as original:
        crop = original.convert('RGB').crop((4, 4, 60, 60)).resize((20, 20), Image.Resampling.NEAREST)

    # Mask the bright backdrop from the edges; the enclosed gold tie stays intact.
    backdrop = Image.new('L', crop.size)
    for y in range(crop.height):
        for x in range(crop.width):
            red, green, blue = crop.getpixel((x, y))
            if red > 235 and red - green > 55 and green - blue > 115:
                backdrop.putpixel((x, y), 1)
    ImageDraw.floodfill(backdrop, (0, 0), 255)
    paper = ImageEnhance.Color(crop).enhance(.54)
    paper = Image.blend(paper, Image.new('RGB', paper.size, '#786756'), .43)
    paper.paste('#827465', (0, 0, *paper.size), backdrop.point(lambda tone: 255 if tone == 255 else 0))
    return paper


def chairman_frame(image, draw):
    # The inset frame follows the wall panel with a single-pixel bevel.
    box(draw, (14, 63, 37, 86), '#6b594b')
    stroke(draw, [(15, 85), (15, 64), (36, 64)], '#987f65')
    stroke(draw, [(36, 65), (36, 85), (16, 85)], '#594d42')
    image.paste(chairman_canvas(), (16, 65))


def lender(draw, pose):
    slab(draw, [(34, 124), (34, 114), (39, 114), (39, 109), (45, 109),
                (45, 106), (65, 106), (65, 109), (71, 109), (71, 114),
                (74, 114), (74, 124)], '#62625b')
    slab(draw, [(59, 107), (64, 107), (64, 110), (70, 110), (70, 115),
                (74, 115), (74, 124), (57, 124)], '#545552')
    slab(draw, [(46, 108), (63, 108), (59, 115), (55, 118), (50, 114)], '#ddccb1')
    box(draw, (54, 114, 56, 122), '#95605b')
    box(draw, (63, 118, 67, 119), '#b99462')

    # Solid Bombay coat with a single shaded plane. The outer edges are coat colors.
    slab(draw, [(36, 100), (36, 89), (38, 89), (38, 80), (41, 78), (44, 80),
                (44, 82), (48, 82), (48, 85), (61, 85), (61, 82), (65, 82),
                (65, 80), (69, 79), (70, 82), (70, 89), (73, 89), (73, 100),
                (70, 100), (70, 105), (66, 105), (66, 109), (43, 109),
                (43, 106), (39, 106), (39, 102), (36, 102)], '#4a4845')
    slab(draw, [(66, 84), (70, 81), (70, 89), (73, 89), (73, 100), (70, 100),
                (70, 105), (66, 105), (66, 109), (56, 109), (56, 105), (63, 105),
                (63, 101), (66, 101)], '#3e3e3d')
    box(draw, (40, 81, 42, 86), '#70615d')
    box(draw, (65, 83, 68, 87), '#665653')
    box(draw, (37, 90, 41, 94), '#57504a')
    box(draw, (39, 97, 43, 101), '#57504a')
    box(draw, (46, 99, 64, 104), '#5c554f')
    box(draw, (49, 97, 61, 106), '#5c554f')

    for index, (x, y) in enumerate(((44, 94), (61, 95))):
        closed = pose == 2 or (pose == 1 and index == 0)
        if closed:
            box(draw, (x, y + 1, x + 3, y + 1), '#353433')
        else:
            box(draw, (x, y, x + 3, y + 1), '#d3a478')
            box(draw, (x + 2, y, x + 2, y + 1), '#393634')
    box(draw, (53, 98, 56, 100), '#866664')
    box(draw, (54, 101, 55, 103), '#393633')
    box(draw, (54, 103, 59, 103), '#393633')
    box(draw, (59, 102, 60, 102), '#393633')


def paint_office(pose=0):
    image = Image.new('RGB', SIZE, '#8b7c66')
    draw = ImageDraw.Draw(image)
    box(draw, (0, 0, 107, 22), '#62594f')
    box(draw, (0, 20, 107, 23), '#746859')
    box(draw, (0, 25, 107, 31), '#a18d6b')
    box(draw, (0, 39, 107, 44), '#766955')
    box(draw, (0, 46, 107, 52), '#95836a')

    # Desaturated, inset wall panels on either side of the lender's booth.
    for left, right in ((6, 44), (46, 76), (78, 101)):
        box(draw, (left, 55, right, 124), '#6a594d')
        box(draw, (left + 2, 57, right - 2, 122), '#8b765f')
        box(draw, (left + 2, 57, right - 2, 58), '#a18b6c')
    box(draw, (0, 92, 107, 94), '#726054')
    box(draw, (0, 95, 107, 96), '#a0866a')
    box(draw, (0, 97, 107, 120), '#796359')
    for left, right in ((6, 43), (46, 76), (79, 102)):
        box(draw, (left, 99, right, 118), '#6d5b52')
        box(draw, (left + 2, 100, right - 2, 118), '#846c5d')
    chairman_frame(image, draw)

    # A leather chair behind the centered teller and an amber lamp on the desk.
    slab(draw, [(41, 118), (37, 95), (37, 87), (41, 84), (66, 84),
                (70, 87), (70, 94), (68, 118)], '#64514b')
    box(draw, (41, 87, 67, 90), '#7d6053')
    box(draw, (90, 103, 92, 119), '#bc9769')
    box(draw, (86, 118, 97, 119), '#ac855f')
    slab(draw, [(83, 101), (86, 94), (94, 94), (99, 101)], '#bd986c')
    box(draw, (83, 102, 99, 104), '#e0bb86')
    if pose is not None:
        lender(draw, pose)
    office_counter(draw)
    return image


def office_counter(draw):
    box(draw, (0, 121, 107, 146), '#67534b')
    box(draw, (0, 121, 107, 125), '#b29673')
    box(draw, (0, 126, 107, 128), '#8e705d')
    box(draw, (0, 144, 107, 148), '#594941')
    for x in (18, 53, 89):
        box(draw, (x - 13, 132, x + 13, 141), '#735d51')
        stroke(draw, [(x - 13, 132), (x + 13, 132)], '#866955')
    box(draw, (18, 116, 35, 121), '#7d8c70')
    box(draw, (20, 115, 34, 117), '#b1af8b')
    box(draw, (25, 115, 27, 120), '#d3bf98')
    box(draw, (47, 120, 63, 122), '#d4bea1')

    box(draw, (0, 149, 107, 191), '#827267')
    for y in (155, 170, 185):
        stroke(draw, [(0, y), (107, y)], '#736359')
        for x in (22, 54, 86):
            start = x + (12 if y == 170 else 0)
            stroke(draw, [(start, y), (start, min(y + 14, 191))], '#736359')
    slab(draw, [(21, 153), (86, 153), (100, 185), (7, 185)], '#73605a')
    slab(draw, [(23, 155), (84, 155), (96, 181), (11, 181)], '#876c60')
