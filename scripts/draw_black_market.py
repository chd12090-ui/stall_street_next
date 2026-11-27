"""A single street plate, from the overhead wires to the foreground gutter."""

from PIL import Image, ImageDraw, ImageOps

from draw_pixel_scenes import box, slab, stroke


WIDTH, HEIGHT = 108, 126
VANISHING_POINT = (61, 73)
LEFT_CURB, RIGHT_CURB = (0, 116), (107, 113)
GROUND = '#202b29'
DEEP = '#131e20'
DARK = '#1c292b'
SEAM = '#263535'
WALL = '#344443'
STONE = '#455550'
EDGE = '#5b6b60'
ZINC = '#7b8776'

def receding_edge(near, x):
    end_x, end_y = VANISHING_POINT
    near_x, near_y = near
    y = end_y + (near_y - end_y) * (x - end_x) / (near_x - end_x)
    return x, round(y)


def far_passage(d):
    # Small alternating building ends converge on the threshold at (59, 78).
    slab(d, [(28, 19), (47, 11), (47, 8), (61, 5), (61, 78), (28, 83)], '#303e3d')
    box(d, (52, 14, 59, 17), '#293638')
    box(d, (53, 15, 55, 16), '#4d5750')
    slab(d, [(60, 35), (60, 19), (72, 13), (83, 14), (83, 82), (60, 79)], '#273435')
    slab(d, [(41, 41), (52, 46), (52, 81), (40, 85)], '#374643')
    stroke(d, [(42, 44), (51, 48)], '#536054')
    box(d, (48, 53, 50, 60), '#253332')
    box(d, (49, 54, 50, 55), '#586052')
    slab(d, [(51, 51), (56, 54), (56, 78), (51, 81)], '#2b3836')
    box(d, (55, 61, 63, 78), DARK)
    box(d, (57, 65, 61, 78), '#101a1b')
    box(d, (61, 65, 61, 77), '#1a2727')
    slab(d, [(54, 59), (57, 59), (59, 61), (63, 60), (63, 62), (58, 64), (54, 62)], '#263333')
    stroke(d, [(56, 67), (56, 75), (54, 77)], '#354039')
    stroke(d, [(60, 73), (60, 76), (59, 77)], '#182423')
    slab(d, [(64, 49), (72, 44), (72, 84), (63, 79)], '#303e3a')
    stroke(d, [(64, 55), (70, 52)], '#47534b')
    box(d, (65, 62, 66, 74), '#263532')
    stroke(d, [(68, 53), (68, 77), (67, 78)], '#445149')
    # Four sizes of roofline and drain make the distance visible in silhouette.
    slab(d, [(22, 6), (41, 23), (42, 39), (48, 42),
             receding_edge(LEFT_CURB, 48), receding_edge(LEFT_CURB, 22)], '#354643')
    slab(d, [(25, 15), (40, 28), receding_edge((0, 111), 40),
             receding_edge((0, 111), 25)], '#40514a')
    stroke(d, [(30, 38), (45, 47)], '#263a38', 2)
    stroke(d, [(36, 51), (45, 56)], '#263a38')
    box(d, (42, 51, 43, 82), '#566455')
    box(d, (43, 53, 43, 81), '#415548')
    slab(d, [(32, 59), (40, 62), (40, 75), (32, 75)], '#293b37')
    for y in (62, 66, 70):
        stroke(d, [(34, y), (39, y + 1)], '#526353')
    slab(d, [(64, 26), (74, 18), (86, 12), receding_edge(RIGHT_CURB, 86),
             receding_edge(RIGHT_CURB, 70), (70, 68), (64, 65)], '#344440')
    slab(d, [(65, 33), (75, 26), (75, 37), (65, 43)], '#243230')
    stroke(d, [(66, 36), (74, 31)], '#4b5b50')
    stroke(d, [(66, 40), (74, 35)], '#41534a')
    stroke(d, [(71, 43), (71, 70)], '#526253')
    stroke(d, [(48, 32), (51, 37), (55, 40), (59, 41), (62, 40), (68, 32)], '#1f2d2d')


