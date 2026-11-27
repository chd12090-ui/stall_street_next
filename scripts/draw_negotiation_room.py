"""Paint the negotiation room on the same 108-pixel grid as the other venues."""

from pathlib import Path
import sys

from PIL import Image, ImageChops, ImageDraw


SIZE = (108, 86)
EXTRA_CEILING = 5
ROOM_SIZE = (SIZE[0], SIZE[1] - EXTRA_CEILING)
CEILING = '#080f15'
HORIZON = (55, 33)
FACE_CENTER = 55
EYE_CENTERS = (FACE_CENTER - 4, FACE_CENTER + 4)
SITTER_BOUNDS = (37, 22, 73, 53)

# All depth edges use the eye line of the visitor sitting opposite the cat.
def project(x, y, scale):
    cx, cy = HORIZON
    return round(cx + (x - cx) * scale), round(cy + (y - cy) * scale)


def side(draw, x, top, bottom, far, near, color):
    draw.polygon([project(x, top, far), project(x, top, near),
                  project(x, bottom, near), project(x, bottom, far)], color)


def ceiling_above_room():
    strip = Image.new('RGB', (SIZE[0], EXTRA_CEILING), CEILING)
    draw = ImageDraw.Draw(strip)

    def ceiling_point(x, y, scale):
        px, py = project(x, y, scale)
        return px, py + EXTRA_CEILING

    # The wall corners and ceiling joints continue along the same projection
    # as the room below. Their angle remains continuous at the frame boundary.
    for x, color in ((26, '#101d24'), (82, '#0b151c')):
        draw.polygon([ceiling_point(x, 15, 1), ceiling_point(x, 15, 2.35),
                      ceiling_point(x, 47, 2.35), ceiling_point(x, 47, 1)], color)
    # The pendant cable terminates at a shallow ceiling canopy.
    draw.line((54, 2, 54, EXTRA_CEILING - 1), fill='#070f15')
    draw.line((55, 2, 55, EXTRA_CEILING - 1), fill='#17242b')
    draw.rectangle((51, 1, 58, 2), fill='#15222a')
    draw.line((52, 1, 57, 1), fill='#2c3a40')
    draw.line((53, 2, 56, 2), fill='#1e2b31')
    return strip


