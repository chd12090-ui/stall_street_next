"""Paint the ritual room on the 108-pixel grid shared by the bank and loan office."""

from math import ceil, cos, floor, sin, tau
from pathlib import Path

from PIL import Image, ImageDraw

from draw_pixel_scenes import box, slab, stroke


ART = Path(__file__).resolve().parents[1] / 'public/art/pixel'


def lintel(draw):
    # The eaves continue past the viewport, like the beam above the lender's desk.
    box(draw, (0, 0, 107, 6), '#303c40')
    for x in range(-11, 108, 15):
        slab(draw, [(x + 3, 0), (x + 11, 0), (x + 8, 4), (x, 4)],
             '#465454')
        box(draw, (x, 4, x + 8, 5), '#3f4e4d')
        box(draw, (x + 1, 6, x + 7, 7), '#2b393b')
    box(draw, (0, 8, 107, 10), '#282f30')
    box(draw, (0, 11, 107, 13), '#494341')
    box(draw, (0, 14, 107, 16), '#3f3b39')
    for x in (6, 93):
        box(draw, (x, 15, x + 8, 17), '#4b5650')
        box(draw, (x + 1, 17, x + 7, 18), '#736556')
        box(draw, (x + 2, 19, x + 6, 20), '#464d46')


def hanging_cloth(draw, x, face, shaded, hem):
    box(draw, (x - 1, 19, x + 5, 20), '#776b59')
    slab(draw, [(x, 21), (x + 4, 21), (x + 4, 37), (x + 5, 38),
                (x + 5, 42), (x + 2, 40), (x, 42)], face)
    box(draw, (x + 4, 22, x + 4, 36), shaded)
    box(draw, (x, 24, x + 3, 24), hem)


def window_mist(image, phase):
    # Cut to the open bay. The columns, flags, candles and actor stay in front of the mist.
    window = image.crop((14, 20, 94, 57))
    draw = ImageDraw.Draw(window)
    far = round(4 * sin(phase))
    near = round(5 * sin(phase + .75))
    rise = round(.75 * cos(phase))

    def bank(points, x, y, color):
        slab(draw, [(px + x, py + y) for px, py in points], color)

    # A thin veil grazes the moon. The larger fog banks gather in the valley below.
    bank([(36,9),(43,9),(46,8),(55,8),(58,7),(65,7),(68,8),(77,8),
          (73,9),(63,9),(60,10),(50,10),(47,11),(39,11),(43,10)], far,0,'#536566')
    bank([(-10,22),(-2,22),(2,20),(11,20),(14,18),(21,18),(24,19),(33,19),
          (36,20),(45,20),(48,21),(44,22),(34,22),(31,23),(20,23),(17,25),
          (6,25),(1,26),(-10,26)], far,rise,'#526463')
    bank([(32,24),(38,23),(45,23),(48,21),(56,21),(59,19),(67,19),(70,18),
          (80,18),(84,17),(92,17),(92,24),(78,24),(73,25),(61,25),(58,26),
          (50,26),(47,25),(39,25)], -far,1,'#4c605e')
    bank([(-12,30),(-1,30),(3,28),(12,28),(15,26),(22,26),(25,27),(35,27),
          (38,26),(47,26),(42,28),(31,29),(26,30),(17,30),(13,32),(3,32),
          (-1,33),(-12,33)], -near,0,'#5a6b68')
    bank([(30,34),(38,33),(42,31),(50,31),(54,29),(63,29),(67,27),(75,27),
          (78,28),(90,28),(90,34),(77,33),(72,32),(64,32),(60,33),(51,33),
          (45,35),(35,35)], near,-rise,'#566865')
    image.paste(window, (14, 20))