def pavement(d):
    slab(d, [LEFT_CURB, receding_edge(LEFT_CURB, 54), receding_edge(RIGHT_CURB, 67),
             RIGHT_CURB, (107, 125), (0, 125)], '#374540')
    slab(d, [(13, 116), receding_edge((13, 116), 54), receding_edge((25, 116), 54),
             (25, 116)], '#465449')
    slab(d, [(41, 92), (54, 82), (66, 82), (73, 87), (61, 85), (52, 86)], '#293833')
    slab(d, [receding_edge((100, 116), 77), (100, 116), (91, 116),
             receding_edge((91, 116), 77)], '#2a3833')
    # Wet concrete. The nearer reflections are longer and increasingly broken.
    slab(d, [(36, 104), (45, 101), (53, 101), (49, 102), (54, 103),
             (47, 104), (44, 106), (29, 107)], '#505f51')
    slab(d, [(33, 108), (43, 107), (48, 107), (45, 109), (40, 109),
             (35, 111), (23, 112), (27, 110)], '#45574a')
    for x, y, length, color in (
        (55, 84, 2, '#506052'), (51, 87, 4, '#65715e'), (54, 88, 2, '#536151'),
        (48, 94, 5, '#66755e'), (46, 95, 2, '#566859'), (41, 101, 5, '#76846c'),
        (47, 102, 3, '#899379'), (37, 104, 5, '#63755f'), (31, 109, 6, '#69775f'),
        (38, 109, 3, '#8e9578'), (34, 110, 3, '#717f66'), (25, 113, 9, '#4c5c50'),
        (62, 104, 8, '#44554a'), (65, 105, 3, '#536353'),
    ):
        box(d, (x, y, x + length - 1, y), color)
    stroke(d, [(61, 88), (59, 103)], '#2c3a35')
    stroke(d, [(15, 115), (31, 114), (42, 116), (50, 114)], '#46564b')
    slab(d, [(0, 115), (19, 112), (20, 115), (4, 120), (0, 120)], '#2a3933')
    slab(d, [(0, 119), (20, 118), (26, 116), (44, 119), (68, 115), (84, 116),
             (97, 111), (107, 110), (107, 125), (0, 125)], '#293732')
    stroke(d, [(49, 120), (53, 118), (63, 118)], '#38473d')
    slab(d, [(0, 117), (16, 117), (29, 116), (48, 118), (63, 117), (80, 118),
             (101, 115), (107, 115), (107, 125), (0, 125)], GROUND)


def left_facades(d):
    # Side wall, a recessed door, and a bank of air conditioners seen edge-on.
    slab(d, [(0, 0), (24, 0), (39, 23), receding_edge(LEFT_CURB, 39), LEFT_CURB], WALL)
    slab(d, [(1, 0), (15, 0), (31, 19), receding_edge((0, 111), 31),
             (0, 111)], '#404f4b')
    slab(d, [(0, 13), (23, 31), (23, 40), (0, 27)], '#293a39')
    stroke(d, [(1, 16), (20, 31)], '#5c6b5f', 2)
    slab(d, [receding_edge((0, 49), 13), receding_edge((0, 49), 27),
             receding_edge((0, 110), 27), receding_edge((0, 110), 13)], '#252f30')
    slab(d, [(16, 58), (24, 61), (24, 92), (16, 98)], '#35423e')
    stroke(d, [(17, 60), (17, 96)], '#45534b')
    box(d, (21, 78, 22, 78), '#677364')
    slab(d, [(0, 53), (6, 55), (8, 57), (5, 57), (4, 60), (0, 58)], '#506157')
    box(d, (10, 74, 11, 79), '#5b695c')
    stroke(d, [(10, 79), (10, 86)], '#3b4a41')
    stroke(d, [(30, 25), (34, 29), (35, 29)], '#526255')
    slab(d, [(27, 48), (34, 52), (34, 64), (27, 62)], '#4e6055')
    slab(d, [(27, 48), (30, 47), (37, 51), (34, 52)], '#71806d')
    slab(d, [(34, 52), (37, 51), (37, 62), (34, 64)], '#2a3a35')
    for y in (52, 55, 58):
        stroke(d, [(28, y), (32, y + 2)], '#33453d')
    stroke(d, [(34, 64), (34, 68), (31, 69), (31, 89)], '#74806b')
    # The large unit projects over the alley, independent of the iron downpipe.
    slab(d, [(10, 26), (24, 34), (24, 55), (10, 51)], '#5a6960')
    slab(d, [(10, 26), (15, 24), (29, 33), (24, 34)], '#758275')
    slab(d, [(24, 34), (29, 33), (29, 53), (24, 55)], '#2f3e39')
    slab(d, [(12, 31), (21, 36), (21, 48), (12, 45)], '#344540')
    for y in (33, 36, 39, 42):
        stroke(d, [(13, y), (20, y + 4)], '#768171')
    stroke(d, [(25, 56), (25, 66), (28, 68), (28, 92)], '#647160')
    stroke(d, [(21, 54), (21, 58), (15, 57)], '#222e2c', 2)
    stroke(d, [(10, 49), (22, 53)], '#8a9180')
    box(d, (24, 41, 25, 47), '#58695c')
    stroke(d, [(27, 36), (27, 43)], '#45554b')
    slab(d, [(13, 81), (16, 80), (16, 85), (13, 86)], '#606c5f')
    box(d, (14, 82, 15, 82), '#8b8a73')
    stroke(d, [(0, 61), (12, 64), (12, 98), (10, 103)], '#283733', 2)
    # Foreground return, hatched cap and bands of the main drain.
    slab(d, [(0, 0), (8, 0), (8, 47), (6, 48), (6, 101), (0, 107)], '#263333')
    stroke(d, [(3, -2), (3, 22), (6, 26), (6, 63), (8, 66), (8, 101)], '#27332f', 5)
    stroke(d, [(2, -2), (2, 22), (5, 26), (5, 63), (7, 66), (7, 101)], '#728071', 3)
    stroke(d, [(2, 28), (2, 51)], '#93a08b')
    for x, y in ((3, 17), (6, 44), (8, 78), (8, 95)):
        box(d, (x - 3, y, x + 1, y + 2), '#384a42')
        box(d, (x - 3, y, x + 1, y), '#819080')
    stroke(d, [(14, 0), (14, 9), (18, 13), (18, 19), (23, 24)], '#202d2d', 2)


