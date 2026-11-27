"""Paint the bank's back entrance and the paper-game poses on one shared pixel grid."""

from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
import json
import subprocess

from PIL import Image, ImageDraw, ImageOps

from draw_pixel_scenes import box, pixel_sign, slab, stroke


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
SIZE = (162, 132)
FUR, MARK, CREAM = '#dbb27e', '#ac8059', '#f1d4a2'
JACKET, FABRIC, PAW = '#526e65', '#425b54', '#474d48'
TEAR, TEAR_LIGHT = '#82b7ca', '#c8e9ec'


def entrance():
    im = Image.new('RGB', SIZE, '#6c746a')
    d = ImageDraw.Draw(im)
    # Depth lines on the left wall and paving share a center at (81, 48).
    # The rear facade is parallel to the picture plane.
    def wall_point(x, y):
        return x, round(48 + (y - 48) * (81 - x) / 81)

    def wall_panel(left, right, top, bottom, fill):
        slab(d, [wall_point(left, top), wall_point(right, top),
                 wall_point(right, bottom), wall_point(left, bottom)], fill)

    wall_panel(0, 30, -40, 93, '#3d5049')
    wall_panel(0, 30, 0, 4, '#475b53')
    wall_panel(0, 30, 19, 47, '#536b61')
    for left, right in ((0,7),(9,17),(19,26)):
        wall_panel(left, right, 21, 44, '#687d72')
        slab(d, [wall_point(left, 22), wall_point(right, 22),
                 wall_point(left, 38)], '#7b8d80')
    wall_panel(0, 30, 45, 48, '#718477')
    wall_panel(0, 30, 59, 60, '#50665b')
    wall_panel(0, 30, 89, 93, '#607267')
    box(d, (29,0,32,75), '#56675c')
    box(d, (30,0,161,75), '#879082')
    box(d, (30,0,161,12), '#606c62')
    box(d, (30,12,161,15), '#707c6e')
    box(d, (30,16,161,17), '#9ba18d')
    slab(d, [(30,18),(88,18),(63,58),(53,75),(30,75)], '#929787')
    # Sparse panel seams are shallow; most of each plane stays flat.
    for y in (34,55):
        box(d, (30,y,161,y), '#788477')
    for x in (48,117,151):
        box(d, (x,18,x,33), '#758174')
    for x in (39,107,148):
        box(d, (x,56,x,72), '#788173')
    box(d, (32,73,161,78), '#626e62')
    box(d, (32,73,161,73), '#758071')
    # A long strip of opaque office glass above the service entrance.
    box(d, (53,0,128,9), '#4b5e56')
    for x in (55,80,105):
        box(d, (x,0,x+21,7), '#63786e')
        slab(d, [(x,0),(x+11,0),(x+5,6),(x,7)], '#748a7b')
    box(d, (50,9,131,11), '#495c52')
    box(d, (51,9,130,9), '#a2a38a')
    # Recessed green security door and the bank's original brass wordmark.
    box(d, (61,27,95,76), '#59695e')
    box(d, (63,28,93,75), '#415b52')
    box(d, (65,30,92,75), '#526e60')
    box(d, (66,31,91,31), '#6a7e6b')
    box(d, (71,36,85,48), '#344d46')
    box(d, (72,37,84,46), '#778c7b')
    slab(d, [(72,37),(82,37),(75,44),(72,45)], '#91a18b')
    box(d, (84,55,89,56), '#adc0a3')
    box(d, (87,56,89,57), '#829180')
    box(d, (68,66,89,71), '#53695c')
    box(d, (63,75,94,76), '#394d43')
    box(d, (60,18,95,26), '#3a5a4f')
    box(d, (60,18,95,18), '#b59b68')
    pixel_sign(d, 'BANK', 67,20,'#d6caa0')
    # Hood of the door lamp, narrow pipe and a service bell.
    box(d, (42,24,46,25), '#546455')
    box(d, (40,26,48,28), '#b2ac91')
    box(d, (40,26,48,26), '#606d5c')
    box(d, (41,28,47,28), '#d2c2a0')
    box(d, (53,43,56,48), '#637568')
    box(d, (54,44,55,45), '#a7aa8e')
    for x in (32,35):
        stroke(d, [(x,15),(x,40),(x+3,43),(x+3,70)], '#687767', 2)
    for y in (26,55):
        box(d, (31+(y>40)*3,y,36+(y>40)*3,y), '#58685d')
    # Right-hand air handler: the ribbing is inset and low contrast.
    box(d, (128,27,153,43), '#667569')
    box(d, (127,26,151,40), '#a5a792')
    box(d, (128,27,150,39), '#929c88')
    for y in (29,32,35,38):
        box(d, (130,y,142,y), '#667a6d')
    box(d, (146,30,148,32), '#768b78')
    stroke(d, [(149,41),(149,48),(154,52),(154,72)], '#717e6b',2)
    slab(d, [(158,0),(161,0),(161,78),(158,78)], '#566b5c')
    for y in (21,59):
        box(d, (157,y,161,y+1), '#45594c')
    # Keep the footing level across the rear wall, including the door step.
    slab(d, [wall_point(0,93),wall_point(30,93),(161,77),(161,131),(0,131)], '#828577')
    slab(d, [(0,93),(30,76),(59,76),(64,82),(44,87),(0,103)], '#949480')
    slab(d, [(0,103),(44,87),(64,82),(83,83),(63,90),(0,112)], '#8b8f7c')
    slab(d, [(121,77),(161,77),(161,131),(132,131),(128,111)], '#778174')
    # Slab seams: in depth they meet the same horizon as the wall bands.
    stroke(d, [(58,82),(52,91),(41,107),(25,131)], '#737d6f')
    stroke(d, [(108,82),(120,98),(144,128),(147,131)], '#717a6d')
    stroke(d, [(0,106),(49,106)], '#777f70')
    stroke(d, [(116,99),(161,99)], '#717a6d')
    slab(d, [(61,76),(94,76),(96,79),(59,79)], '#989b86')
    box(d, (59,80,96,80), '#71806f')
    # Lidded service bin tucked against the right-hand wall. Its shaded
    # side and lid both recede toward the center.
    slab(d, [(135,82),(152,81),(160,84),(159,89),(142,89),(135,86)], '#667265')
    slab(d, [(137,64),(143,66),(145,86),(139,83)], '#4b6055')
    slab(d, [(143,66),(157,66),(155,86),(145,86)], '#5e7266')
    box(d, (147,68,154,80), '#63776a')
    box(d, (145,86,146,87), '#46594f')
    box(d, (153,86,154,87), '#46594f')
    slab(d, [(136,62),(149,61),(158,64),(142,65)], '#77887b')
    slab(d, [(136,62),(142,65),(158,64),(158,66),(142,67),(136,64)], '#4d6559')
    stroke(d, [(143,62),(143,59),(149,59),(150,61)], '#5c7165')
    stroke(d, [(144,59),(148,59)], '#8a9989')
    # Drain sits in the paving in front of the bin.
    slab(d, [(130,92),(141,92),(146,96),(134,96)], '#5b6c5e')
    for x in (132,136,140):
        stroke(d, [(x,93),(x+3,95)], '#89927c')
    for x,y in ((13,99),(118,119),(145,110)):
        stroke(d, [(x,y+1),(x+3,y+2)], '#6d7569')
        stroke(d, [(x,y),(x+3,y+1)], '#c9c3a7')
        d.point((x+3,y+1),fill='#b48a5f')
        d.point((x-1,y),fill='#545d53')
    # Low curb shadow and footprints ground the figures without contouring them.
    slab(d, [(26,101),(49,100),(65,103),(72,105),(69,107),(41,108),(26,105)], '#737a69')
    slab(d, [(93,94),(108,92),(132,93),(144,97),(139,99),(107,99),(93,97)], '#667363')
    slab(d, [(68,110),(75,108),(89,108),(95,111),(87,114),(73,114)], '#747b68')
    return im