def room(d):
    wall, concrete = '#17212a', '#142129'
    d.rectangle((0, 0, ROOM_SIZE[0] - 1, ROOM_SIZE[1] - 1), CEILING)
    side(d, 26, 15, 47, 1, 2.35, '#101d24')
    side(d, 82, 15, 47, 1, 2.35, '#0b151c')
    d.polygon([(26, 47), (82, 47), (140, 77), (150, 82),
               (-41, 82), (-31, 77)], '#141e25')
    d.rectangle((26, 15, 82, 47), wall)

    # Stained concrete panels, one-way glass and two quiet office fixtures.
    d.rectangle((27, 16, 81, 17), '#142129')
    d.rectangle((27, 18, 81, 43), '#182329')
    d.rectangle((27, 18, 29, 43), '#16222a')
    d.rectangle((76, 18, 81, 43), '#16222a')
    for x in (36, 74):
        d.line((x, 19, x, 43), fill='#19252b')
    for x in (29, 78):
        for y in (19, 41):
            d.point((x, y), fill='#142129')
    d.rectangle((27, 44, 81, 46), '#142129')
    side(d, 26, 44, 46.5, 1, 2.32, '#132129')
    side(d, 82, 44, 46.5, 1, 2.32, '#101a21')
    # A few low-contrast floor planes carry the perspective into shadow.
    d.polygon([project(29, 47, 1.03), project(42, 47, 1.03),
               project(42, 47, 3.6), project(29, 47, 3.6)], '#172127')
    d.polygon([project(71, 47, 1.03), project(81, 47, 1.03),
               project(81, 47, 3.6), project(71, 47, 3.6)], '#121d24')

    # Glass, sill and door read as adjacent planes. The window's reflections
    # and handle catch light while the recesses merge with their walls.
    side(d, 26, 22, 36, 1.11, 1.97, '#14222a')
    side(d, 26, 22, 33, 1.11, 1.97, '#1a282e')
    d.polygon([(1, 20), (2, 15), (9, 18), (3, 25), (1, 25)], '#1e2c32')
    d.polygon([(8, 24), (13, 19), (16, 19), (9, 26)], '#1e2c32')
    side(d, 26, 36, 36.8, 1.12, 1.96, '#202e34')
    side(d, 82, 20.4, 46.5, 1.25, 1.70, '#19262d')
    side(d, 82, 20.4, 46.5, 1.67, 1.70, '#142129')
    side(d, 82, 24, 27.6, 1.37, 1.58, '#111c23')
    side(d, 82, 24.8, 27.4, 1.38, 1.56, '#263239')
    side(d, 82, 43.3, 45.6, 1.33, 1.62, '#1e2b31')
    d.line([project(82, 34.4, 1.32), project(82, 34.4, 1.42)], fill='#354348')
    d.rectangle((84, 29, 85, 32), '#121e25')
    d.point((84, 29), fill='#29373c')
    # A little vent at the far wall looks smaller than the fittings near us.
    d.rectangle((75, 22, 79, 25), concrete)
    for y in (23, 25):
        d.line((75, y, 79, y), fill='#29373c')

    # A skirt around the lamp keeps direct light on the top of the sitter's
    # head. Only a few short steps of reflected light reach the wall.
    d.polygon([(51, 17), (59, 17), (62, 23), (64, 29),
               (46, 29), (48, 22)], '#1d282d')
    d.polygon([(52, 17), (58, 17), (60, 22), (61, 25),
               (49, 25), (50, 21)], '#232c2e')
    d.polygon([(53, 17), (57, 17), (59, 21), (51, 21)], '#2a3232')
    d.line((54, 0, 54, 8), fill='#070f15')
    d.line((55, 0, 55, 8), fill='#17242b')
    d.rectangle((53, 8, 56, 10), '#394347')
    d.polygon([(52, 9), (57, 9), (60, 11), (63, 12), (65, 14),
               (44, 14), (46, 12), (49, 11)], '#26323a')
    d.line([(46, 13), (50, 11), (52, 10), (56, 10)], fill='#3c494d')
    d.rectangle((44, 14, 65, 15), '#0c161e')
    d.line((46, 15, 64, 15), fill='#514f44')
    d.line((49, 16, 61, 16), fill='#a39779')
    d.line((50, 16, 60, 16), fill='#e6dcc2')
    d.line((53, 16, 57, 16), fill='#f5eacf')