def back_wall(image, draw, phase):
    box(draw, (14, 17, 93, 59), '#405458')
    box(draw, (15, 17, 92, 19), '#394a4d')
    for x in (14, 89):
        box(draw, (x, 20, x + 3, 59), '#394b4c')
    slab(draw, [(17, 48), (22, 48), (22, 45), (26, 45), (26, 42),
                (29, 42), (29, 40), (33, 40), (33, 38), (36, 38),
                (36, 40), (40, 40), (40, 43), (44, 43), (44, 45),
                (47, 45), (47, 47), (54, 47), (54, 50), (60, 50),
                (60, 47), (65, 47), (65, 44), (68, 44), (68, 42),
                (72, 42), (72, 39), (76, 39), (76, 37), (79, 37),
                (79, 40), (82, 40), (82, 44), (86, 44), (86, 46),
                (89, 46), (89, 57), (17, 57)], '#384d4d')
    # One small, slightly clipped moon in the dusk above the mountains.
    box(draw, (71, 24, 75, 30), '#82918a')
    box(draw, (70, 25, 76, 29), '#82918a')
    box(draw, (75, 29, 78, 30), '#405458')
    window_mist(image, phase)
    for x in (3, 99):
        box(draw, (x, 17, x + 5, 60), '#393735')
        box(draw, (x, 19, x + 1, 59), '#595145')
        box(draw, (x + 2, 19, x + 4, 58), '#4a443d')
    box(draw, (0, 57, 107, 59), '#454140')
    box(draw, (0, 60, 107, 62), '#39393a')
    hanging_cloth(draw, 20, '#744d46', '#58423e', '#89745c')
    hanging_cloth(draw, 84, '#586c62', '#42584f', '#75816f')


def candle(draw, x):
    # A stepped flame and brass dish read at the same scale as the lender's lamp.
    box(draw, (x, 44, x + 1, 48), '#cc9264')
    box(draw, (x + 1, 43, x + 1, 47), '#e2c99a')
    box(draw, (x - 1, 46, x + 1, 48), '#d8aa70')
    box(draw, (x, 46, x, 47), '#f2ddac')
    box(draw, (x - 1, 50, x + 1, 55), '#b8a286')
    box(draw, (x + 1, 50, x + 1, 55), '#9a846d')
    box(draw, (x - 4, 55, x + 4, 56), '#a88c60')
    box(draw, (x - 3, 57, x + 3, 57), '#856d50')
    box(draw, (x - 1, 58, x + 1, 61), '#927b55')
    box(draw, (x - 4, 62, x + 4, 62), '#a88c60')
    box(draw, (x - 5, 63, x + 5, 63), '#5b5141')


def paint_floor(draw):
    box(draw, (0, 63, 107, 78), '#594e46')
    box(draw, (0, 63, 107, 65), '#665a4f')
    stroke(draw, [(0, 71), (17, 71), (20, 69)], '#4e443e')
    stroke(draw, [(84, 71), (104, 71), (107, 70)], '#4e443e')
    stroke(draw, [(13, 77), (21, 77), (27, 73)], '#4e443e')
    # Front of the offering altar continues in the controls below the artwork.
    box(draw, (0, 79, 107, 81), '#605447')
    box(draw, (0, 82, 107, 82), '#756356')
    box(draw, (0, 83, 107, 83), '#4d433c')
    box(draw, (0, 84, 107, 85), '#413c39')


def blade_platform():
    image = Image.new('RGBA', (108, 86))
    draw = ImageDraw.Draw(image)
    # The dancer's foot meets the steel edge at (54, 69).
    box(draw, (28, 77, 80, 78), '#49423e')
    for x in (34, 70):
        box(draw, (x, 71, x + 3, 76), '#3e3936')
        box(draw, (x, 72, x + 1, 75), '#695544')
        box(draw, (x - 2, 76, x + 5, 77), '#4b4039')
    box(draw, (36, 73, 72, 74), '#52453b')
    box(draw, (27, 69, 80, 69), '#969f93')
    box(draw, (26, 70, 81, 70), '#697c72')
    box(draw, (28, 71, 79, 71), '#4d4941')
    for x in (27, 78):
        box(draw, (x, 69, x + 2, 71), '#785e47')
    return image


