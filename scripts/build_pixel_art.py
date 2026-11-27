#!/usr/bin/env python3
"""Draw Stall Street's 2D sprites and encode their WebP loops."""
import json
from pathlib import Path

from PIL import Image, ImageDraw

from draw_pixel_animals import COUNTRY_CATS, GUIDE_CATS, LEADER_OUTFITS, portrait
from draw_loan_office import lender, office_counter, paint_office
from draw_newsstand import draw_kiosk, seller
from draw_public_stall import DRIP_MS, stall_frames
from draw_slot_jackpot import jackpot_sheet
from draw_venues import draw_venues
from draw_pixel_scenes import PAPER, SIZE, bank_counter, box, clerk, scene, slab, stroke

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT/'public/art'
OUT = ART/'pixel'
PROP_POSES = (0, -1, 0, 1)
PROP_MS = (185, 185, 185, 185)
IDLE_POSES = (0, 1, 2, 1)
TELLER_MS = (1570, 135, 230, 135)
WEBP = dict(lossless=True, method=6, quality=95, exact=True)


def save_loop(name, render, poses=PROP_POSES, durations=PROP_MS):
    rest,*motion = [render(pose) for pose in poses]
    if len({frame.tobytes() for frame in [rest,*motion]}) != 3:
        raise ValueError(f'{name} needs three distinct drawings')
    rest.save(OUT/f'{name}-still.webp', **WEBP)
    rest.save(OUT/f'{name}.webp', save_all=True, append_images=motion,
              duration=durations, loop=0, minimize_size=True, **WEBP)


def draw_profiles():
    for index,(place,cat) in enumerate(COUNTRY_CATS.items()):
        attire = LEADER_OUTFITS[place]
        blink = (1780 + 140*(index%5), 105, 130, 105)
        save_loop(f'leader-{place}',lambda pose:portrait(cat,index,pose,attire),IDLE_POSES,blink)
    for index,(name,cat) in enumerate(GUIDE_CATS.items()):
        portrait(cat,index,0).save(OUT/f'{name}-still.webp', **WEBP)
    labels = {place:cat.label for place,cat in COUNTRY_CATS.items()}
    output = ROOT/'src/game/country-animals.mjs'
    output.write_text('// Generated alongside the atlas portraits.\n'
                      'export const countryAnimals = '+json.dumps(labels,ensure_ascii=False,indent=2)+';\n',
                      encoding='utf-8')


def tissue(phase):
    image = Image.new('RGB',(28,28),'#74664e')
    draw = ImageDraw.Draw(image)
    slab(draw,[(6,8),(6,6),(9,6),(9,5),(17,5),(17,6),(21,7),(21,13),
               (23,14),(23+phase,18),(25+phase,19),(25+phase,23),(19+phase,24),(17,22),(8,22),
               (8,21),(5,20),(5,8)],PAPER)
    box(draw,(10,7,16,8),'#584934')
    box(draw,(18,10,19,21),'#a9a27b')
    stroke(draw,[(6,24),(24,24)],'#4d4535')
    return image


def cup(phase):
    image = Image.new('RGB',(28,28),'#607770')
    draw = ImageDraw.Draw(image)
    slab(draw,[(5,10),(21,10),(21,12),(24,12),(24,18),(21,18),(21,20),
               (19,20),(19,23),(9,23),(9,22),(7,22),(7,19),(6,19),(6,15),(5,15)],PAPER)
    box(draw,(8,11,19,12),'#594a38')
    box(draw,(21,14,22,16),'#607770')
    box(draw,(10,24,22,24),'#435a50')
    stroke(draw,[(12,8),(12+phase,6),(10+phase,6),(10+phase,4)],'#b9bfa1')
    stroke(draw,[(17,7),(17+phase,5),(18+phase,5),(18+phase,3)],'#b9bfa1')
    return image


def washer(phase):
    image = Image.new('RGB',(28,28),'#8a7962')
    draw = ImageDraw.Draw(image)
    slab(draw,[(5,5),(6,5),(6,4),(21,4),(21,5),(23,5),(23,24),
               (20,24),(20,25),(7,25),(7,24),(5,24)],PAPER)
    box(draw,(6,8,22,9),'#9b9579')
    box(draw,(17,6,21,7),'#ab765b')
    slab(draw,[(10,12),(18,12),(18,13),(20,13),(20,19),(18,19),(18,21),
               (10,21),(10,20),(8,20),(8,14),(10,14)],'#546d68')
    stroke(draw,[(10,18),(13,16+phase),(16,17+phase),(18,15)],'#a7b19b',2)
    return image