def right_facades(d):
    # The shadow between two building ends opens directly onto the pavement.
    slab(d, [(77, 9), (90, 0), (107, 0), RIGHT_CURB, receding_edge(RIGHT_CURB, 77)], STONE)
    slab(d, [(71, 23), (81, 16), (81, 89), (71, 83)], '#3b4a43')
    slab(d, [(73, 62), (84, 58), (84, 93), (73, 86)], DEEP)
    slab(d, [(75, 65), (82, 62), (82, 89), (75, 85)], '#1a2525')
    stroke(d, [(72, 62), (83, 58)], '#526054')
    slab(d, [(85, 0), (98, 0), receding_edge(RIGHT_CURB, 98),
             receding_edge(RIGHT_CURB, 83), (83, 51), (85, 48)], '#35443f')
    stroke(d, [(83, 61), receding_edge(RIGHT_CURB, 83)], '#596459')
    # A narrow old window and its projecting sill.
    slab(d, [(88, 23), (104, 9), (104, 34), (88, 44)], '#253331')
    slab(d, [(90, 25), (101, 16), (101, 31), (90, 38)], '#47584d')
    stroke(d, [(95, 22), (95, 35)], DARK)
    stroke(d, [(89, 33), (102, 24)], DARK)
    stroke(d, [(87, 45), (104, 34)], '#778170', 2)
    stroke(d, [(86, 62), (106, 56)], '#283732')
    stroke(d, [receding_edge((107, 82), 85), (107, 82)], '#33443c')
    stroke(d, [receding_edge((107, 99), 88), (107, 99)], '#34443b')
    # The projecting fixture is unlit. It reads as dark hardware against the wall.
    stroke(d, [(84, 35), (84, 38), (88, 40)], '#242e2b', 2)
    slab(d, [(70, 36), (73, 35), (91, 40), (91, 42), (87, 43), (70, 38)], '#55614f')
    stroke(d, [(71, 37), (74, 37), (86, 41), (89, 41)], '#414a43')
    box(d, (89, 40, 90, 41), '#46514b')
    # Close dark wall with an electric meter and strapped conduit.
    slab(d, [(99, 0), (107, 0), (107, 110), (99, 106)], '#273531')
    stroke(d, [(104, 0), (104, 47), (100, 51), (100, 100)], '#566557', 3)
    stroke(d, [(103, 0), (103, 46), (99, 50), (99, 99)], '#778071')
    for x, y in ((104, 19), (104, 37), (100, 72), (100, 92)):
        box(d, (x - 2, y, x + 2, y + 1), '#384a3d')
    slab(d, [(90, 56), (96, 54), (96, 65), (90, 66)], '#6d7668')
    box(d, (92, 58, 94, 60), '#38463d')
    stroke(d, [(93, 66), (93, 72), (96, 74), (96, 93)], '#737d69')
    box(d, (93, 63, 94, 63), '#919782')
    stroke(d, [(85, 84), (88, 85), (88, 88), (91, 90)], '#566351')
    stroke(d, [(96, 0), (96, 6), (89, 14), (89, 22)], '#263631', 2)