def player_head():
    """Bake the registered head from the player's calm pose, facing the teller."""
    root = ET.parse(ART/'player/pose-2.svg').getroot()
    head = next(node for node in root.iter() if node.get('data-part') == 'head')
    head.attrib.pop('transform')
    root[:] = [head]
    root.set('viewBox', '0 0 19 16')
    root.set('width', '38')
    root.set('height', '32')
    with TemporaryDirectory() as folder:
        src, target = Path(folder)/'head.svg', Path(folder)/'head.png'
        ET.ElementTree(root).write(src)
        subprocess.run(['inkscape',str(src),'--export-png-antialias=0',
                        '--export-filename='+str(target)],check=True)
        return ImageOps.mirror(Image.open(target).convert('RGBA'))


def startled_head(head):
    # Keep the muzzle and coat markings registered during the wince.
    squint=head.copy()
    d=ImageDraw.Draw(squint)
    for x in (12,28):
        box(d,(x,16,x+1,19),FUR)
        box(d,(x-1,18,x+2,19),'#423633')
    return squint


def player(im, head, pose):
    # The new standing pose follows the warm flat coat, thick tail pixels and
    # paired hind feet of pose-2; the head above them is the original asset.
    dx, dy = {'hit':(-1,0),'recoil':(-4,0),'recover':(-3,0),'cry':(-2,0),
              'throw':(2,2),'cock':(-1,-1)}.get(pose,(0,0))
    layer = Image.new('RGBA', SIZE)
    d = ImageDraw.Draw(layer)
    slab(d, [(41,96),(33,96),(30,93),(26,93),(26,90),(24,90),(24,84),
             (22,82),(18,82),(16,84),(16,89),(19,92),(19,95),(24,99),
             (28,100),(36,102),(41,101)], FUR)
    box(d, (17,83,21,85), MARK)
    slab(d, [(41,69),(55,69),(58,73),(60,76),(60,85),(63,93),(62,100),
             (59,101),(59,104),(51,104),(50,100),(46,100),(44,104),
             (35,104),(35,101),(38,98),(37,92),(36,89),(37,80)], FUR)
    box(d, (51,98,52,100),MARK)
    box(d, (37,86,41,87),MARK)
    # Far paw stays close to the tummy, the near paw handles the red paper.
    slab(d, [(54,77),(57,77),(60,81),(64,82),(64,85),(58,86),(54,83)], CREAM)
    if pose=='cock':
        slab(d, [(47,81),(44,80),(43,76),(41,73),(37,72),(35,74),(37,80),
                 (41,84),(45,86),(48,85)], FUR)
    elif pose=='throw':
        slab(d, [(49,80),(54,80),(58,84),(65,87),(66,90),(64,92),(58,91),
                 (53,88),(49,86)], FUR)
        box(d, (63,88,65,90),CREAM)
    else:
        slab(d, [(46,80),(50,80),(54,85),(60,86),(61,88),(59,90),(53,90),
                 (48,87),(46,85)],FUR)
        box(d,(57,86,60,88),CREAM)
    head_at = {'hit':(34,43),'recoil':(29,42),'recover':(33,44),'cry':(34,43)}.get(pose,(36,41))
    hurting = pose in ('hit','recoil','recover','cry')
    layer.alpha_composite(startled_head(head) if hurting else head, head_at)
    if pose in ('recoil','recover','cry'):
        x,y=head_at
        box(d,(x+11,y+20,x+12,y+23),TEAR)
        box(d,(x+27,y+20,x+28,y+24),TEAR)
        d.point((x+11,y+21),fill=TEAR_LIGHT)
        d.point((x+28,y+22),fill=TEAR_LIGHT)
    if pose in ('recover','cry'):
        # Raised paw sits on the struck cheek. Keep the far paw in front of the bib.
        slab(d,[(52,81),(55,76),(60,75),(61,70),(65,67),(68,69),
                (67,74),(63,78),(59,85),(55,86)],FUR)
        box(d,(64,68,67,71),CREAM)
        box(d,(x+10,y+25,x+11,y+27),TEAR_LIGHT)
    im.alpha_composite(layer, (dx,dy))

