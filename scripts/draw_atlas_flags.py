"""Render the game's 3:2 pixel flags. Union emblems are original game heraldry."""
from math import atan2, cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'flags'
W, H = 96, 64
WHITE, GOLD = '#faf7e9', '#f5cc65'

def field(color):
    im = Image.new('RGB', (W, H), color)
    return im, ImageDraw.Draw(im)

def star(d, x, y, radius, color, points=5, inner=.4):
    coords = []
    for k in range(points * 2):
        a = pi * k / points - pi / 2
        r = radius if k % 2 == 0 else radius * inner
        coords.append((round(x + r * cos(a)), round(y + r * sin(a))))
    d.polygon(coords, fill=color)

def save(im, code):
    im.save(OUT / (code + '.png'), optimize=True)

def national_flags():
    im, d = field('#ffffff')
    # Paint the rotated two-part taegeuk in its own coordinate system.
    angle = atan2(2, 3)
    for y in range(16, 48):
        for x in range(32, 64):
            dx, dy = x + .5 - 48, y + .5 - 32
            a, b = dx*cos(angle)+dy*sin(angle), -dx*sin(angle)+dy*cos(angle)
            if a*a+b*b <= 256:
                upper = b < 0
                if (a+8)**2+b*b <= 64: upper = True
                if (a-8)**2+b*b <= 64: upper = False
                im.putpixel((x,y), (205,46,58) if upper else (0,71,160))
    # Bars run perpendicular to the corner diagonal; count broken bars
    # from the outside of each trigram toward the centre of the flag.
    for sx, sy, breaks in [(-1,-1,()),(1,1,(0,1,2)),(1,-1,(0,2)),(-1,1,(1,))]:
        vx, vy = sx*cos(angle), sy*sin(angle)
        for row in range(3):
            distance = 31.4 - row*3.5
            cx, cy = 48+distance*vx,32+distance*vy
            for lo, hi in ([(-8,-.8),(.8,8)] if row in breaks else [(-8,8)]):
                shape = [(round(cx-vy*a+vx*b),round(cy+vx*a+vy*b))
                         for a,b in [(lo,-.85),(hi,-.85),(hi,.85),(lo,.85)]]
                d.polygon(shape, fill='#202124')
    save(im, 'mora')

    im,d=field('#ffffff')
    d.ellipse((29,13,66,50), fill='#bc002d')
    save(im, 'haeon')

    im,d=field('#ffffff')
    for n in range(0,13,2):
        d.rectangle((0,round(n*H/13),W-1,round((n+1)*H/13)-1), fill='#b31942')
    d.rectangle((0,0,39,round(7*H/13)-1),fill='#193968')
    for row in range(9):
        for column in range(5 if row%2 else 6):
            star(d,3.3+column*6.65+(3.325 if row%2 else 0),3.2+row*3.5,1.53,'#ffffff')
    save(im,'arden')

def regional_flags():
    im,d=field('#063997')
    for k in range(12):
        a=2*pi*k/12-pi/2
        star(d,48+20*cos(a),32+20*sin(a),4.2,'#ffda25')
    save(im,'lumen')

    # A rising sun beyond three horizontal Pacific swells.
    im,d=field('#b63437')
    d.ellipse((33,9,63,39),fill=GOLD)
    for y,offset in [(28,0),(37,9),(46,17)]:
        d.polygon([(0,y+8),(26+offset,y+8),(42+offset,y),(95,y),(95,y+4),(44+offset,y+4),(28+offset,y+12),(0,y+12)],
                  fill=WHITE if y==28 else '#e8a343')
    save(im,'chai')

    # Three rice stems above a common river.
    im,d=field('#14786a')
    for dx,dy in [(-12,6),(0,0),(12,6)]:
        x=48+dx; y=12+dy
        d.line((x,y+1,x,43,48,49),fill=GOLD,width=2)
        for j in range(3):
            yy=y+5+j*5
            d.polygon([(x,yy+4),(x-6,yy),(x-6,yy-4),(x-2,yy-2)],fill=GOLD)
            d.polygon([(x,yy+4),(x+6,yy),(x+6,yy-4),(x+2,yy-2)],fill=GOLD)
    d.rectangle((15,51,80,53),fill=WHITE)
    save(im,'vietlan')

    # A desert compass and a continuous overland trade route.
    im,d=field('#664354')
    d.polygon([(0,0),(39,0),(16,64),(0,64)],fill='#ab654b')
    d.polygon([(0,52),(95,52),(95,56),(0,56)],fill='#dda65e')
    star(d,54,28,21,GOLD,8,.39)
    d.ellipse((50,24,58,32),fill='#664354')
    save(im,'misran')

    # A gold continental seal flanked by a dark green field.
    im,d=field('#206246')
    d.ellipse((22,6,73,57),outline=GOLD,width=2)
    outline=[(39,14),(52,14),(58,19),(60,25),(69,27),(64,33),(60,35),
             (58,42),(52,51),(49,50),(46,42),(44,34),(39,32),(34,34),(29,29),(30,22)]
    d.polygon(outline,fill=GOLD)
    d.polygon([(62,41),(64,39),(64,44),(62,47)],fill=GOLD)
    save(im,'azania')

    # The Southern Cross above a pair of ocean waves.
    im,d=field('#173e68')
    for x,y,r in [(48,8,4),(36,21,4),(57,17,4),(50,32,5),(53,23,2)]:
        star(d,x,y,r,WHITE)
    for y in (39,51):
        d.polygon([(0,y+3),(18,y-1),(36,y+3),(57,y-1),(76,y+3),(95,y-1),
                   (95,y+5),(76,y+9),(57,y+5),(36,y+9),(18,y+5),(0,y+9)],
                  fill='#5dc3ca' if y==39 else '#93d9d6')
    save(im,'austran')

    # Andean ridgeline and a southern star.
    im,d=field('#257361')
    d.polygon([(0,52),(29,24),(39,35),(58,13),(95,52),(95,63),(0,63)],fill='#d8b765')
    d.polygon([(20,41),(29,31),(37,42),(43,37),(59,20),(72,37),(58,30),(51,37),(42,46),(31,38)],fill=WHITE)
    d.polygon([(0,57),(29,34),(39,45),(58,24),(95,57),(95,63),(0,63)],fill='#245257')
    star(d,79,14,5,WHITE,4,.35)
    save(im,'brazin')

    # A polar star between two northern land masses.
    im,d=field('#285068')
    d.polygon([(0,0),(38,0),(22,32),(38,64),(0,64)],fill='#4c9275')
    d.polygon([(96,0),(62,0),(77,32),(62,64),(96,64)],fill='#477d76')
    star(d,48,31,24,WHITE,4,.29)
    star(d,48,31,9,GOLD,4,.42)
    save(im,'kanora')

if __name__=='__main__':
    national_flags()
    regional_flags()