def street_edges(d):
    # The masonry courses and gutters approach the same point beside the door.
    for near, far, shade in (
        ((0, 98), 47, '#526158'),
        (LEFT_CURB, 52, '#57665c'),
        (RIGHT_CURB, 84, '#56665c'),
    ):
        stroke(d, [near, receding_edge(near, far)], shade)


def overhead_wires(d):
    stroke(d, [(13, 0), (28, 14), (39, 22), (47, 26), (54, 26),
               (62, 22), (75, 11), (89, 0)], '#202c2e')
    stroke(d, [(21, 0), (34, 10), (46, 16), (55, 18), (62, 17),
               (70, 14), (83, 4)], '#2c3b3a')
    stroke(d, [(21, 39), (31, 46), (42, 51), (51, 53), (60, 53),
               (67, 50), (77, 42)], '#273530')
    stroke(d, [(32, 47), (43, 52), (50, 54)], '#62715d')


def street_clutter(d):
    # Bins and their shadows sit against each wall at different distances.
    slab(d, [(27, 83), (32, 80), (36, 81), (36, 89), (29, 93), (27, 92)], '#293a32')
    stroke(d, [(28, 84), (34, 81)], '#64725e')
    box(d, (31, 85, 31, 89), '#415348')
    slab(d, [(0, 96), (8, 94), (15, 97), (15, 106), (6, 110), (0, 108)], '#515749')
    slab(d, [(0, 96), (8, 93), (15, 96), (7, 100)], '#7d7963')
    slab(d, [(0, 98), (7, 100), (7, 109), (0, 107)], '#676953')
    stroke(d, [(4, 95), (11, 98)], '#a19a78')
    slab(d, [(7, 102), (8, 99), (12, 98), (13, 95), (15, 95), (16, 98),
             (20, 100), (21, 105), (18, 107), (10, 108), (7, 106)], '#25312c')
    stroke(d, [(10, 102), (12, 100), (14, 99)], '#556052')
    slab(d, [(86, 97), (89, 94), (92, 93), (94, 90), (97, 91), (97, 94),
             (100, 98), (102, 104), (100, 107), (90, 105), (85, 102)], '#25332e')
    stroke(d, [(88, 99), (91, 96), (94, 95)], '#536052')
    stroke(d, [(97, 97), (99, 100), (99, 103)], '#455246')
    slab(d, [(101, 102), (103, 97), (107, 97), (107, 109), (102, 107)], '#344239')
    # A little paper on the pavement and a rat close to the drain.
    slab(d, [(72, 108), (78, 107), (80, 109), (75, 111), (72, 110)], '#7d806a')
    box(d, (75, 108, 77, 108), '#9b9a80')
    stroke(d, [(24, 106), (23, 108), (19, 109), (17, 108)], '#80816c')
    slab(d, [(23, 106), (25, 103), (28, 102), (31, 103), (33, 105),
             (34, 105), (33, 106), (29, 107), (25, 107)], '#667162')
    box(d, (30, 101, 31, 103), '#8d8c75')
    box(d, (32, 104, 32, 104), '#283730')
    box(d, (33, 105, 34, 105), '#9b9175')
    box(d, (25, 107, 26, 107), '#8d8970')