def banker(im, staff, pose):
    # Jacket, gold badge, tie, face and eyes all come from the bank counter.
    dx = {'lift':1,'reach':-2,'hit':-6,'follow':-6,'recover':-2}.get(pose,0)
    person = Image.new('RGBA',SIZE)
    d = ImageDraw.Draw(person)
    slab(d, [(105,82),(127,82),(126,89),(124,94),(117,94),(116,89),
             (114,89),(113,95),(105,95),(104,92)], '#42534d')
    box(d, (103,94,112,96),'#353e39')
    box(d, (117,93,126,95),'#353e39')
    slab(d, [(103,68),(125,68),(128,83),(126,86),(118,86),(115,84),
             (112,86),(101,86),(100,83)],JACKET)
    stroke(d, [(113,84),(115,82),(118,85)],FABRIC)
    # Continue the rear hem beneath the original cropped jacket.
    torso_x, torso_y = 96,31
    person.alpha_composite(staff,(torso_x,torso_y))
    slab(d, [(126,71),(131,71),(131,80),(129,86),(126,86),(124,82)], FABRIC)
    box(d, (126,84,130,87),PAW)
    # The bank worker keeps a thin brown account folder under the far arm.
    slab(d, [(124,72),(129,71),(131,82),(126,83)], '#9c825f')
    stroke(d, [(126,73),(129,72)], '#c4ae85')
    if pose=='lift':
        slab(d,[(104,68),(108,72),(105,79),(98,78),(93,74),(90,67),
                (94,64),(99,71),(101,72)],JACKET)
        slab(d,[(89,62),(91,58),(94,59),(96,63),(94,66),(90,67)],PAW)
    elif pose=='reach':
        slab(d,[(103,65),(108,70),(104,75),(97,74),(90,70),(84,68),
                (85,64),(92,64),(99,68)],JACKET)
        stroke(d,[(86,64),(91,64),(99,68)],'#6c8278',2)
        slab(d,[(82,62),(86,62),(89,65),(86,69),(81,68),(79,66),(79,63)],PAW)
    elif pose=='hit':
        # This paw is part of the arm, and is drawn across the cheek in front of the cat.
        slab(d,[(104,65),(109,70),(103,75),(96,73),(87,69),(77,68),
                (77,64),(85,63),(94,66),(101,67)],JACKET)
        stroke(d,[(79,64),(85,64),(94,66),(102,68)],'#6c8278',2)
        stroke(d,[(79,68),(90,69),(102,73)],FABRIC,2)
        slab(d,[(73,61),(76,61),(78,64),(80,64),(80,67),(77,70),
                (72,69),(70,67),(70,64),(73,64)],PAW)
        box(d,(71,64,74,65),'#676454')
    elif pose=='follow':
        slab(d,[(104,66),(108,71),(103,75),(94,74),(84,69),(73,65),
                (74,61),(85,62),(95,67),(101,68)],JACKET)
        stroke(d,[(76,62),(85,62),(94,66)],'#6c8278')
        slab(d,[(70,59),(74,59),(77,62),(76,66),(70,65),(67,63),(67,60)],PAW)
    elif pose=='recover':
        slab(d,[(102,67),(107,71),(107,77),(100,80),(93,76),(93,70),
                (98,69),(99,74),(101,72)],FABRIC)
        box(d,(93,68,98,72),PAW)
    else:
        slab(d, [(101,69),(106,70),(107,78),(105,84),(100,82),(99,75)],FABRIC)
        box(d,(100,81,104,85),PAW)
    im.alpha_composite(person, (dx,0))


