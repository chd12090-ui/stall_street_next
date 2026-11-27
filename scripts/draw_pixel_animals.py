"""Paint leaders' formal portraits and the community's cat faces."""

from typing import NamedTuple

from PIL import Image, ImageDraw

SIZE = (26, 26)
INK = '#383034'
FIELDS = ('#637063', '#65574e', '#70654e', '#4f655c', '#605c70')


class Cat(NamedTuple):
    label: str
    shape: str
    pattern: str
    coat: str
    shade: str
    muzzle: str
    backdrop: str
    eyes: str = INK


class Attire(NamedTuple):
    cut: str
    fabric: str
    edge: str
    trim: tuple[str, ...]
    pin: str = ''


COUNTRY_CATS = {
    'mora': Cat('치즈 태비 고양이', 'box', 'tabby', '#ebd7a6', '#a0804a', '#f3e7c7', '#9cb095'),
    'haeon': Cat('삼색 밥테일', 'lean', 'calico', '#f4e5c8', '#bd7e4e', '#55505a', '#bcb7d1'),
    'chai': Cat('리화 고양이', 'round', 'mackerel', '#b69468', '#665040', '#e4c99a', '#9aada8'),
    'vietlan': Cat('회색 양말 고양이', 'box', 'tuxedo', '#6e7c83', '#535e66', '#e7dec9', '#b5b68e'),
    'lumen': Cat('브리티시 쇼트헤어', 'round', 'smoke', '#82919c', '#61747e', '#aab0ad', '#b8ad92', '#4b4340'),
    'arden': Cat('메인쿤', 'tufts', 'mackerel', '#c69b70', '#79533f', '#ebcc9b', '#a6a8c0'),
    'kanora': Cat('스핑크스 고양이', 'ears', 'bare', '#d0a089', '#a77566', '#e6bd9e', '#98abb0'),
    'brazin': Cat('브라질리언 쇼트헤어', 'round', 'patch', '#ae7956', '#775343', '#e9d8af', '#88aa90'),
    'misran': Cat('이집션 마우', 'ears', 'spots', '#b0ada0', '#635f59', '#e5d7bc', '#bfa78a'),
    'azania': Cat('회갈색 고양이', 'round', 'mask', '#9e957c', '#6f6858', '#c5bc9d', '#b7a4a0'),
    'austran': Cat('오스트레일리안 미스트', 'round', 'spots', '#b7a19d', '#8d7d85', '#e3c9b7', '#a6ad92'),
}

# Formal clothing is adapted for the fictional officeholders.
LEADER_OUTFITS = {
    'mora': Attire('suit', '#304052', '#526a81', ('#6490ae', '#b7625d')),
    'haeon': Attire('suit', '#333843', '#555b67', ('#89a5b8',)),
    'chai': Attire('stand', '#47514e', '#727c72', ('#a0a08a',)),
    'vietlan': Attire('suit', '#3e4d55', '#647d7c', ('#a24d4a',), '#dcaf69'),
    'lumen': Attire('blazer', '#323f58', '#5a6b86', ('#d7e0e1',)),
    'arden': Attire('suit', '#364569', '#5d7194', ('#c5534d',), '#e6c878'),
    'kanora': Attire('blazer', '#42576a', '#718594', ('#cb7776',), '#eee4d1'),
    'brazin': Attire('sash', '#424754', '#626775', ('#6b9958', '#e1bc66', '#569066')),
    'misran': Attire('blazer', '#52515c', '#77727e', ('#d8c6b8',), '#d1af70'),
    'azania': Attire('blazer', '#45455e', '#716c8a', ('#bd9368',), '#d7ce9b'),
    'austran': Attire('suit', '#475765', '#6c8191', ('#8d9e6c',)),
}

GUIDE_CATS = {
    'avatar-0': Cat('', 'box', 'tabby', '#dbb27e', '#a27753', '#f1d4a2', '#a1b29a'),
    'avatar-1': Cat('', 'round', 'smoke', '#8a98a0', '#5b6d7d', '#babcad', '#b5afc2'),
    'avatar-2': Cat('', 'lean', 'calico', '#ebdac2', '#ad7855', '#57515d', '#b2a48c'),
}

# The face and ear silhouettes sit on the same fixed pixel grid.
HEADS = {
    'box': ((5,8,20,19), (4,10,21,17), (6,19,19,20),
            (5,5,7,10), (7,6,8,9), (17,4,19,9), (19,6,20,9)),
    'lean': ((6,9,19,17), (5,11,21,15), (8,17,18,19), (11,19,16,20),
             (5,4,7,11), (7,6,8,9), (17,7,20,10), (18,5,21,9)),
    'round': ((6,8,19,20), (4,10,21,18), (3,12,22,16), (8,20,17,21),
              (5,6,8,10), (16,5,19,10), (19,7,20,11)),
    'ears': ((6,9,20,17), (5,10,21,15), (8,17,19,19), (11,19,17,20),
             (4,4,6,11), (5,5,8,12), (7,7,10,10), (17,6,20,10), (19,3,21,11)),
    'tufts': ((5,8,20,20), (4,10,21,19), (3,15,22,17), (7,20,18,22),
              (4,3,5,13), (6,5,7,11), (7,7,9,9), (17,6,19,10), (19,3,20,11), (18,4,19,6)),
}