def door_light(image):
    # A weak, stepped wash lets the existing masonry pick up reflected light.
    # Its falloff ends well inside the alley, far from the foreground facades.
    pixels = image.load()
    for y in range(49, 96):
        for x in range(43, 84):
            falloff = 1 - ((x - 64) / 20) ** 2 - ((y - 72) / 23) ** 2
            step = max(0, round(falloff * 5))
            if step:
                r, g, b = pixels[x, y]
                pixels[x, y] = (r + step * 4, g + step * 2, b - step)
    d = ImageDraw.Draw(image)
    # The light is inside the last doorway. The left leaf masks it, leaving
    # the far jamb, a sliver of lintel and two worn steps catching the light.
    slab(d, [(54, 64), (57, 61), (65, 60), (69, 62), (69, 77), (64, 81),
             (55, 81), (53, 78)], '#2c3028')
    slab(d, [(57, 64), (65, 61), (67, 62), (67, 78), (63, 80), (57, 78)], '#48432e')
    slab(d, [(58, 64), (65, 62), (66, 63), (66, 77), (62, 79), (58, 78)], '#786943')
    stroke(d, [(59, 64), (64, 63), (65, 63)], '#a58e59')
    stroke(d, [(65, 64), (65, 73)], '#b7a066')
    stroke(d, [(65, 74), (65, 76), (64, 77)], '#9f8957')
    slab(d, [(56, 64), (62, 65), (63, 66), (63, 78), (57, 79), (55, 77)], '#242923')
    stroke(d, [(61, 65), (63, 66), (63, 74)], '#554e34')
    box(d, (61, 71, 61, 71), '#706346')
    stroke(d, [(56, 79), (60, 79), (65, 77), (67, 77)], '#7c6b44')
    stroke(d, [(58, 80), (63, 80), (66, 79)], '#5c553c')
    # A little bounce on the returns, with dark masonry joints between them.
    stroke(d, [(66, 61), (69, 62), (71, 61)], '#45432f')
    stroke(d, [(67, 64), (70, 63), (72, 63)], '#504a33')
    stroke(d, [(68, 71), (70, 70)], '#494634')
    stroke(d, [(57, 66), (55, 65), (54, 65)], '#393b2c')
    # The threshold projects a narrowing source into broken glints on the wet
    # concrete. The vendor and bag interrupt it in the direction of the viewer.
    slab(d, [(60, 81), (66, 79), (71, 84), (77, 90), (70, 89), (65, 85),
             (59, 85), (61, 83), (57, 83)], '#37392c')
    stroke(d, [(58, 81), (63, 81), (66, 80)], '#776b48')
    stroke(d, [(61, 82), (65, 82), (67, 81)], '#8c794e')
    stroke(d, [(60, 84), (64, 84)], '#615b3e')
    for x, y, length, color in (
        (67, 83, 3, '#716344'), (66, 85, 4, '#665c40'), (70, 86, 2, '#82734d'),
        (64, 87, 3, '#4d4b37'), (68, 89, 5, '#56513a'), (71, 90, 3, '#61583e'),
        (67, 92, 4, '#444432'), (74, 94, 3, '#444434'), (71, 96, 4, '#34392e'),
    ):
        box(d, (x, y, x + length - 1, y), color)
    slab(d, [(76, 84), (79, 84), (86, 92), (90, 98), (85, 96), (79, 90)], '#11191a')
    slab(d, [(65, 94), (70, 94), (80, 102), (76, 101), (69, 98)], '#131b1c')


def street_plate():
    image = Image.new('RGB', (WIDTH, HEIGHT), '#394747')
    d = ImageDraw.Draw(image)
    far_passage(d)
    pavement(d)
    left_facades(d)
    right_facades(d)
    street_edges(d)
    overhead_wires(d)
    street_clutter(d)
    # Suppress the street's ambient value range before painting the only light.
    image = ImageOps.colorize(ImageOps.grayscale(image), black='#070c10', mid='#232e33',
                              white='#444b4d', blackpoint=15, midpoint=95, whitepoint=190)
    door_light(image)
    return image