RED = ('#b54c45','#d57c68','#a0443d','#c76152')
BLUE = ('#4d798e','#779eab','#3c637d','#658fa1')
BLUE_BACK = (BLUE[3], BLUE[0], BLUE[1], BLUE[2])

# Both papers share the same scale on the ground. In flight the two half axes
# change with the tilt, including the edge-on frame at the top of the flip.
RED_POSES = {
    0:(60,84,7,6,-1,1),
    1:(36,73,6,8,1,2),
    2:(64,85,7,7,2,2),
    16:(69,88,8,7,2,3),
    3:(73,98,9,6,2,2),
    4:(76,110,10,5,1,0),
    8:(72,113,10,5,-1,0),
    19:(73,110,8,6,2,2),
}
BLUE_FLIP = {
    17:(86,106,10,5,1,1),
    5:(88,101,9,5,3,3),
    6:(91,99,5,8,3,2),
    18:(94,105,8,6,-2,-1),
    7:(97,110,10,5,0,0),
}


def paper(draw, colors, x, y, half_width=10, half_depth=5, tilt=0, skew=0):
    """Project a folded square with four planes and a single central tuck."""
    corners = [(x-half_width,y-tilt),(x+skew,y-half_depth),
               (x+half_width,y+tilt),(x-skew,y+half_depth)]
    for i, corner in enumerate(corners):
        slab(draw, [corner,corners[(i+1)%4],(x,y)], colors[i])
    draw.point((x,y),fill='#644442' if colors==RED else '#3a596b')


