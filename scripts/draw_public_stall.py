"""One-point perspective for a narrow public restroom stall behind the player."""
from PIL import Image, ImageDraw

SIZE = (160, 320)
DRIP_MS = (2280, 145, 75, 75, 180)
VANISH_X, VANISH_Y = 80, 123
LEFT, RIGHT = 45, 115
WALL_TOP, PANEL_BOTTOM, FLOOR_Y = 62, 182, 188
NEAR = 2.55


def project(x, y, scale):
    return (round(VANISH_X + (x - VANISH_X) * scale),
            round(VANISH_Y + (y - VANISH_Y) * scale))


def side_band(x, top, bottom, far, near):
    return (project(x, top, far), project(x, top, near),
            project(x, bottom, near), project(x, bottom, far))


def draw_floor(art):
    art.rectangle((0, FLOOR_Y, 159, 319), fill='#7b8780')
    scales = [1 / (1 - row * .092) for row in range(8)]
    scales.append((320 - VANISH_Y) / (FLOOR_Y - VANISH_Y))
    joints = tuple(range(LEFT - 56, RIGHT + 57, 14))
    for row, (far, near) in enumerate(zip(scales, scales[1:])):
        for column, (a, b) in enumerate(zip(joints, joints[1:])):
            if (column + row * 2) % 5 in (0, 1):
                art.polygon((project(a, FLOOR_Y, far), project(b, FLOOR_Y, far),
                             project(b, FLOOR_Y, near), project(a, FLOOR_Y, near)),
                            fill='#87938a')
        y = project(LEFT, FLOOR_Y, far)[1]
        art.line((0, y, 159, y), fill='#697d73')
    for x in joints:
        art.line((project(x, FLOOR_Y, 1), project(x, FLOOR_Y, scales[-1])),
                 fill='#687a70')

    # Keep the grate parallel to the floor grid, with its front edge slightly wider.
    near, far = 1.59, 1.52
    art.polygon((project(100, FLOOR_Y, near), project(107, FLOOR_Y, near),
                 project(107, FLOOR_Y, far), project(100, FLOOR_Y, far)),
                fill='#4d645e')
    art.line((project(100, FLOOR_Y, far), project(107, FLOOR_Y, far)), fill='#a0aea2')
    for x in (102, 104, 106):
        art.line((project(x, FLOOR_Y, far), project(x, FLOOR_Y, near)),
                 fill='#82968b')


def draw_partition(art, x, panel, top_light, lower_trim, shade):
    poly, line, box = art.polygon, art.line, art.rectangle
    # Narrow air gap under each suspended panel, separated from the tiles.
    poly(side_band(x, PANEL_BOTTOM, FLOOR_Y, 1, NEAR), fill=shade)
    poly(side_band(x, WALL_TOP, PANEL_BOTTOM, 1, NEAR), fill=panel)
    poly(side_band(x, WALL_TOP, WALL_TOP + 2, 1, NEAR), fill=top_light)
    poly(side_band(x, PANEL_BOTTOM - 3, PANEL_BOTTOM, 1, NEAR), fill=lower_trim)
    line((project(x, WALL_TOP, 1), project(x, FLOOR_Y, 1)), fill=lower_trim)
    for scale in (1.17, 1.91):
        top, bottom = project(x, WALL_TOP, scale), project(x, FLOOR_Y, scale)
        line((top, bottom), fill=lower_trim, width=2)
        # Bracket and foot go all the way to the floor-plane seam.
        rail_x, foot_y = bottom
        box((rail_x - 2, foot_y - 1, rail_x + 2, foot_y), fill=shade)
        line((rail_x + 1, top[1], rail_x + 1, foot_y - 2), fill=top_light)


def draw_fixtures(art):
    poly, line, box = art.polygon, art.line, art.rectangle
    # Paper dispenser fixed to the left partition, extruded toward the toilet.
    mount = side_band(LEFT, 135, 148, 1.23, 1.52)
    face = tuple((x + 4, y + 1) for x, y in mount)
    poly(mount, fill='#687e70')
    poly((mount[0], mount[1], face[1], face[0]), fill='#ced2b9')
    poly((mount[1], mount[2], face[2], face[1]), fill='#718678')
    poly(face, fill='#a8b2a0')
    opening = tuple((x + 4, y + 1) for x, y in
                    (project(LEFT, 144, 1.27), project(LEFT, 144, 1.49)))
    line(opening, fill='#5d7164', width=2)
    left, right = sorted(opening)
    poly((left, right, (right[0], right[1] + 7), (left[0] + 1, left[1] + 8)), fill='#e6e2c5')
    line((left[0] + 1, left[1] + 8, right[0], right[1] + 7), fill='#c6c7af')

    # Occupied slide indicator aligned to the angle of the right partition.
    poly(side_band(RIGHT, 135, 144, 1.66, 1.94), fill='#526a61')
    poly(side_band(RIGHT, 136, 143, 1.69, 1.92), fill='#bac3b1')
    poly(side_band(RIGHT, 137, 139, 1.75, 1.89), fill='#9d6354')
    line((project(RIGHT, 141, 1.63), project(RIGHT, 141, 1.82)), fill='#e0dfc6', width=2)

    # Compact exposed supply behind the cistern without a separate basin.
    line(((105, 156), (105, 173), (100, 173)), fill='#819588', width=3)
    line(((104, 156), (104, 172), (100, 172)), fill='#b9c2ad')
    box((102, 153, 107, 156), fill='#6b8071')
    line((102, 153, 107, 153), fill='#cdd6ba')
    box((107, 157, 110, 159), fill='#8a9c8d')
    line((109, 159, 109, 161), fill='#667f70')
    line((106, 191, 113, 191), fill='#6c8379')


def stall_frames():
    image = Image.new('RGB', SIZE, '#899d8f')
    art = ImageDraw.Draw(image)
    box, line = art.rectangle, art.line

    # Back wall sits at projection scale 1, where both partitions and floor meet.
    box((LEFT, WALL_TOP, RIGHT, FLOOR_Y), fill='#929b8b')
    for row, y in enumerate(range(WALL_TOP + 1, FLOOR_Y, 12)):
        for column, x in enumerate(range(LEFT, RIGHT, 14)):
            shade = '#bec5ae' if (2 * row + column) % 7 == 0 else '#b3bda6'
            box((x, y, min(x + 12, RIGHT), min(y + 10, FLOOR_Y)), fill=shade)
    box((LEFT, 184, RIGHT, FLOOR_Y), fill='#758577')
    line((LEFT, 184, RIGHT, 184), fill='#8f9d87')
    box((54, 68, 106, 74), fill='#758a7b')
    box((56, 67, 104, 71), fill='#d4d8ba')
    line((58, 67, 102, 67), fill='#e6e7cc')

    draw_floor(art)
    draw_partition(art, LEFT, '#a7ae93', '#bac3a7', '#75897b', '#687d72')
    draw_partition(art, RIGHT, '#889e90', '#a8b6a5', '#637d70', '#566e65')
    draw_fixtures(art)

    frames = [image]
    for y in (162, 173, 184):
        frame = image.copy()
        drop = ImageDraw.Draw(frame)
        drop.point((109, y), fill='#d7e5d6')
        drop.point((109, y + 1), fill='#a5c2bb')
        frames.append(frame)
    frame = image.copy()
    ImageDraw.Draw(frame).line((108, 190, 111, 190), fill='#c9d7c8')
    frames.append(frame)
    return frames
