"""A pavement news kiosk. The live masthead is typeset on its enamel fascia."""
from PIL import Image, ImageDraw

SKY, DISTANT, BUILDING = '#b8c9be', '#a9bab0', '#94a9a0'
PAVING, EDGE, ROAD = '#b5b5a1', '#8f998e', '#747f76'
STEEL, EDGE_LIT, INK = '#47635d', '#708979', '#2c4541'
WINDOW, GLASS = '#4e6a62', '#81998b'
CANVAS, RED, RED_SHADOW = '#ede3c6', '#a34f3e', '#7e4236'
PAGE, FOLD, PRINT = '#e5ddbd', '#bbbba4', '#6e7a70'


def front_page(d, x, y, width, height, mast, photo_on_left=False):
    """Two columns, a masthead and one visibly halftoned photograph."""
    right, bottom = x + width - 1, y + height - 1
    d.rectangle((x + 1, y + 1, right + 1, bottom + 1), fill=INK)
    d.rectangle((x, y, right, bottom), fill=PAGE)
    d.line((x + 1, y + 1, right - 1, y + 1), fill=mast)
    d.line((x + 1, y + 3, right - 2, y + 3), fill=PRINT)
    split = x + width // 2
    a, b = (x + 1, split - 1) if photo_on_left else (split + 1, right - 1)
    d.rectangle((a, y + 5, b, bottom - 2), fill=PRINT)
    if b - a >= 3:
        d.line((a, bottom - 3, b - 1, y + 6), fill=FOLD)
    a, b = (split + 1, right - 1) if photo_on_left else (x + 1, split - 1)
    for row in range(y + 5, bottom, 2):
        d.line((a, row, b, row), fill=FOLD)


def seller(pose):
    # A ginger newsvendor in a baker-boy cap, including the paper in their paws.
    sprite = Image.new('RGBA', (24, 27))  # The counter hides the 28th pixel row.
    d = ImageDraw.Draw(sprite)
    fur, shade, cream = '#c39262', '#aa7750', '#ebce9c'
    d.polygon(((2,26),(3,20),(6,18),(17,18),(21,21),(22,27)),fill='#475953')
    d.rectangle((7,17,16,22),fill=shade)
    d.polygon(((6,19),(10,21),(16,19),(14,23),(10,25)),fill=CANVAS)
    d.polygon(((3,7),(4,1),(7,2),(9,5),(15,5),(19,1),(20,1),(20,9),
               (22,10),(22,15),(19,15),(19,17),(16,19),(6,19),
               (4,17),(2,17),(2,10)),fill=fur)
    d.rectangle((4,10,5,12),fill=shade)
    d.rectangle((18,9,19,11),fill=shade)
    d.rectangle((4,13,7,13),fill=shade)
    d.polygon(((7,14),(10,14),(10,12),(15,12),(15,13),(17,13),(17,16),
               (15,18),(9,18),(7,17)),fill=cream)
    eye_y = 12 if pose == 2 else 10
    for x in (7,15):
        d.rectangle((x,eye_y,x+1,12 if pose else 11),fill=INK)
    d.rectangle((11,13,13,13),fill='#765344')
    d.point((12,14),fill=shade)
    d.polygon(((2,7),(4,3),(7,2),(8,0),(14,0),(17,2),(18,5),
               (20,6),(20,7),(6,8)),fill='#58685a')
    d.line((6,3,13,2),fill=EDGE_LIT)
    d.rectangle((4,6,19,7),fill=INK)
    d.rectangle((16,7,22,7),fill=INK)
    lift = int(pose == 2)
    d.polygon(((0,20),(7,21),(11,23),(15,20),(23,18-lift),
               (22,24),(12,27),(10,27),(1,25)),fill=PAGE)
    d.line((11,23,11,26),fill=FOLD)
    d.line((2,22,7,23),fill=PRINT)
    d.line((15,22,20,20),fill=PRINT)
    d.rectangle((1,24,4,26),fill=fur)
    d.rectangle((19,23-lift,22,25-lift),fill=fur)
    return sprite


