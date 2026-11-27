"""Bake the lobby on the cat's pixel grid and draw the three field-guide props."""
from io import BytesIO
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ART = Path(__file__).resolve().parents[1] / 'public' / 'art'
ORIGINALS = Path(__file__).resolve().parent / 'artwork'
SVG = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', SVG[1:-1])

font = TTFont(ART / 'stall-pixel.woff2')
font.flavor = None
font_data = BytesIO()
font.save(font_data)


def lettering(image, label, center, size, ink, max_width=None):
    """Draw solid pixel type; the little office notice has its own print grid."""
    face = ImageFont.truetype(BytesIO(font_data.getvalue()), size)
    mask = Image.new('1', (max(len(label) * size * 2, size), size * 2))
    draw = ImageDraw.Draw(mask)
    draw.text((0, 0), label, font=face, fill=1, anchor='lt')
    mask = mask.crop(mask.getbbox())
    if max_width and mask.width > max_width:
        mask = mask.resize((max_width, mask.height), Image.Resampling.NEAREST)
    x, y = center
    image.paste(ink, (round(x-mask.width/2), round(y-mask.height/2)), mask)


def lobby():
    root = ET.parse(ORIGINALS / 'landing-stall.svg').getroot()
    notice = next(group for group in root.iter(SVG+'g') if group.find(SVG+'text') is not None)
    for label in list(notice.findall(SVG+'text')):
        notice.remove(label)
    notice.set('shape-rendering', 'crispEdges')
    with TemporaryDirectory() as temp:
        temp = Path(temp)
        source, target = temp/'stall.svg', temp/'stall.png'
        ET.ElementTree(root).write(source, encoding='utf-8')
        # Sample each scene pixel as one solid material at its centre.
        subprocess.run(['inkscape', str(source), '--export-width=576', '--export-png-antialias=0',
                        '--export-filename='+str(target)], check=True)
        with Image.open(target) as bitmap:
            background = bitmap.convert('RGB')
    # One scene texel spans 1⅓ drawing units, matching a four-unit pixel on the scaled cat.
    # A finer grid only for the printed strokes keeps the small Korean notice legible.
    scene = background.resize((1728, 1098), Image.Resampling.NEAREST)
    x, y, unit = (161+288)*2.25, (115+122)*2.25, .84*2.25
    for text, center_y, size, ink, width in [
        ('공 고', 5.3, 10, '#4c5b4f', 38),
        ('근무시간 중', 16.3, 12, '#35483e', 55),
        ('주식 금지', 25.1, 14, '#35483e', 55),
        ('총무과', 40.4, 8, '#566958', 32),
    ]:
        center_x = 14 if text == '총무과' else 16.5
        lettering(scene, text, (x+center_x*unit,y+center_y*unit), size, ink, width)
    scene.save(ART/'player/landing-stall.webp', lossless=True, method=6)


def lobby_door():
    source = ORIGINALS/'landing-stall-door.svg'
    with TemporaryDirectory() as temp:
        target = Path(temp)/'door.png'
        # The door's 72 × 144 viewport is aligned to the same 1⅓-unit scene grid.
        subprocess.run(['inkscape', str(source), '--export-width=54', '--export-png-antialias=0',
                        '--export-filename='+str(target)], check=True)
        with Image.open(target) as bitmap:
            door = bitmap.convert('RGBA').resize((162, 324), Image.Resampling.NEAREST)
    door.save(ART/'player/landing-stall-door.webp', lossless=True, method=6)


SIZE = (168, 84)
INK, EDGE = '#293e36', '#496150'
PAPER, FOLD, LIGHT = '#e8e0c3', '#c6bfa0', '#fff2ce'
RUST, GOLD = '#ad674c', '#dfae64'
FUR, STRIPE, PAW = '#dbb27e', '#ac8059', '#f1d4a2'