def vendor_frame(background, reach=0, lift=0, swing=0):
    image = background.copy()
    d = ImageDraw.Draw(image)
    wrist, grip = 66 + reach, 82 + lift
    # One connected silhouette, from the ear through cheek, neck and shoulder
    # along the forearm to the paw. Only the wrist and suspended bag can sway.
    slab(d, [(82, 69), (79, 66), (75, 66), (73, 67), (69, 66), (69, 69), (70, 71),
             (69, 72), (70, 73), (68, 75), (70, 75), (69, 77), (71, 77), (71, 78),
             (74, 79), (73, 80), (wrist + 2, grip - 2), (wrist, grip - 1),
             (wrist, grip + 1), (wrist + 4, grip + 1), (75, 84), (79, 83), (82, 86)], '#1a211f')
    # The dark front edge of the wall hides the rest of the head and back.
    slab(d, [(77, 66), (82, 67), (82, 86), (80, 84), (77, 80), (77, 76), (78, 71)], '#121a1b')
    # A broken rim only on the fur turned toward the door. The face and the
    # far shoulder stay at almost the same value as the recess around them.
    slab(d, [(69, 66), (72, 68), (72, 70), (70, 69)], '#605940')
    stroke(d, [(69, 66), (70, 67)], '#9b875a')
    box(d, (70, 69, 70, 69), '#3c3d30')
    stroke(d, [(73, 68), (75, 67), (77, 67)], '#494937')
    box(d, (74, 67, 75, 67), '#686046')
    stroke(d, [(71, 71), (74, 71), (75, 72)], '#121a19')
    box(d, (71, 72, 73, 72), '#57533c')
    box(d, (72, 72, 72, 72), '#827650')
    slab(d, [(69, 74), (71, 74), (73, 75), (72, 76), (70, 76)], '#393d30')
    stroke(d, [(68, 75), (69, 74), (70, 74)], '#776b47')
    box(d, (70, 76, 70, 76), '#766b4a')
    box(d, (75, 74, 76, 74), '#31372c')
    stroke(d, [(71, 77), (72, 78), (74, 78)], '#474736')
    stroke(d, [(77, 79), (75, 80), (73, 81), (wrist + 3, grip)], '#414333', 2)
    stroke(d, [(74, 79), (73, 80), (wrist + 3, grip - 1)], '#766b48')
    # Anchor the tied handles at the grip. Sway increases towards the bottom.
    def bag(points, color):
        slab(d, [(wrist + x + round(swing * y / 14), grip + y) for x, y in points], color)

    bag([(-1, 0), (1, 0), (3, 4), (5, 6), (6, 9), (6, 12), (4, 14),
         (-3, 14), (-5, 12), (-5, 8), (-4, 6), (-1, 3)], '#090f11')
    bag([(-1, 2), (0, 1), (0, 4), (-3, 7), (-4, 8), (-3, 5)], '#726747')
    bag([(-4, 8), (-4, 10), (-5, 11), (-5, 9)], '#514c38')
    bag([(2, 5), (4, 7), (5, 11), (3, 12), (3, 9)], '#202826')
    bag([(-2, 8), (-1, 8), (-2, 12), (-3, 12)], '#32352b')
    box(d, (wrist - 1, grip - 1, wrist + 3, grip), '#615b42')
    box(d, (wrist, grip - 2, wrist + 2, grip - 2), '#a28f61')
    box(d, (wrist + 1, grip + 1, wrist + 2, grip + 1), '#393c30')
    return image


def vendor_pet_face(background):
    # The head is fixed across all bag poses. Retract the near ear against the
    # original wall and close the one visible eye, leaving everything else clear.
    touch = Image.new('RGBA', (WIDTH, HEIGHT))
    for x, y in [(69, 66), (70, 66), (71, 66), (69, 67), (70, 67)]:
        touch.putpixel((x, y), background.getpixel((x, y)) + (255,))
    d = ImageDraw.Draw(touch)
    slab(d, [(68, 68), (71, 68), (72, 70), (70, 70)], '#59563f')
    stroke(d, [(68, 68), (70, 68)], '#94825a')
    box(d, (71, 71, 75, 72), '#21281f')
    stroke(d, [(71, 72), (72, 73), (74, 73)], '#6a6349')
    return touch.crop((68, 66, 76, 74))


def draw_black_market(directory):
    background = street_plate()
    poses = ((0, 0, 0), (-1, 0, -1), (-1, 0, -3), (0, 0, -1),
             (0, 0, 0), (1, -1, 2), (1, 0, 1))
    frames = [vendor_frame(background, *pose) for pose in poses]
    frames[0].save(directory / 'black-market-still.webp', lossless=True, method=6)
    frames[0].save(directory / 'black-market.webp', save_all=True, append_images=frames[1:],
                   duration=(800, 135, 190, 145, 350, 160, 230), loop=0, lossless=True, method=6)
    vendor_pet_face(background).save(directory / 'black-market-pet.webp', lossless=True, method=6)
