"""Pixel flipbook for the three-line jackpot: fountains, ascending comets and starbursts."""
from math import cos, exp, pi, sin
from PIL import Image, ImageDraw, ImageFilter


SIZE = (120, 80)
FRAMES = 32
ASH, RED, ORANGE, GOLD, LEMON, WHITE = (
    '#913f35', '#ca5036', '#f37a3c', '#ffb84e', '#ffe393', '#fff6cc'
)


def star(draw, x, y, radius, color):
    x, y = round(x), round(y)
    if radius < 2:
        draw.point((x, y), fill=color)
        return
    draw.line((x-radius, y, x+radius, y), fill=color)
    draw.line((x, y-radius, x, y+radius), fill=color)
    draw.rectangle((x-1, y-1, x+1, y+1), fill=color)
    draw.point((x, y), fill=WHITE)


def fountain(draw, frame, origin, direction, offset):
    age = frame - offset
    if age <= 0 or age >= 18:
        return
    envelope = min(1, age / 4, (18-age) / 7)
    # Three tongues rise and curl independently. Paint in two-pixel columns for a stepped edge.
    for column in range(-6, 13, 2):
        tip = sum(height * exp(-((column-center)/width)**2) for center, height, width in
                  [(-2 + 1.3*sin(age*.7), 34, 3), (5 + 1.5*cos(age*.8), 22, 3), (9, 12, 2)])
        height = round((6 + tip + 4*sin(column*.6 + age*1.1))*envelope)
        x = origin + direction*column
        lean = direction * round(height*.13 + 1.5*sin(age*.67+column))
        for ratio, ink, bend in [(1, ASH, 1), (.93, RED, .86), (.70, ORANGE, .62),
                                 (.46, GOLD, .38), (.20, LEMON, .12)]:
            top = 76 - round(height*ratio)
            drift = round(lean*bend)
            draw.polygon([(x-1,76),(x+2,76),(x+drift+1,top),(x+drift,top)],fill=ink)
    for speck in range(5):
        lift = (age*3 + speck*9) % 34
        x = origin + direction*(speck*3-6 + round(3*sin(age*.42 + speck)))
        y = 74 - round((lift + 6)*envelope)
        star(draw, x, y, 1 + (speck == 1 and age < 12), GOLD if speck%2 else ORANGE)


def comet(draw, frame, start, burst, launch, center):
    if not start <= frame < burst:
        return
    x0,y0 = launch
    x1,y1 = center
    def position(t):
        return (round(x0 + (x1-x0)*t + 2*sin(pi*t)),
                round(y0 + (y1-y0)*t - 6*sin(pi*t)))
    age = (frame-start)/(burst-start)
    for tail,ink in [(4, ASH),(3, RED),(2, ORANGE),(1, GOLD)]:
        t = max(0, age-tail*.075)
        draw.line([position(t),position(min(age,t+.085))],fill=ink,width=1+(tail<3))
    star(draw,*position(age),2,LEMON)


def firework(draw, frame, start, center, radius, spokes, rotation, colors):
    age = frame - start
    if age < 0 or age > 11:
        return
    x,y = center
    t = age/11
    spread = radius*(1-(1-t)**2)
    if 1 <= age < 7:
        ring = round(spread*.58)
        for quadrant in range(4):
            points = []
            for step in range(4):
                theta = (quadrant*.5 + step*.09)*pi + rotation
                points.append((x+round(ring*cos(theta)),y+round(ring*sin(theta)*.84)))
            draw.line(points,fill=colors[1])
    if age < 6:
        # Faceted star at the center of each bloom.
        r = [2,5,7,6,4,2][age] + (2 if spokes == 16 else 0)
        draw.polygon([(x,y-r-1),(x+2,y-2),(x+r,y),(x+2,y+2),(x,y+r+1),
                      (x-2,y+2),(x-r,y),(x-2,y-2)],fill=colors[0])
        draw.polygon([(x,y),(x+r,y),(x+2,y+2),(x,y+r+1)],fill=GOLD)
        draw.line([(x-r//2,y),(x,y),(x,y-r//2)],fill=WHITE)
    for arm in range(spokes):
        angle = rotation + 2*pi*arm/spokes
        reach = spread*(.77 if arm%2 else 1)
        dx,dy = cos(angle)*reach, sin(angle)*reach*.84
        sag = t*t*7
        tip = (round(x+dx), round(y+dy+sag))
        tail = max(.32, .60+t*.36)
        if age < 8:
            draw.line([(round(x+dx*tail),round(y+dy*tail+sag)),tip], fill=colors[1], width=2)
        if age < 10 or arm%3 == 0:
            star(draw,*tip,2 if age in (2,4,7) and arm%2 == 0 else 1,colors[0])
        if 3 <= age <= 8 and arm%2 == 0:
            draw.point((round(x+dx*.50),round(y+dy*.50+sag)),fill=WHITE)


def jackpot_sheet():
    sheet = Image.new('RGBA', (SIZE[0]*FRAMES, SIZE[1]))
    for frame in range(1, FRAMES-1):
        cel = Image.new('RGBA', SIZE)
        draw = ImageDraw.Draw(cel)
        fountain(draw,frame,8,1,0)
        fountain(draw,frame,111,-1,2)
        # Staggered lift-offs bloom into three different silhouettes above the win lines.
        for start,burst,launch,center in [(2,10,(9,73),(21,18)),(5,14,(111,73),(99,20)),
                                         (8,19,(104,72),(61,11))]:
            comet(draw,frame,start,burst,launch,center)
        firework(draw,frame,10,(21,18),19,12,.13,(LEMON,ORANGE))
        firework(draw,frame,14,(99,20),21,10,-.32,(WHITE,RED))
        firework(draw,frame,19,(61,11),26,16,.20,(WHITE,GOLD))
        if 19 <= frame < 30:
            for i in range(17):
                age = (frame-19+i%4)/13
                x = round(9 + i*6 + 4*sin(age*4+i))
                y = round(9 + (i*7)%12 + age*age*(19+i%5*4))
                if (i+frame)%5 < 3:
                    star(draw,x,y,2 if (i+frame)%7==0 else 1,GOLD if i%3==0 else LEMON)
        # A muted one-pixel rim keeps cream sparks legible over the ivory reels.
        alpha = cel.getchannel('A')
        outline = Image.new('RGBA',SIZE,'#8b4a37')
        outline.putalpha(alpha.filter(ImageFilter.MaxFilter(3)).point(lambda v: round(v*.69)))
        outline.alpha_composite(cel)
        sheet.paste(outline,(frame*SIZE[0],0))
    return sheet