def setting():
    image = Image.new('RGB', SIZE, '#a5b098')
    d = ImageDraw.Draw(image)
    d.rectangle((0,0,167,18), fill='#829981')
    d.rectangle((0,16,167,17), fill='#a4b599')
    d.rectangle((0,18,167,20), fill='#667e6c')
    # A clear gap below the suspended divider, then the passage floor.
    d.rectangle((0,21,167,32), fill='#354d40')
    d.rectangle((0,29,167,32), fill='#5e7360')
    d.rectangle((0,33,167,35), fill='#8d9d84')
    for x in (4,117):
        d.line((x,0,x,15), fill='#758d77')
        d.line((x+1,0,x+1,15), fill='#90a48c')
    for y in (45,68):
        d.line((0,y,167,y), fill='#8e9f88')
    for a,b in ((13,-31),(53,35),(95,103),(139,171)):
        d.line((a,33,b,83), fill='#8e9f88')
    for x in (16,149):
        d.rectangle((x,0,x+3,19), fill='#6d8572')
        d.rectangle((x,19,x+3,36), fill='#465f50')
        d.line((x+1,21,x+1,34), fill='#b6bfaa')
        d.rectangle((x-3,36,x+6,37), fill='#697e68')
        d.rectangle((x-2,35,x+5,35), fill='#bac3aa')
        d.rectangle((x,7,x+2,9), fill='#586d5e')
        d.point((x,7),fill='#bac3aa')
    # Foreleg coming through the gap; curled paws grip the edge of each prop.
    d.polygon([(39,21),(53,21),(53,25),(57,29),(59,34),(62,37),(62,44),
               (57,47),(50,46),(43,41),(42,36),(37,29)],fill=STRIPE)
    d.polygon([(39,21),(51,21),(51,25),(55,29),(58,35),(61,38),(60,43),
               (56,45),(51,44),(45,39),(45,34),(39,28)],fill=FUR)
    d.polygon([(40,25),(48,26),(50,28),(42,28)],fill=STRIPE)
    d.polygon([(43,31),(51,32),(53,34),(45,34)],fill=STRIPE)
    return image


def newspaper(image, opened):
    d = ImageDraw.Draw(image)
    if opened:
        d.polygon([(48,38),(81,30),(121,34),(121,66),(84,70),(49,65)],fill='#819078')
        d.polygon([(47,34),(80,29),(85,30),(119,31),(121,62),(86,65),(82,64),(49,62)],fill=EDGE)
        d.polygon([(48,32),(79,27),(84,29),(86,63),(81,61),(50,61)],fill=PAPER)
        d.polygon([(84,29),(117,29),(120,60),(88,64)],fill=LIGHT)
        d.line((82,30,85,61),fill=FOLD,width=2)
        d.polygon([(52,36),(75,33),(75,36),(52,39)],fill=INK)
        d.line((53,41,76,38),fill=RUST)
        for y, end in [(46,76),(50,73),(54,77),(58,67)]:
            d.line((53,y,end,y-3),fill='#849283')
        d.rectangle((89,33,113,35),fill=INK)
        boat(d,89,38)
        d.line((89,54,114,52),fill=RUST,width=2)
        d.line((90,58,106,57),fill='#899584')
    else:
        d.polygon([(57,35),(103,30),(110,61),(62,68),(56,64)], fill='#829078')
        d.polygon([(55,32),(101,27),(107,59),(62,65),(57,62)],fill=EDGE)
        d.polygon([(55,30),(100,25),(105,56),(61,62),(57,60)], fill=PAPER)
        d.polygon([(58,32),(97,27),(98,30),(59,35)],fill=RUST)
        d.polygon([(59,37),(97,32),(98,34),(60,39)],fill=INK)
        boat(d,62,40)
        for y, end in [(39,98),(43,99),(47,98),(51,94)]:
            d.line((87,y+1,end,y),fill='#798a7b')
        d.line((63,57,98,52),fill='#839182')
        d.line((65,60,102,55),fill=FOLD)


def boat(d, x, y):
    d.rectangle((x,y,x+21,y+12),fill='#a6b8a6')
    d.rectangle((x+3,y+4,x+8,y+7), fill='#9b604b')
    d.rectangle((x+9,y+4,x+14,y+7), fill='#c8945c')
    d.rectangle((x+15,y+3,x+18,y+7), fill=PAPER)
    d.rectangle((x+16,y+2,x+17,y+3), fill=INK)
    d.polygon([(x+1,y+8),(x+20,y+8),(x+17,y+11),(x+5,y+11)],fill='#4c6561')