def desk_layer():
    # The back edge crosses the sitter's waist; only the propped forearms
    # project over it. Trim the original table along its perspective rays.
    layer = Image.new('RGBA', ROOM_SIZE)
    d = ImageDraw.Draw(layer)
    far_l, far_r = 37, 73
    far_y, near_scale = 48, 2.4
    back_l, back_r = (far_l, far_y), (far_r, far_y)
    near_l, near_r = project(far_l, far_y, near_scale), project(far_r, far_y, near_scale)
    # Beyond the front lip the legs meet the floor and the cast shadow
    # feathers out, exposing the foreground continuation of the tile joints.
    d.polygon([(15, 76), (105, 76), (103, 77), (96, 78), (79, 79),
               (39, 79), (24, 78), (18, 77)], '#121c23')
    d.polygon([(36, 50), (75, 50), (102, 72), (106, 75), (105, 76),
               (98, 77), (83, 78), (42, 78), (23, 77), (14, 75),
               (10, 72)], '#10191f')
    d.ellipse((11, 77, 21, 79), fill='#0f191f')
    d.ellipse((89, 77, 99, 79), fill='#0f191f')
    d.polygon([(13, 71), (18, 71), (18, 77), (17, 78), (14, 78),
               (14, 75)], '#0a1218')
    d.polygon([(91, 71), (96, 71), (95, 75), (95, 78), (92, 78),
               (91, 77)], '#0a1218')
    d.polygon([back_l, back_r, near_r, near_l], '#212d33')
    d.polygon([back_l, (45, 48), (31, 64), (23, 68), (13, 68)], '#1c292f')
    d.polygon([(64, 48), back_r, near_r, (87, 69), (78, 64)], '#17242a')

    # The lamp's footprint projects as an ellipse on the table. Clip it to
    # the actual plane so the floor and the near lip keep their ambient light.
    spill = Image.new('RGBA', ROOM_SIZE)
    falloff = ImageDraw.Draw(spill)
    for bounds, tint in (
        ((25, 42, 85, 64), '#293337'),
        ((27, 43, 83, 62), '#30383a'),
        ((29, 44, 81, 60), '#393e3d'),
        ((32, 45, 78, 59), '#414440'),
        ((35, 46, 75, 57), '#494943'),
        ((40, 48, 70, 55), '#535148'),
    ):
        falloff.ellipse(bounds, fill=tint)
    plane = Image.new('L', ROOM_SIZE)
    ImageDraw.Draw(plane).polygon([back_l, back_r, near_r, near_l], fill=255)
    layer.paste(spill, mask=ImageChops.multiply(plane, spill.getchannel('A')))

    # Short shadows fall forward below the upper body and the two elbows.
    # Their soft edges taper out into the light around the planted sleeves.
    d.polygon([(46, 50), (64, 50), (66, 51), (64, 53), (60, 54),
               (52, 54), (48, 53)], '#3d413f')
    d.polygon([(47, 50), (63, 50), (64, 51), (62, 52), (59, 53),
               (51, 53), (48, 52)], '#303839')
    d.polygon([(48, 50), (62, 50), (62, 51), (59, 52),
               (52, 52), (49, 51)], '#222d31')
    d.ellipse((37, 50, 48, 54), fill='#30383a')
    d.ellipse((63, 50, 73, 54), fill='#303739')
    # At this shallow angle the far edge disappears in the sitter's shadow.
    # Keep the broad front fascia as a single plane below the lit tabletop.
    lx, ly = near_l
    rx, ry = near_r
    d.rectangle((lx, ly, rx, ry + 2), '#162229')
    # Two grounded elbows, with clear tabletop visible between them.
    d.polygon([(39, 51), (45, 50), (48, 52), (46, 53),
               (40, 53), (38, 52)], '#152027')
    d.polygon([(64, 50), (69, 50), (72, 52), (70, 53),
               (65, 53), (63, 52)], '#142026')
    top = project(far_l, far_y, 1.1)[1]
    layer.paste((0, 0, 0, 0), (0, 0, layer.width, top))
    return layer


def jacket(d):
    # Pressed sleeve heads extend a pixel past the top of each upper arm.
    # The elbows sit farther forward and a little wider than the shoulders.
    d.polygon([(48, 33), (51, 34), (55, 37), (59, 34), (62, 33),
               (68, 35), (71, 36), (70, 37), (71, 40), (72, 44),
               (72, 48), (70, 51), (65, 51), (45, 51), (40, 51),
               (37, 49), (37, 44), (38, 40), (39, 37), (38, 36),
               (42, 35), (45, 34)], '#1a252c')

    # The upper arm turns toward the desk. Keep the lit shoulder and biceps
    # in one continuous fabric plane; the underarm stays close to black.
    d.polygon([(48, 33), (49, 34), (46, 37), (43, 39), (43, 42),
               (42, 45), (40, 48), (38, 49), (37, 47), (38, 42),
               (39, 38), (38, 36), (42, 35), (45, 34)], '#293438')
    d.polygon([(47, 34), (48, 33), (47, 35), (43, 37), (41, 39),
               (40, 39), (41, 36)], '#353d3e')
    d.polygon([(43, 39), (45, 37), (46, 37), (44, 41), (44, 43),
               (42, 46), (40, 48), (42, 44)], '#212d32')

    # The sleeve turned away from the lamp gets a narrower and dimmer light.
    d.polygon([(61, 33), (65, 34), (68, 35), (71, 36), (70, 37),
               (71, 40), (72, 45), (72, 48), (70, 50), (68, 47),
               (68, 43), (67, 40), (65, 37), (62, 36)], '#242f34')
    d.polygon([(62, 33), (66, 35), (68, 36), (69, 39), (68, 39),
               (66, 37), (63, 35)], '#303a3c')

    # A light shirt triangle and the asymmetric notch of each lapel establish
    # the chest of a suit even where the wrists cover the collar.
    d.polygon([(49, 35), (54, 36), (60, 35), (59, 40), (55, 46),
               (51, 41)], '#343a3b')
    d.polygon([(47, 34), (50, 35), (51, 38), (54, 44), (55, 48),
               (50, 43), (46, 40), (47, 38), (45, 38)], '#2c373b')
    d.polygon([(59, 35), (62, 34), (64, 37), (62, 38), (64, 39),
               (61, 42), (56, 47), (57, 42)], '#242f36')
    d.polygon([(53, 39), (56, 39), (56, 41), (55, 42), (56, 45),
               (55, 47), (54, 46), (54, 42)], '#151e26')