# Both coat patches are clipped to the silhouette.
COATS = {
    'tabby': (((5,10,7,11), (5,14,7,14), (10,8,11,10), (14,8,15,9), (19,12,21,13), (18,15,21,15)),
              ((8,15,17,18), (11,18,16,19))),
    'calico': (((4,4,9,11), (5,11,8,13), (3,14,6,17), (5,17,9,18)),
               ((17,3,23,9), (19,9,23,14), (18,13,21,16))),
    'mackerel': (((8,8,10,10), (12,8,13,11), (15,8,17,9), (3,12,6,13),
                  (3,15,7,16), (19,11,22,12), (18,14,22,15), (19,17,22,19)),
                 ((9,15,16,17), (7,17,18,19), (10,19,16,21))),
    'spots': (((5,9,6,10), (9,8,10,9), (13,9,14,10), (16,8,17,9),
               (6,13,7,13), (5,16,5,16), (8,15,9,15), (19,11,20,11), (18,15,20,16)),
              ((10,15,16,19), (8,17,18,18))),
    'tuxedo': (((4,5,7,9), (19,4,21,9), (18,13,21,16)),
               ((12,11,13,13), (10,14,15,15), (8,16,18,19), (10,19,19,21))),
    'smoke': (((5,5,7,9), (17,4,20,8), (19,13,22,18), (17,18,20,20)),
              ((8,15,17,18), (10,18,16,19))),
    'bare': (((4,4,6,10), (20,4,21,9), (11,8,15,8), (9,10,16,10), (7,16,8,17), (18,16,19,17)),
             ((10,15,17,18), (11,18,16,20))),
    'patch': (((16,5,22,12), (14,9,18,14), (17,12,21,14), (4,5,7,9)),
              ((10,15,16,18), (7,18,19,20))),
    'cap': (((4,4,9,11), (8,8,12,10), (14,7,21,8), (17,5,21,9), (4,12,7,14)),
            ((10,15,17,19), (7,18,18,19))),
    'mask': (((3,11,8,14), (6,10,10,13), (16,10,22,13), (18,13,22,15), (17,3,20,8)),
             ((8,15,19,18), (11,18,17,19))),
}


def blocks(draw, rects, color):
    for rect in rects:
        draw.rectangle(rect, fill=color)


def formal_bust(draw, attire):
    cut, fabric, edge, trim, pin = attire
    blocks(draw, ((8,17,17,25), (5,19,20,25), (2,21,23,25), (0,23,25,25)), fabric)

    if cut == 'stand':
        blocks(draw, ((8,18,11,20), (14,18,17,20), (12,21,12,25),
                      (4,22,9,22), (16,22,21,22)), edge)
        blocks(draw, ((13,22,13,22), (13,24,13,24), (6,23,6,23), (19,23,19,23)), trim[0])
    else:
        shirt = trim[0] if cut == 'blazer' else '#eee8da'
        draw.polygon(((8,18), (17,18), (16,21), (13,25), (12,25), (9,21)), fill=shirt)
        draw.polygon(((5,19), (8,18), (11,24), (8,21), (6,21)), fill=edge)
        draw.polygon(((20,19), (17,18), (14,24), (17,21), (19,21)), fill=edge)
        if cut == 'suit':
            blocks(draw, ((12,20,13,21), (12,22,13,24), (11,24,14,25)), trim[0])
            if len(trim) > 1:
                draw.line((12,22,13,22), fill=trim[1])
                draw.line((12,25,14,25), fill=trim[1])
        elif cut == 'sash':
            for y in range(19,26):
                x = 15 - (y - 19) * 2
                for band, color in enumerate(trim):
                    draw.line((x + band*2,y,x + band*2 + 1,y), fill=color)
    if pin:
        draw.line((19,22,20,22), fill=pin)


def face_pixels(cat, pose):
    silhouette = Image.new('L', SIZE)
    blocks(ImageDraw.Draw(silhouette), HEADS[cat.shape], 255)
    face = Image.new('RGB', SIZE, cat.coat)
    draw = ImageDraw.Draw(face)
    shade, muzzle = COATS[cat.pattern]
    blocks(draw, shade, cat.shade)
    blocks(draw, muzzle, cat.muzzle)
    draw.rectangle((12,15,13,15), fill='#8c604e')
    draw.point((12,16), fill=INK)
    draw.rectangle((12,17,14,17), fill=INK)

    # Only the eye pixels change during the blink.
    left, right = (9,17) if cat.shape in ('lean','ears') else (8,17)
    for eye, (x, y) in enumerate(((left,12),(right,13))):
        tall = 1 if pose == 0 or (pose == 1 and eye == 1) else 0
        draw.rectangle((x,y,x+(pose==2),y+tall), fill=cat.eyes)
    return face, silhouette


def portrait(cat, index, pose, attire=None):
    image = Image.new('RGB', SIZE, cat.backdrop)
    draw = ImageDraw.Draw(image)
    if attire:
        formal_bust(draw, attire)
    else:
        draw.rectangle((0,23,25,25), fill=FIELDS[index % len(FIELDS)])
        draw.rectangle((8,19,18,23), fill=cat.shade)
        draw.rectangle((5,21,20,23), fill=cat.coat)
    face, silhouette = face_pixels(cat, pose)
    image.paste(face, (0,-2 if attire else 0), silhouette)
    return image