def phone(image, ordered):
    d = ImageDraw.Draw(image)
    d.polygon([(57,34),(115,32),(118,35),(118,60),(114,64),(58,65),(55,61)],fill='#829179')
    d.polygon([(55,29),(112,29),(116,33),(116,58),(112,62),(55,62),(51,58),(51,33)],fill=INK)
    d.rectangle((54,32,112,58), fill=EDGE)
    d.rectangle((57,34,108,56), fill='#263f38')
    d.rectangle((110,41,111,49), fill='#9eac99')
    for y in (40,47,54):
        d.line((59,y,105,y),fill='#3c5447')
    for x in (67,80,93):
        d.line((x,35,x,55),fill='#3c5447')
    if ordered:
        d.line([(65,44),(71,49),(81,38)],fill='#c8d99c',width=2)
        lettering(image,'1주',(95,46),10,'#dce7bf')
        d.polygon([(94,53),(116,54),(115,71),(110,69),(106,72),(101,69),(96,70)], fill=FOLD)
        d.polygon([(93,52),(114,53),(113,68),(109,66),(105,69),(100,67),(95,68)], fill=LIGHT)
        d.line((98,57,110,57),fill=EDGE)
        d.rectangle((104,60,109,64),outline=RUST)
    else:
        for x,top,bottom,up in [(63,45,51,0),(70,41,48,1),(77,43,49,0),(84,41,46,1),(91,36,43,1),(98,37,42,0)]:
            color='#b6cda7' if up else '#de9a7f'
            d.line((x,top-2,x,bottom+2), fill=color)
            d.rectangle((x-1,top,x+1,bottom),fill=color)


def receipt(image, opened):
    d = ImageDraw.Draw(image)
    d.polygon([(56,38),(93,31),(104,67),(65,73)],fill='#85937c')
    if opened:
        d.polygon([(58,24),(94,22),(98,65),(94,68),(91,65),(87,69),(84,67),(80,70),
                   (77,68),(73,71),(70,69),(66,71),(61,47)],fill=EDGE)
        d.polygon([(57,22),(92,20),(97,63),(93,66),(90,63),(86,67),(83,65),(79,68),
                   (76,66),(72,69),(69,67),(64,69),(60,46)],fill=LIGHT)
        lettering(image,'정산',(76,30),11,INK)
        for y, end in [(39,89),(44,86),(49,89)]:
            d.line((64,y+2,end,y),fill='#829081')
        d.line((66,55,90,52),fill=RUST)
        d.rectangle((82,56,89,63),outline=RUST,width=2)
    else:
        d.polygon([(54,41),(91,34),(99,55),(64,65),(55,60)],fill=EDGE)
        d.polygon([(53,38),(90,32),(96,51),(62,61),(54,58)],fill=PAPER)
        d.polygon([(53,38),(78,32),(91,32),(67,47),(62,50)],fill=LIGHT)
        d.line((54,40,63,49,89,34),fill=FOLD,width=2)
        d.rectangle((68,43,73,48), fill=RUST)
    d.polygon([(99,45),(113,43),(118,62),(104,65)],fill=EDGE)
    d.rectangle((100,44,113,61),fill='#aa956b')
    d.rectangle((102,46,111,49),fill=INK)
    for x in (102,106,110):
        for y in (52,56):d.rectangle((x,y,x+1,y+1),fill='#e6d5a7')


def guide():
    sheet = Image.new('RGB', (SIZE[0]*2,SIZE[1]*3))
    for row, prop in enumerate((newspaper,phone,receipt)):
        for col in range(2):
            image = setting()
            prop(image, bool(col))
            d = ImageDraw.Draw(image)
            d.polygon([(48,36),(53,35),(56,37),(59,37),(60,41),(57,44),
                       (53,44),(50,42)],fill=STRIPE)
            d.polygon([(47,35),(53,34),(56,36),(58,36),(58,40),(55,42),
                       (52,42),(49,40)],fill=FUR)
            d.rectangle((54,39,56,40),fill=PAW)
            sheet.paste(image,(SIZE[0]*col,SIZE[1]*row))
    sheet.save(ORIGINALS/'field-guide.webp', lossless=True, method=6)


if __name__ == '__main__':
    lobby()
    lobby_door()
    guide()