def face(d, closed_eyes):
    # A single square per eye leaves the lenses and brow legible at 1×.
    d.polygon([(46, 28), (47, 28), (47, 22), (49, 22), (52, 25),
               (58, 25), (61, 22), (63, 22), (63, 27), (64, 29),
               (64, 32), (63, 32), (63, 34), (61, 34), (61, 35),
               (59, 35), (59, 36), (57, 36), (57, 37), (52, 37),
               (52, 36), (50, 36), (50, 35), (48, 35), (48, 34),
               (47, 34), (47, 32), (46, 32)], '#212d32')
    d.polygon([(61, 23), (63, 22), (63, 27), (64, 29), (64, 32),
               (63, 32), (63, 34), (61, 34), (61, 35), (59, 35),
               (58, 36), (59, 33), (61, 32)], '#1c292f')
    d.polygon([(48, 24), (50, 26), (48, 26)], '#3f3937')
    d.polygon([(60, 26), (62, 24), (62, 26)], '#333135')
    # The hard edge follows the upward-facing fur. The front plane falls into
    # shadow immediately below the two rows of lit crown and ear tips.
    d.line((47, 23, 47, 25), fill='#4b493e')
    d.line((63, 23, 63, 25), fill='#3d3f38')
    d.polygon([(47, 22), (49, 22), (50, 23), (50, 24),
               (48, 24), (47, 23)], '#897b60')
    d.polygon([(61, 22), (63, 22), (63, 23), (62, 24),
               (60, 24), (60, 23)], '#766b55')
    d.line((47, 22, 49, 22), fill='#cdbd9a')
    d.line((61, 22, 63, 22), fill='#beaf90')
    d.point((48, 22), fill='#e6d9b7')
    d.point((62, 22), fill='#ded0ac')
    d.point((49, 23), fill='#ad9873')
    d.point((61, 23), fill='#a19073')
    d.point((51, 24), fill='#4a493f')
    d.point((59, 24), fill='#42423c')
    # The two inward-sloping ear rims are in shadow. A separate, shallow
    # patch picks out the upper plane of the forehead rather than its outline.
    d.polygon([(52, 25), (58, 25), (57, 26), (55, 27), (53, 26)],
              '#80745a')
    d.line((52, 25, 54, 25), fill='#c2b08c')
    d.line((54, 25, 55, 25), fill='#e3d4af')
    d.point((56, 25), fill='#d3c2a1')
    d.point((57, 25), fill='#aa9a7c')
    d.line((54, 26, 55, 26), fill='#b09a76')
    d.point((56, 26), fill='#c0a983')
    d.point((55, 27), fill='#695f4a')
    d.line((46, 29, 48, 29), fill='#232f33')
    d.line((47, 32, 49, 32), fill='#232f33')
    d.line((62, 29, 64, 29), fill='#243138')
    d.line((61, 33, 62, 33), fill='#1c282d')
    d.polygon([(50, 34), (51, 32), (53, 32), (54, 33), (56, 33),
               (57, 32), (59, 32), (60, 34), (58, 35), (56, 36),
               (54, 36), (52, 35)], '#2b3538')

    # Each eye sits exactly in the middle of its lens. Keep the same clear
    # margin on both sides, with the bridge, nose and mouth on the centerline.
    d.line([(46, 28), (47, 28), (48, 29)], fill='#364246')
    d.line([(62, 29), (63, 28), (64, 28)], fill='#364246')
    for eye in EYE_CENTERS:
        left, right = eye - 3, eye + 3
        d.rectangle((left + 1, 29, right - 1, 31), fill='#263136')
        d.line([(left, 29), (left, 32), (left + 1, 33), (right - 1, 33),
                (right, 32), (right, 29)], fill='#2b383c')
        d.line((left, 28, right, 28), fill='#333e40')
        # Only the upward-facing metal catches the light; the lenses stay clear.
        d.line((eye - 1, 28, eye + 1, 28), fill='#696b60')
        inward = eye + 1 if eye < FACE_CENTER else eye - 1
        d.point((inward, 28), fill='#8d8975')
        if closed_eyes:
            d.point((eye, 31), fill='#1f2b31')
        else:
            d.point((eye, 30), fill='#0a141a')
    cx = FACE_CENTER
    d.line((cx - 1, 29, cx + 1, 29), fill='#364246')
    d.line((cx - 1, 32, cx + 1, 32), fill='#3e3d3a')
    d.point((cx, 33), fill='#252c2e')
    d.line((cx - 1, 34, cx + 1, 34), fill='#1a242b')