def slot_chassis():
    """The pixel shell stops at the casing seam. Reels and pull handle sit over it."""
    image = Image.new('RGBA', (176, 116))
    draw = ImageDraw.Draw(image)
    silhouette = [(15,0),(159,0),(159,2),(168,2),(168,6),(173,6),
                  (173,12),(175,12),(175,115),(0,115),(0,12),(2,12),
                  (2,6),(7,6),(7,2),(15,2)]
    slab(draw, silhouette, '#132720')
    slab(draw, [(16,2),(158,2),(158,4),(167,4),(167,8),(171,8),
                (171,16),(173,16),(173,115),(2,115),(2,16),(4,16),
                (4,8),(9,8),(9,4),(16,4)], '#2e483c')
    slab(draw, [(17,5),(157,5),(157,7),(163,7),(163,10),(166,10),
                (166,24),(9,24),(9,10),(12,10),(12,7),(17,7)], '#586e58')
    stroke(draw, [(17,3),(157,3),(157,5),(165,5),(165,8),(169,8)], '#8a9670')
    stroke(draw, [(5,12),(5,25),(3,25),(3,110)], '#617a62')
    stroke(draw, [(169,13),(169,26),(171,26),(171,112)], '#20362c')
    box(draw, (6,26,7,110), '#3b5747')
    box(draw, (168,29,169,109), '#293f33')

    # Folded top edge, brass inlay and squared steel bolts on the lamp shelf.
    slab(draw, [(16,8),(156,8),(156,10),(161,10),(161,19),(14,19),
                (14,10),(16,10)], '#283e32')
    box(draw, (18,9,154,9), '#738064')
    box(draw, (15,19,160,20), '#142b22')
    box(draw, (9,21,165,23), '#a18b56')
    box(draw, (11,21,163,21), '#c0ad74')
    box(draw, (9,24,166,27), '#1a2d24')
    stroke(draw, [(35,6),(44,6)], '#748467')
    stroke(draw, [(32,7),(38,7)], '#485e4c')
    for x in (12,161):
        box(draw, (x-1,15,x+3,19), '#34483b')
        box(draw, (x,15,x+2,17), '#a19568')
        box(draw, (x,15,x+1,15), '#c4b687')
        box(draw, (x+1,16,x+2,16), '#5c5e43')

    # Outer rails, the lever casting and the sloping lip above the control deck.
    box(draw, (8,27,166,107), '#253c30')
    box(draw, (9,28,11,106), '#8b8053')
    box(draw, (9,28,9,104), '#baab74')
    box(draw, (140,28,165,106), '#1c3026')
    box(draw, (165,29,166,105), '#4c5d46')
    slab(draw, [(8,105),(167,105),(167,108),(170,108),(170,112),
                (5,112),(5,108),(8,108)], '#415849')
    box(draw, (11,106,163,107), '#a48e59')
    stroke(draw, [(13,106),(132,106)], '#c7b579')
    box(draw, (5,112,170,113), '#162b22')
    box(draw, (5,114,170,115), '#394f40')
    for x,y in ((10,94),(11,93),(164,57),(165,54),(9,80),(6,107),(168,104)):
        box(draw, (x,y,x,y+1), '#65765b')
    return image


def draw_desk_layers():
    # Identical pixel coordinates are used in each office. The counter stays in front
    # of the animated employee and conceals the lower edge of the jacket.
    crop = (32, 75, 77, 126)
    for name, room, person, counter in (
        ('bank', lambda:scene('bank', None), clerk, bank_counter),
        ('loan-office', lambda:paint_office(None), lender, office_counter),
    ):
        room().save(OUT/f'{name}-room.webp', **WEBP)
        foreground = Image.new('RGBA', SIZE)
        counter(ImageDraw.Draw(foreground))
        foreground.crop(crop).save(OUT/f'{name}-counter.webp', **WEBP)

        def employee(pose):
            layer = Image.new('RGBA', SIZE)
            person(ImageDraw.Draw(layer), pose)
            return layer.crop(crop)

        save_loop(f'{name}-staff', employee, IDLE_POSES, TELLER_MS)


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    save_loop('bank',lambda pose:scene('bank',pose),IDLE_POSES,TELLER_MS)
    draw_kiosk().save(OUT/'kiosk-booth.webp', **WEBP)
    save_loop('kiosk', seller, IDLE_POSES, TELLER_MS)
    still, *drip = stall_frames()
    still.save(OUT/'room-stall-still.webp', **WEBP)
    still.save(OUT/'room-stall.webp', save_all=True, append_images=drip,
               duration=DRIP_MS, loop=0, minimize_size=True, **WEBP)
    save_loop('loan-office',paint_office,IDLE_POSES,TELLER_MS)
    draw_desk_layers()
    draw_profiles()
    draw_venues()
    save_loop('ad-tissue',tissue)
    save_loop('ad-tea',cup)
    save_loop('ad-wash',washer)
    slot_chassis().save(OUT/'slot-cabinet.webp', **WEBP)
    jackpot_sheet().save(OUT/'slot-jackpot.webp', **WEBP)


if __name__=='__main__':
    main()