def draw_kiosk():
    image = Image.new('RGB',(160,80),SKY)
    d = ImageDraw.Draw(image)
    # The two margins leave the booth in its street rather than inside a room.
    for x, top, width in [(0,14,10),(9,20,11),(133,17,9),(142,11,12),(156,19,8)]:
        d.rectangle((x,top,x+width,55),fill=DISTANT)
        d.line((x,top,x+width,top),fill=BUILDING)
        for y in range(top+4,46,6):
            for wx in range(x+2,x+width-1,5):
                d.rectangle((wx,y,wx+1,y+2),fill=BUILDING)
    d.line(((0,3),(17,5),(34,5),(48,4)),fill='#a2b3a8')
    d.rectangle((0,54,159,62),fill=ROAD)
    d.line((0,57,159,57),fill='#c5c5aa')
    d.rectangle((0,63,159,79),fill=PAVING)
    d.line((0,63,159,63),fill=EDGE)
    for p in [((2,63),(0,70)),((151,64),(159,70)),((119,75),(125,79))]:
        d.line(p,fill='#9da598')
    # The facade, awning and stock move together. The pavement sign stands separately.
    booth = Image.new('RGBA', image.size)
    d = ImageDraw.Draw(booth)
    # Backlit shop window and an enamel, raised-letter fascia.
    d.rectangle((21,12,143,71),fill=INK)
    d.rectangle((23,32,140,59),fill=WINDOW)
    # The paper racks leave a central opening. Reflections sit behind the
    # stock and stop above the sill, so the window reads as one space.
    d.rectangle((24,33,58,57),fill='#5a7468')
    d.polygon(((24,34),(36,34),(26,52),(24,52)),fill='#647f72')
    d.rectangle((105,35,139,57),fill=STEEL)
    d.rectangle((19,9,145,10),fill=EDGE_LIT)
    d.rectangle((17,11,147,13),fill=STEEL)
    d.rectangle((19,14,145,24),fill=INK)
    d.line((22,15,141,15),fill='#637969')
    for x in (23,140):
        d.point((x,20),fill=EDGE_LIT)
    # The sloping awning has tapered stripes and a separate canvas valance.
    d.polygon(((18,24),(146,24),(152,31),(12,31)),fill=CANVAS)
    for i in range(0,10,2):
        top=18+i*13; bottom=12+i*14
        d.polygon(((top,24),(top+12,24),(bottom+13,31),(bottom,31)),fill=RED)
    for i in range(10):
        x=12+i*14; color=RED_SHADOW if i%2==0 else '#ccc4a7'
        d.rectangle((x,32,x+13,34),fill=color)
        d.rectangle((x+2,35,x+11,35),fill=color)
    # Back issues hanging from a rail, with little brass spring clips.
    for x, y, width, height, mast, left in ((26,38,15,15,RED,True),(44,37,15,17,STEEL,False),
                                            (105,37,15,17,RED,True),(123,38,15,16,STEEL,False)):
        front_page(d,x,y,width,height,mast,left)
        d.rectangle((x+width//2-1,y-1,x+width//2,y),fill='#b8a16d')
    # Folded newspapers tied in bundles at the low street-facing counter.
    d.rectangle((19,60,145,61),fill=CANVAS)
    d.rectangle((19,62,145,63),fill=INK)
    d.rectangle((23,64,140,71),fill=STEEL)
    # Short catches of light on the painted front, separate from the window.
    for x, top, bottom in ((26,65,69),(88,64,69),(137,65,70)):
        d.line((x,top,x,bottom),fill='#587269')
    for x,y,width in ((28,57,25),(32,55,22),(105,56,19),(127,58,11)):
        d.rectangle((x,y,x+width,y+2),fill=FOLD)
        d.line((x+1,y,x+width-1,y),fill=PAGE)
        d.line((x+3,y+2,x+width-2,y+2),fill=PRINT)
        d.line((x+width//2,y,x+width//2+1,y+2),fill=RED_SHADOW)
    d.line((22,72,143,72),fill=INK)
    d.line((25,73,144,73),fill=EDGE)
    image.paste(booth, (-3,0), booth)
    d = ImageDraw.Draw(image)
    # One display board with a narrow shaded right edge and a contact shadow.
    d.polygon(((2,73),(13,73),(17,74),(17,75),(5,75)),fill=EDGE)
    d.polygon(((6,55),(15,55),(12,72),(2,72)),fill=STEEL)
    d.line(((2,71),(6,55),(15,55)),fill=EDGE_LIT)
    d.polygon(((16,56),(16,59),(13,73),(12,72)),fill=INK)
    d.polygon(((7,57),(14,57),(11,69),(4,69)),fill=PAGE)
    d.line((7,59,13,59),fill=RED)
    d.polygon(((7,61),(11,61),(10,65),(6,65)),fill=PRINT)
    d.line((5,67,11,67),fill=PRINT)
    # Street drain and kerb share the cold steel of the lower display rack.
    d.line((136,75,151,75),fill=EDGE)
    for x in (139,143,147):
        d.line((x,75,x+1,76),fill=ROAD)
    d.rectangle((0,78,159,79),fill=EDGE)
    return image.crop((0, 3, 160, 80))