def folded_arms(d):
    # Both elbows touch the table. The bent forearms cross *in front* of
    # the upper sleeves, and taper toward the wrists under the chin.
    d.polygon([(37, 49), (39, 47), (43, 44), (46, 41), (48, 39),
               (51, 41), (49, 44), (45, 47), (43, 50), (41, 52),
               (39, 52), (37, 51)], '#202c32')
    d.polygon([(38, 49), (41, 46), (47, 41), (48, 40), (49, 41),
               (46, 44), (43, 46), (40, 49), (39, 50)], '#364044')
    d.polygon([(39, 50), (42, 48), (46, 45), (49, 42),
               (49, 44), (45, 47), (42, 50), (40, 51)], '#29353b')
    d.polygon([(59, 41), (61, 39), (63, 40), (66, 43), (70, 46),
               (72, 48), (72, 51), (70, 52), (68, 52), (65, 49),
               (62, 46)], '#1e2930')
    d.polygon([(61, 41), (62, 40), (66, 44), (69, 46), (71, 48),
               (71, 50), (68, 48), (65, 45)], '#2e393f')
    d.polygon([(47, 40), (48, 39), (51, 41), (50, 43)], '#484e4b')
    d.point((48, 40), fill='#686959')
    d.polygon([(59, 41), (61, 39), (62, 40), (60, 43)], '#3d4747')
    d.point((61, 40), fill='#5a6056')

    # Opposing wrists support an overlapping clasp directly beneath the chin.
    d.line([(50, 35), (52, 36), (56, 36), (58, 35)], fill='#1a252b')
    d.polygon([(53, 39), (55, 38), (57, 36), (59, 36), (61, 39),
               (60, 40), (58, 42), (56, 41), (54, 40)], '#273134')
    d.line([(56, 38), (58, 37), (59, 37)], fill='#74705d')
    d.point((58, 37), fill='#8a8068')
    d.line((58, 38, 59, 38), fill='#575c52')
    d.line([(56, 40), (58, 40), (60, 38)], fill='#363f3d')
    d.line([(57, 41), (59, 41), (60, 40)], fill='#1c292d')
    d.polygon([(48, 39), (50, 37), (52, 36), (54, 37), (56, 37),
               (58, 38), (57, 39), (54, 39), (52, 41),
               (51, 42), (49, 40)], '#2d3838')
    d.line([(49, 39), (51, 37), (53, 37)], fill='#837e68')
    d.line((50, 38, 51, 38), fill='#646555')
    d.line([(53, 38), (55, 38), (56, 39)], fill='#676655')
    d.line([(51, 41), (53, 39), (55, 39)], fill='#243236')
    d.point((52, 37), fill='#a4987c')