def paint_room(phase=0):
    image = Image.new('RGB', (108, 86), '#354344')
    draw = ImageDraw.Draw(image)
    back_wall(image, draw, phase)
    lintel(draw)
    paint_floor(draw)
    for x in (13, 94):
        candle(draw, x)
    return image


def foreground_mist(phase):
    # Low curls cross in front of the robe and the wooden floor. Each curl
    # tapers to transparency before it wraps around the sides of the scene.
    w, h = 108, 86
    density = [[0.0] * w for _ in range(h)]
    period = 144
    # Starting x, y, half length, depth, tilt, lift, alpha, direction.
    curls = [(12, 65, 36, 4.8, -2.1, 1.9, 101, 1),
             (87, 60, 31, 3.3, 2.7, 1.5, 83, 1),
             (48, 75, 43, 4.9, -1.7, 2.1, 100, 1),
             (24, 52, 32, 2.5, 2.5, 2.0, 78, -1),
             (107, 72, 33, 3.8, -2.8, 1.3, 90, -1),
             (51, 62, 28, 6.8, -1.2, .9, 67, 1),
             (-2, 55, 32, 10.4, 2.3, 1.3, 103, 0),
             (104, 62, 28, 9.5, -1.8, 1.6, 100, 0)]
    for i, (cx, line, length, depth, slope, lift, opacity, wind) in enumerate(curls):
        # Broad pockets at the pillars linger while narrower wisps blow through.
        drift = cx + (wind * period * phase / tau if wind else 6 * sin(phase + i))
        hollow = .73 if wind else .25
        for x in range(w):
            u = ((x - drift + period / 2) % period - period / 2) / length
            if abs(u) >= 1:
                continue
            # A thicker leading billow unwinds into a thin forked tail.
            edge = 1 - u * u
            crest = sin(u * 5.9 + .65 * sin(phase + i) + i * 1.8)
            y_center = line + slope * u + lift * crest + .9 * sin(i + phase + u * 3)
            radius = depth * edge ** .6 * (1.05 + .24 * crest + .14 * u * wind)
            strength = opacity * edge ** 1.4 * (.86 + .14 * sin(u * 8 - phase + i))
            pocket = max(0, 1 - ((u * wind + .28) / .64)**2)
            for y in range(max(0, ceil(y_center - radius)), min(h, floor(y_center + radius) + 1)):
                v = (y - y_center) / radius
                # Air opens through the trail; the denser rim bends with the current.
                split = max(0, 1 - ((v - .16 - .28 * crest) / .45)**2)
                alpha = strength * (1 - v * v) ** 1.5 * (1 - hollow * pocket * split)
                density[y][x] += (1 - density[y][x] / 255) * alpha
    # A small set of alpha steps keeps the mist on the same pixel grid as the
    # paper lanterns. The transparent plane leaves the room and character intact.
    alpha_mask = Image.new('L', (w, h))
    alpha_mask.putdata([min(124, 6 * round(value / 6)) for row in density for value in row])
    veil = Image.new('RGBA', (w, h), '#82918a')
    veil.putalpha(alpha_mask)
    return veil


if __name__ == '__main__':
    blade_platform().save(ART / 'ritual-platform.webp', lossless=True, method=6)
    frames = [paint_room(tau * i / 32) for i in range(32)]
    frames[0].save(ART / 'ritual-room.webp', lossless=True, method=6)
    frames[0].save(ART / 'ritual-room-mist.webp', save_all=True, append_images=frames[1:],
                   duration=360, loop=0, lossless=True, method=6)
    front = [foreground_mist(tau * i / 80) for i in range(80)]
    front[0].save(ART / 'ritual-foremist-still.webp', lossless=True, method=6)
    front[0].save(ART / 'ritual-foremist.webp', save_all=True, append_images=front[1:],
                  duration=240, loop=0, lossless=True, method=6, quality=100, minimize_size=True)