def actors(frame, head, staff):
    im=Image.new('RGBA',SIZE)
    blue=BLUE_BACK if frame in (6,18,7) else BLUE
    paper(ImageDraw.Draw(im),blue,*BLUE_FLIP.get(frame,(84,108)))
    banker_pose={9:'lift',10:'reach',11:'hit',12:'follow',13:'recover'}.get(frame,'still')
    player_pose={1:'cock',2:'throw',16:'throw',3:'throw',11:'hit',12:'recoil',
                 13:'recover',14:'cry',15:'cry'}.get(frame,'still')
    if frame in (11,12):
        player(im,head,player_pose)
        banker(im,staff,banker_pose)
    else:
        banker(im,staff,banker_pose)
        player(im,head,player_pose)
    d=ImageDraw.Draw(im)
    if frame==11:
        # A small warm burst at the actual point of contact, gone before the recoil.
        box(d,(69,60,71,61),'#f2cf9d')
        box(d,(65,62,65,64),'#f2cf9d')
        box(d,(66,67,68,68),'#f9dfb0')
        box(d,(69,70,69,71),'#f2cf9d')
    elif frame==12:
        box(d,(27,62,29,63),TEAR_LIGHT)
        box(d,(35,55,37,56),TEAR)
        box(d,(42,63,43,64),TEAR_LIGHT)
    elif frame==13:
        box(d,(23,66,25,67),TEAR)
        box(d,(31,69,31,70),TEAR_LIGHT)
    elif frame==14:
        box(d,(43,74,44,76),TEAR_LIGHT)
        box(d,(57,77,58,79),TEAR)
    elif frame==15:
        box(d,(44,79,45,81),TEAR)
    # The thrown sheet settles on the left. Only the blue one leaves the
    # pavement when struck inside the timing window.
    settled=(75,113) if frame in (5,6,7,17,18) else (72,115)
    paper(d,RED,*RED_POSES.get(frame,settled))
    if frame==0:
        box(d,(56,86,58,87),CREAM)
    return im


def build():
    prefix=ART/'pixel'
    entrance().save(prefix/'rehab-alley.webp',lossless=True,method=6)
    head=player_head()
    with Image.open(prefix/'bank-staff-still.webp') as sprite:
        staff=sprite.convert('RGBA')
    layout=json.loads(subprocess.check_output(['node','--input-type=module','-e',
        "import {rehabilitationAtlas} from './src/game/rehabilitation-motion.mjs'; console.log(JSON.stringify(rehabilitationAtlas));"],cwd=ROOT))
    left,top,width,height,frames=(layout[key] for key in ('left','top','width','height','frames'))
    rig=(left,top,left+width,top+height)
    atlas=Image.new('RGBA',(width*frames,height))
    for i in range(frames):
        frame=actors(i,head,staff)
        bounds=frame.getbbox()
        if bounds[0]<left or bounds[1]<top or bounds[2]>rig[2] or bounds[3]>rig[3]:
            raise ValueError(f'Frame {i} extends past the actor viewport: {bounds}')
        atlas.alpha_composite(frame.crop(rig),(width*i,0))
    atlas.save(prefix/'rehab-paper-poses.webp',lossless=True,method=6)


if __name__=='__main__': build()