def desk_items(d):
    # A pay folder on the visitor's side and a dictaphone near the negotiator.
    d.polygon([(28, 60), (39, 60), (40, 61), (45, 61), (43, 65),
               (23, 65)], '#172127')
    d.polygon([(29, 59), (35, 59), (35, 60), (44, 60), (42, 64),
               (24, 64)], '#343a37')
    d.polygon([(29, 60), (42, 60), (40, 63), (26, 63)], '#414646')
    d.line((32, 60, 35, 60), fill='#253038')
    d.line((30, 61, 37, 61), fill='#353d3d')
    d.line((29, 62, 34, 62), fill='#303a3c')
    d.line((43, 64, 47, 60), fill='#1b272c')
    d.point((47, 60), fill='#515655')
    d.polygon([(70, 54), (73, 54), (76, 56), (71, 56)], '#14212a')
    d.line((70, 54, 73, 54), fill='#384242')
    d.point((73, 55), fill='#403837')

    # A short stack of brass coins sits at the shaded edge. Only their left
    # rims catch the pendant; the small ellipses lie flat on the tabletop.
    shadow, edge, side = '#152026', '#2e2d28', '#403a2e'
    brass, relief, glint = '#574e38', '#4c4637', '#928264'
    d.ellipse((75, 61, 86, 64), fill=shadow)
    d.ellipse((80, 63, 89, 66), fill=shadow)
    d.ellipse((75, 59, 83, 63), fill=edge)
    d.line((76, 62, 81, 62), fill=side)
    d.line((76, 61, 79, 61), fill=brass)
    d.line((77, 63, 80, 63), fill=relief)
    d.ellipse((74, 58, 82, 61), fill=edge)
    d.line((75, 60, 79, 60), fill=brass)
    d.ellipse((75, 57, 83, 60), fill=edge)
    d.ellipse((75, 57, 83, 59), fill=brass)
    d.point((79, 58), fill='#665a43')
    d.point((80, 58), fill=relief)
    d.line((77, 57, 78, 57), fill=glint)
    # One coin lies separately in front, with its stamped center just visible.
    d.ellipse((81, 62, 88, 65), fill=edge)
    d.ellipse((81, 62, 88, 64), fill=brass)
    d.point((85, 63), fill=relief)
    d.point((83, 62), fill=glint)


def backdrop(table):
    image = Image.new('RGB', ROOM_SIZE)
    room(ImageDraw.Draw(image))
    image.paste(table, mask=table)
    desk_items(ImageDraw.Draw(image))
    framed = Image.new('RGB', SIZE)
    framed.paste(ceiling_above_room(), (0, 0))
    framed.paste(image, (0, EXTRA_CEILING))
    return framed


def sitter(table, closed_eyes=False):
    actor = Image.new('RGBA', ROOM_SIZE)
    draw = ImageDraw.Draw(actor)
    jacket(draw)
    face(draw, closed_eyes)
    # The jacket is behind the table; the weight-bearing elbows rest on it.
    actor.putalpha(ImageChops.subtract(actor.getchannel('A'), table.getchannel('A')))
    folded_arms(draw)
    return actor.crop(SITTER_BOUNDS)


def blink_overlay(actor, closed):
    changed = ImageChops.difference(actor.convert('RGB'), closed.convert('RGB'))
    mask = changed.convert('L').point(lambda value: 255 if value else 0)
    overlay = Image.new('RGBA', actor.size)
    overlay.paste(closed, mask=mask)
    return overlay


def lamp_dimmer(background):
    # A transparent, registered mask modulates the existing lit pixels only.
    overlay = Image.new('RGBA', SIZE)
    for box, ambient, full_light, attenuation in (
        ((46, 20, 65, 22), 48, 210, 25),   # Warm emission at the pendant's lip
        ((24, 54, 89, 71), 44, 81, 24),    # Pool on the table and brass coin rims
    ):
        x0, y0, x1, y1 = box
        for y in range(y0, y1):
            for x in range(x0, x1):
                light = background.getpixel((x, y))[0]
                strength = min(1, max(0, (light - ambient) / (full_light - ambient)))
                if strength:
                    overlay.putpixel((x, y), (14, 21, 25, round(strength * attenuation)))
    return overlay


if __name__ == '__main__':
    default = Path(__file__).resolve().parents[1] / 'public/art/pixel/negotiation-room.webp'
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    table = desk_layer()
    base = backdrop(table)
    actor = sitter(table)
    for suffix, image in (
        ('', base),
        ('-cat', actor),
        ('-blink', blink_overlay(actor, sitter(table, closed_eyes=True))),
        ('-light', lamp_dimmer(base)),
    ):
        image.save(path.with_stem(path.stem + suffix), lossless=True, method=6)
