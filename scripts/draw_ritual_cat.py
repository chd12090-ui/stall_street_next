"""Draw the ceremonial cat on the lender's native square-pixel grid."""

from dataclasses import dataclass, replace
from functools import lru_cache
from math import cos, hypot, radians, sin
from pathlib import Path
import re
from xml.etree import ElementTree

from PIL import Image, ImageDraw

from draw_loan_office import lender
from draw_pixel_scenes import SIZE, box, slab, stroke


FRAME = (80, 68)
COLUMNS = 16
FLOOR = (40, 55)
PRELUDE_MS = 1250
MOUNT_MS = 1200
INTRO_MS = PRELUDE_MS + MOUNT_MS
PET_MS = 240
PHRASE_MS = 1455
FINALE_MS = 2000
HIT_MS = 1215
OUTRO_MS = 1080

FUR = '#343635'
FUR_SHADE = '#272a29'
FUR_EDGE = '#424340'
ROBE = '#47494b'
ROBE_SHADE = '#35383b'
ROBE_LIGHT = '#57595a'
TRIM = '#797b76'
COLLAR = '#b3ad9c'
KNOT = '#a18965'
GOLD = '#c59a56'
DARK_GOLD = '#897044'
GOLD_GLINT = '#e1bd78'
WOOD = '#785c45'
STEEL = '#c3c8bf'


@dataclass(frozen=True)
class Pose:
    # Body: horizontal step, jump, knee compression, shoulder lean.
    body: tuple
    # Feet: left x/lift, right x/lift, relative to the moving floor anchor.
    feet: tuple
    # Each wrist stores x, y and the angle to which the solid handle points.
    knife: tuple
    rattle: tuple
    # Follow-through is independent of the wrist. Positive angles turn down.
    bells: float
    hem: float
    # Continuous yaw lets the hands trade depth as the dancer turns.
    turn: float = 0
    stroke_arc: float = 0
    # Depth is the floor below the steel edge; folded knees bring the coat to ground.
    depth: float = 0
    folded: float = 0
    nuzzle: float = 0
    tail_curl: float = 0


# All distances are native pixels. Feet at zero stay on the top of the jakdu.
STAND = Pose((0,0,0,0),(-7,0,7,0),(-15,-21,-137),(15,-18,32),23,0)
# The near paw stays at x=-7 until the opposite heel touches x=9. The
# elbow leads the cut, the coat changes direction after the hips, and the
# bells overshoot the wrist on the stamp.
OPEN_LIFT = Pose((-2,0,2,-2),(-5,0,7,3),(-14,-23,-118),(13,-20,40),16,1,-15)
HIGH_LEFT = Pose((-4,0,0,-2),(-3,0,8,5),(-14,-31,-84),(16,-18,35),17,3,-25)
SWEEP_OUT = Pose((-4,0,-1,-1),(-3,0,7,5),(-12,-32,-52),(16,-19,20),30,3,-18)
SLICE = Pose((-3,0,-1,0),(-4,0,7,4),(-8,-31,-28),(17,-19,12),23,4,-10,20)
SWEEP_ACROSS = Pose((-2,0,0,1),(-5,0,8,3),(-1,-27,-7),(17,-19,-10),26,4,3,30)
SLICE_EXTEND = Pose((0,0,0,2),(-7,0,8,1),(5,-23,4),(17,-21,-38),36,3,15,34)
SWEEP_CONTACT = Pose((1,0,1,2),(-8,0,8,0),(9,-20,12),(17,-23,-62),36,2,22,30)
SWEEP_LAND = Pose((3,0,3,2),(-10,0,6,0),(11,-18,24),(16,-24,-75),24,-2,26,14)
LOW_RIGHT = Pose((4,0,3,2),(-10,2,5,0),(11,-16,39),(15,-26,-89),-9,-4,27)
WRIST_FOLD = Pose((4,0,2,2),(-10,3,5,0),(7,-15,62),(16,-25,-78),-14,-4,24)
DRAW_IN = Pose((4,0,1,1),(-9,4,5,0),(2,-16,84),(16,-24,-63),-21,-2,18)
RETURN_SWEEP = Pose((2,0,0,-1),(-8,5,7,0),(-11,-16,154),(17,-21,-9),-35,2,-5)
OPEN_REACH = Pose((0,0,0,-2),(-9,3,9,0),(-15,-17,182),(17,-21,2),-14,4,-15)
OPEN_STAMP = Pose((-2,0,1,-2),(-8,0,11,0),(-17,-19,197),(16,-22,6),11,5,-20)
OPEN_SINK = Pose((-2,0,3,-2),(-8,0,11,0),(-17,-18,206),(16,-21,12),26,4,-20)
LOW_RECOVER = Pose((-1,0,1,-1),(-9,0,6,2),(-15,-21,212),(15,-19,24),7,3,-12)
TURN_START = Pose((0,0,1,0),(-10,0,5,0),(-14,-22,222),(15,-19,19),16,1,0)

# The front of the turn pivots on the right toe (+5). The rear view hands
# the same spot to the left toe while the free foot describes the arc.
PIVOT_GATHER = Pose((2,0,3,2),(-7,2,3,0),(-13,-20,191),(16,-19,16),8,-3,20)
PIVOT_PUSH = Pose((3,0,2,2),(-6,3,2,0),(-9,-22,211),(15,-20,-8),23,-4,36)
PIVOT_QUARTER = Pose((3,0,1,2),(-4,4,2,0),(-4,-24,232),(13,-22,-36),31,-5,52)
PIVOT_EDGE = Pose((3,0,0,2),(-2,5,2,0),(1,-27,256),(11,-22,-50),24,-6,70)
PIVOT_PROFILE = Pose((3,0,-1,2),(0,5,2,0),(5,-28,272),(9,-21,-60),18,-7,87)
PIVOT_FAR = Pose((2,0,0,1),(3,4,3,0),(13,-28,296),(0,-22,-96),26,-8,126)
PIVOT_BACK_STEP = Pose((1,0,2,0),(4,2,4,0),(17,-24,326),(-11,-20,-132),23,-7,160)
PIVOT_BACK = Pose((0,0,1,-1),(5,0,-5,2),(18,-19,354),(-16,-20,-154),12,-6,183)
PIVOT_FOLLOW = Pose((-1,0,0,-2),(6,0,-5,4),(15,-17,389),(-16,-24,-117),-21,-1,218)
PIVOT_TRAIL = Pose((-2,0,-1,-2),(7,0,-4,6),(11,-16,416),(-14,-24,-109),-19,2,241)
PIVOT_LEFT = Pose((-3,0,-1,-2),(8,0,-2,6),(5,-18,452),(-10,-24,-95),-13,5,269)
PIVOT_UNWIND = Pose((-3,0,-1,-2),(8,0,1,5),(0,-20,475),(-6,-22,-66),-20,7,289)
PIVOT_OVER = Pose((-2,0,-1,-2),(7,0,3,4),(-6,-23,496),(-2,-19,-39),-24,7,307)
PIVOT_HOME = Pose((0,0,2,-1),(5,0,7,0),(-16,-19,535),(11,-16,33),-31,6,342)
PIVOT_UNCROSS = Pose((1,0,1,0),(-1,4,6,0),(-16,-19,550),(14,-18,21),18,5,351)
PIVOT_FINISH = Pose((0,0,1,0),(-6,0,7,0),(-15,-21,568),(15,-20,3),13,3,357)
CROSS_START = Pose((0,0,1,0),(-7,0,7,0),(-14,-20,-144),(15,-20,8),10,1,0)

# The staff folds inward across the chest and unrolls above the elbow.
# The long traveling jump lands on the right shoe before the knees absorb it.
CROSS_GATHER = Pose((-2,0,3,-2),(-5,0,8,4),(-8,-17,-101),(11,-20,-35),31,2,-18)
CROSS_FOLD = Pose((-5,0,4,-3),(-2,0,1,5),(1,-18,-58),(5,-20,-85),29,5,-31)
CROSS_THRUST = Pose((-7,0,1,-2),(0,0,-3,5),(5,-26,-32),(4,-20,-104),12,5,-20)
CROSS_LEFT = Pose((-7,0,3,-1),(0,0,6,3),(7,-31,-54),(10,-18,-58),-25,5,-8)
OVERHEAD = Pose((-5,0,0,1),(-2,0,8,5),(-1,-36,-42),(16,-17,4),-26,-2,10)
CROSS_LEAP = Pose((-2,3,0,1),(-7,3,8,5),(-9,-32,-69),(16,-21,-8),13,-5,20)
CROSS_CREST = Pose((1,6,1,2),(-5,5,8,7),(-10,-33,-105),(15,-23,-39),26,-6,26)
CROSS_FLOAT = Pose((4,6,1,2),(-6,6,7,5),(-12,-31,-135),(14,-25,-56),18,-7,25)
CROSS_OPEN = Pose((6,4,1,2),(-8,5,7,2),(-13,-26,-164),(14,-25,-71),11,-6,20,32)
CROSS_REACH = Pose((7,2,0,2),(-9,5,6,1),(-16,-21,-185),(12,-25,-87),16,-6,14,34)
CROSS_RIGHT = Pose((8,0,1,2),(-9,4,5,0),(-17,-17,-204),(11,-25,-98),24,-5,6,31)
CROSS_ABSORB = Pose((8,0,4,2),(-10,2,5,0),(-17,-16,-217),(12,-25,-92),6,-5,0,15)
CROSS_SETTLE = Pose((7,0,3,1),(-9,0,6,0),(-16,-15,-224),(14,-22,-58),-22,-2,-12)
CROSS_TURNIN = Pose((4,0,1,-1),(-6,0,8,3),(-15,-18,-192),(14,-21,-8),-24,2,-15)
HOME = Pose((1,0,1,0),(-5,0,7,0),(-15,-20,-146),(15,-18,25),-8,1,-4)

# On the last accent the left toe touches first. At full compression the
# blade and weighted bells are still moving; they settle at different times.
BOW = Pose((0,0,4,0),(-7,0,7,0),(-17,-19,-151),(16,-19,53),13,0)
WIND = Pose((0,0,2,-1),(-7,0,7,0),(-12,-23,-76),(16,-22,-48),35,-2,-12)
SALUTE = Pose((0,0,-1,0),(-7,0,7,0),(-10,-31,-67),(15,-26,-85),11,-1,-10)
COIL = Pose((-1,0,4,-1),(-6,0,8,0),(-8,-31,-60),(16,-25,-96),14,-3,-16)
TAKEOFF = Pose((0,3,0,0),(-6,3,6,3),(-11,-29,-72),(15,-25,-99),17,-2,-9)
CREST = Pose((0,7,1,0),(-8,6,7,7),(-13,-26,-99),(15,-25,-103),10,-4,8)
SUSPEND = Pose((0,7,1,1),(-10,4,8,7),(-14,-25,-113),(16,-25,-100),-7,-4,12)
DROP = Pose((0,5,0,1),(-11,2,10,4),(-15,-24,-131),(16,-25,-88),-10,-2,13)
BRACE = Pose((0,2,0,1),(-11,0,11,2),(-17,-22,-157),(17,-24,-60),-24,-1,15,26)
STRIKE = Pose((0,1,0,1),(-11,0,11,2),(-17,-21,-180),(18,-22,-24),-41,1,14,32)
HIT = Pose((0,0,1,1),(-11,0,11,2),(-17,-19,-202),(18,-20,14),-52,3,10,30)
CATCH = Pose((0,0,3,1),(-11,0,11,0),(-17,-18,-211),(17,-19,37),-46,4,8,21)
FOLLOW = Pose((0,0,4,1),(-11,0,11,0),(-17,-18,-219),(16,-19,53),-23,5,6)
REBOUND = Pose((0,0,3,1),(-11,0,11,0),(-18,-19,-207),(16,-19,42),25,3,4)
RECENTER = Pose((0,0,1,0),(-11,0,11,0),(-18,-21,-164),(17,-18,17),19,1,2)
LIFT_CHIN = Pose((0,0,0,0),(-11,0,11,0),(-18,-23,-130),(17,-18,11),15,1,0)
STILL = Pose((0,0,-1,0),(-11,0,11,0),(-17,-24,-105),(17,-18,10),14,0)


# The dancer rests on the floor in front of the jakdu, facing out to the
# audience on the right. The blade is behind the dancer's left shoulder.
SEATED = Pose((-4,0,2,1),(-3,0,4,1),(-2,-14,186),(5,-15,13),7,2,48,
              depth=2,folded=1)
INHALE = replace(SEATED,body=(-4,0,0,1),rattle=(5,-15,8),bells=2)
TIP_EAR = replace(INHALE,body=(-4,0,0,-1),turn=59,knife=(-3,-14,183))
EXHALE = replace(SEATED,body=(-4,0,2,0),turn=52,rattle=(5,-15,6),bells=15)
LISTEN = replace(SEATED,body=(-4,0,2,0),turn=61,rattle=(5,-15,8))
LOOK_BACK = replace(SEATED,body=(-4,0,1,-1),turn=92,knife=(-3,-16,198),
                    rattle=(5,-16,-8),bells=16,folded=.86)
KNOCK = Pose((-4,0,3,-2),(-3,0,5,1),(-3,-20,214),(3,-19,-30),42,3,117,
             depth=2,folded=.60)
LOAD = Pose((-3,0,4,-2),(-4,0,4,0),(1,-21,243),(-7,-20,-119),-15,4,150,
            depth=2,folded=.27)
PUSH_OFF = Pose((-3,2,1,-1),(-5,2,5,1),(7,-24,268),(-7,-22,-132),36,5,143,
                depth=2,folded=.04)
MOUNT_RISE = Pose((-2,7,0,0),(-6,4,4,3),(5,-27,269),(-4,-24,-102),-24,5,105,depth=1)
MOUNT_APEX = Pose((-1,8,1,1),(-7,5,6,6),(-4,-26,259),(8,-23,-81),26,5,66,depth=1)
MOUNT_REACH = Pose((0,3,0,1),(-8,1,6,3),(-10,-22,240),(14,-22,-55),-19,3,26,depth=1)
MOUNT_TOUCH = Pose((0,0,1,1),(-8,0,7,2),(-13,-21,222),(15,-21,-3),-18,1,12)
MOUNT_LAND = Pose((0,0,4,0),(-8,0,7,0),(-14,-21,217),(16,-20,14),59,-2,5)
MOUNT_RECOVER = Pose((0,0,1,-1),(-7,0,7,0),(-15,-21,220),(15,-19,29),-8,-1,-4)

# The nearer shoe descends first while the other is planted on the steel;
# the body turns sideways and the sleeves meet again on the folded knees.
LEAVE_GATHER = Pose((-1,0,2,0),(-10,0,10,2),(-15,-20,-149),(15,-19,18),22,-1,17)
LEAVE_REACH = Pose((-2,0,2,1),(-9,1,9,1),(-13,-18,-168),(15,-18,20),34,-2,38,depth=1)
STEP_DOWN = Pose((-2,0,2,2),(-9,2,9,0),(-9,-17,-173),(11,-18,31),-11,-1,66,depth=2)
FLOOR_TURN = Pose((-3,0,1,1),(-5,4,10,0),(-4,-19,197),(9,-20,0),25,3,84,depth=2)
TUCK_HEELS = Pose((-3,0,2,0),(-3,1,10,0),(-5,-17,188),(8,-18,10),16,3,69,
                  depth=2,folded=.28)
SINK = Pose((-4,0,2,1),(-2,0,5,0),(-3,-15,181),(6,-16,16),-5,2,54,
            depth=2,folded=.70)
TUCK_PAWS = replace(SEATED,rattle=(5,-17,14),bells=18)

# The planted knees and both props stay down as the cheek leans into a pet.
# The tail follows the head a beat later, uncurls beside the coat, then settles.
NUDGE = replace(SEATED,body=(-4,0,1,1),turn=40,nuzzle=.45,tail_curl=.05)
LEAN_IN = replace(SEATED,body=(-4,0,1,2),turn=32,nuzzle=1,tail_curl=.40)
PURR = replace(LEAN_IN,bells=12,tail_curl=1)
RELAX = replace(NUDGE,bells=6,tail_curl=.80)
SOFTEN = replace(SEATED,nuzzle=.1,tail_curl=.30)


def echo(pose, bells):
    return replace(pose,bells=bells)


# Key drawings have explicit ring and footfall times. Between drawings a
# single native-pixel breakdown advances the shoulders, cloth and accessories.
WOOD_KNOCK_MS = PRELUDE_MS + 420
PUSH_OFF_MS = PRELUDE_MS + 620
intro_keys = [
    (0,SEATED),(180,SEATED),(430,INHALE),(645,TIP_EAR),(765,TIP_EAR),
    (1040,EXHALE),(PRELUDE_MS,SEATED),(PRELUDE_MS+160,SEATED),
    (PRELUDE_MS+260,LISTEN),(PRELUDE_MS+355,LOOK_BACK),(WOOD_KNOCK_MS,KNOCK),
    (PRELUDE_MS+525,LOAD),(PUSH_OFF_MS,PUSH_OFF),(PRELUDE_MS+692,MOUNT_RISE),
    (PRELUDE_MS+770,MOUNT_APEX),(PRELUDE_MS+862,MOUNT_REACH),
    (PRELUDE_MS+950,MOUNT_TOUCH),(PRELUDE_MS+989,MOUNT_LAND),(PRELUDE_MS+1022,echo(MOUNT_LAND,24)),
    (PRELUDE_MS+1080,MOUNT_RECOVER),(PRELUDE_MS+1150,STAND),(INTRO_MS,STAND),
]
# Eight even exposures. The shared home gesture rewinds to the third one on a retap.
# The palm settles on the crown (around x38, y18), follows the tilt, then lifts.
pet_cells = [
    (SEATED, 'open', 24, 4), (NUDGE, 'open', 26, 8),
    (LEAN_IN, 'contact', 28, 11), (PURR, 'contact', 31, 12),
    (PURR, 'contact', 33, 12), (RELAX, 'open', 32, 8),
    (SOFTEN, 'open', 30, 3), (SEATED, None, 0, 0),
]
opening_keys = [
    (0,STAND),(115,OPEN_LIFT),(215,HIGH_LEFT),(270,SWEEP_OUT),
    (305,SLICE),(340,SWEEP_ACROSS),(375,SLICE_EXTEND),(405,SWEEP_CONTACT),(460,SWEEP_LAND),(495,echo(SWEEP_LAND,8)),
    (565,LOW_RIGHT),(608,WRIST_FOLD),(650,DRAW_IN),(790,RETURN_SWEEP),(910,OPEN_REACH),
    (1070,OPEN_STAMP),(1130,OPEN_SINK),(1260,LOW_RECOVER),
    (1380,TURN_START),(PHRASE_MS,TURN_START),
]
turn_keys = [
    (0,TURN_START),(115,PIVOT_GATHER),(164,PIVOT_PUSH),(205,PIVOT_QUARTER),(240,PIVOT_EDGE),(270,PIVOT_PROFILE),
    (340,PIVOT_FAR),(405,PIVOT_BACK_STEP),(520,PIVOT_BACK),
    (650,echo(PIVOT_BACK,-13)),(745,PIVOT_FOLLOW),(785,PIVOT_TRAIL),(825,PIVOT_LEFT),
    (870,PIVOT_UNWIND),(915,PIVOT_OVER),(1070,PIVOT_HOME),(1160,PIVOT_UNCROSS),
    (1275,PIVOT_FINISH),(1380,CROSS_START),(PHRASE_MS,CROSS_START),
]
travel_keys = [
    (0,CROSS_START),(100,CROSS_GATHER),(205,CROSS_FOLD),(290,CROSS_THRUST),
    (405,CROSS_LEFT),(505,echo(CROSS_LEFT,13)),(630,OVERHEAD),
    (730,CROSS_LEAP),(820,CROSS_CREST),(895,CROSS_FLOAT),
    (985,CROSS_OPEN),(1030,CROSS_REACH),(1070,CROSS_RIGHT),(1110,CROSS_ABSORB),(1160,CROSS_SETTLE),
    (1260,CROSS_TURNIN),(1375,HOME),(PHRASE_MS,STAND),
]
finale_keys = [
    (0,STAND),(180,BOW),(340,echo(BOW,45)),(470,WIND),(630,SALUTE),
    (710,echo(SALUTE,-13)),(795,COIL),(875,TAKEOFF),(970,CREST),
    (1030,SUSPEND),(1110,DROP),(1165,BRACE),(1190,STRIKE),(HIT_MS,HIT),
    (1238,CATCH),(1270,FOLLOW),(1330,echo(FOLLOW,31)),(1410,REBOUND),(1485,RECENTER),
    (1525,LIFT_CHIN),(1560,STILL),(1660,echo(STILL,26)),(1760,echo(STILL,44)),
    (1830,STILL),(FINALE_MS,STILL),
]
outro_keys = [
    (0,STILL),(100,LEAVE_GATHER),(195,LEAVE_REACH),(305,STEP_DOWN),
    (425,FLOOR_TURN),(550,TUCK_HEELS),(675,SINK),(790,TUCK_PAWS),
    (860,echo(TUCK_PAWS,-5)),(920,SEATED),(OUTRO_MS,SEATED),
]


def mix(a,b,f):
    return a+(b-a)*f


def blend_pose(a,b,f):
    def points(u,v):
        return tuple(mix(x,y,f) for x,y in zip(u,v))
    def wrist(u,v):
        return mix(u[0],v[0],f),mix(u[1],v[1],f),u[2]+((v[2]-u[2]+180)%360-180)*f
    return Pose(points(a.body,b.body),points(a.feet,b.feet),
                wrist(a.knife,b.knife),wrist(a.rattle,b.rattle),
                mix(a.bells,b.bells,f),mix(a.hem,b.hem,f),
                a.turn + ((b.turn-a.turn+180)%360-180)*f,mix(a.stroke_arc,b.stroke_arc,f),
                mix(a.depth,b.depth,f),mix(a.folded,b.folded,f),
                mix(a.nuzzle,b.nuzzle,f),mix(a.tail_curl,b.tail_curl,f))


def drawings(keys):
    for (start,a),(end,b) in zip(keys,keys[1:]):
        hold = end-start
        if hold >= 100 and a != b:
            half = hold//2
            yield a, half
            yield blend_pose(a,b,.5), hold-half
        else:
            yield a,hold


def pixels(points):
    return [(round(x),round(y)) for x,y in points]


def polygon(draw, points, color):
    slab(draw,pixels(points),color)


def line(draw, points, color, width=1):
    stroke(draw,pixels(points),color,width)


def rect(draw,x0,y0,x1,y1,color):
    box(draw,(round(x0),round(y0),round(x1),round(y1)),color)


def at(o, points):
    return [(o[0]+x,o[1]+y) for x,y in points]


@lru_cache(maxsize=1)
def black_head():
    # The head is the original lender's stepped silhouette and two shaded
    # planes. Remove jacket pixels and repaint the face for this character.
    original = Image.new('RGBA',SIZE)
    lender(ImageDraw.Draw(original),0)
    original = original.crop((36,78,74,110))
    material = {
        '#4a4845':FUR, '#3e3e3d':FUR_SHADE, '#57504a':'#3d3e3a',
        '#5c554f':'#3c3e39', '#70615d':'#605550', '#665653':'#534945',
        '#d3a478':FUR, '#393634':FUR, '#866664':'#3c3e39',
        '#393633':'#3c3e39', '#353433':FUR,
    }
    colors = {tuple(bytes.fromhex(k[1:])):tuple(bytes.fromhex(v[1:]))+(255,)
              for k,v in material.items()}
    result = Image.new('RGBA',original.size)
    result.putdata([colors.get(c[:3],(0,0,0,0)) for c in original.getdata()])
    return result.resize((28, 23), Image.Resampling.NEAREST)


@lru_cache(maxsize=24)
def hatted_head(view, left, lowered, contented=False):
    """Five drawn views share the same hat and shoulder attachment."""
    portrait = Image.new('RGBA',(42,30))
    draw = ImageDraw.Draw(portrait)
    if view <= 1:
        head=black_head()
        if view==1:
            head=head.resize((26,23),Image.Resampling.NEAREST)
        portrait.alpha_composite(head,(7+view,7))
        for cutout in ((7,7,14,8),(7,9,9,9),(12,9,14,9),
                       (27,7,34,8),(27,9,29,9),(32,9,34,9)):
            box(draw,cutout,(0,0,0,0))
        nose = 19+4*view
        box(draw,(nose,22,nose+2,23),'#76635b')
        box(draw,(nose+1,24,nose+1,25),FUR_SHADE)
        box(draw,(nose,25,nose+4,25),FUR_SHADE)
        stroke(draw,[(9+view,19),(10+view,23),(12+view,26),(14+view,28)],'#484b45')
        stroke(draw,[(32+view,18),(31+view,23),(29+view,26),(27+view,28)],'#414744')
    elif view==2:
        # The near ear, forward muzzle and short nose make the side view
        # recognizable even as the eye slips underneath the brim.
        slab(draw,[(10,13),(12,10),(13,7),(15,8),(18,12),(22,11),(25,6),
                   (27,6),(28,12),(31,15),(32,20),(35,21),(35,24),(32,25),
                   (30,27),(26,28),(16,28),(12,26),(10,22)],FUR_SHADE)
        slab(draw,[(12,14),(15,10),(18,13),(24,12),(26,8),(27,14),(30,16),
                   (31,21),(34,22),(34,23),(30,25),(23,27),(15,26),(12,22)],FUR)
        box(draw,(25,10,26,13),'#5e514e')
        box(draw,(33,21,35,22),'#76635b')
        box(draw,(31,24,34,24),FUR_SHADE)
        stroke(draw,[(13,18),(14,23),(16,26),(19,28)],'#495049')
    else:
        # The reverse has solid nape fur, a displaced far ear in three-quarter
        # view and no projected face on the back of the dancer's head.
        rear=1 if view==3 else 0
        slab(draw,[(8+rear,14),(9+rear,8),(11+rear,6),(16+rear,12),
                   (24,12),(29-rear,6),(32-rear,7),(33-rear,14),(35-rear,17),
                   (34-rear,24),(30-rear,26),(27-rear,29),(21,28),(18,29),
                   (10+rear,26),(7+rear,21)],FUR_SHADE)
        slab(draw,[(10+rear,14),(12+rear,9),(16+rear,14),(25,13),(29-rear,9),
                   (31-rear,13),(33-rear,17),(31-rear,23),(27-rear,26),
                   (22,27),(19,26),(17,27),(12+rear,24),(9+rear,20)],FUR)
        stroke(draw,[(12+rear,22),(14+rear,24),(17+rear,25)],'#414540')
        stroke(draw,[(25,25),(28,23),(29,21)],'#3b3f3a')

    mesh=Image.new('RGBA',portrait.size)
    weave=ImageDraw.Draw(mesh)
    # An open woven crown, two pixels taller, and a broad low Korean gat brim.
    slab(weave,[(15,1),(26,1),(27,2),(27,8),(28,12),(29,15),
                (12,15),(13,11),(14,4),(14,2)],(27,35,35,178))
    stroke(weave,[(15,1),(25,1)],(91,103,98,248))
    stroke(weave,[(14,2),(14,7),(13,11),(13,14)],(70,80,77,248))
    stroke(weave,[(26,2),(27,4),(27,9),(28,13)],(42,50,49,245))
    for x,y in ((16,3),(21,4),(18,6),(23,7),(15,10),(19,10)):
        stroke(weave,[(x,y),(x+1,y+1)],(55,66,63,175))
    portrait.alpha_composite(mesh)
    slab(draw,[(0,17),(3,16),(7,15),(13,14),(28,14),(34,15),(38,16),
               (41,17),(41,18),(36,19),(31,19),(28,20),(13,20),(10,19),
               (5,19),(0,18)],'#252c2b')
    slab(draw,[(2,17),(10,15),(30,15),(38,17),(31,18),(12,18),(7,17)],'#38413e')
    stroke(draw,[(0,17),(3,16),(8,16),(10,15),(13,15)],'#56625b')
    stroke(draw,[(13,14),(28,14)],'#222927',2)
    stroke(draw,[(13,19),(28,19)],'#394440')
    if contented and view==1:
        # A closed near eyelid peeks out beneath the tilted brim.
        stroke(draw,[(24,22),(25,21),(27,21),(28,22)],'#93836c')
    elif not lowered and view<3:
        draw.point(([14,21,29][view],21),fill='#817457')
    if left and view in (1,2,3):
        portrait=portrait.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return portrait


def paw(d,x,y,foot=False):
    if foot:
        polygon(d,at((x,y),[(-3,-3),(1,-3),(1,-2),(3,-2),(3,0),(-4,0),(-4,-2),(-3,-2)]),FUR)
        rect(d,x-3,y-2,x-1,y-2,FUR_EDGE)
        rect(d,x-3,y,x+3,y,FUR_SHADE)
    else:
        polygon(d,at((x,y),[(-2,-2),(1,-2),(2,-1),(2,1),(1,2),(-2,2),(-3,1),(-3,-1)]),FUR_EDGE)
        rect(d,x-2,y+1,x+1,y+2,FUR_SHADE)


def tail(d,cx,base,sway,facing,across,fold):
    # A side curl disappears behind the legs in profile and emerges on the
    # opposite side of the back view. The moving coat and tail drag apart.
    def point(side,depth,y):
        # Draw the standing curl back into the coat before the folded tail
        # comes around the knee. Only one silhouette is visible at the handoff.
        tuck=min(1,max(0,(fold-.28)/.36))
        return cx+(side*facing+depth*across+sway*.27)*(1-tuck), base+mix(y,-7,tuck)
    p=[point(-8,-4,-6),point(-15,-6,-6),point(-20,-7,-9),
       point(-21,-6,-13),point(-19,-4,-16-sway*.18)]
    line(d,p,FUR_SHADE,4)
    line(d,[(x-1,y-1) for x,y in p[:-1]]+[p[-1]],FUR,3)
    x,y=p[-1]
    rect(d,x-1,y-1,x+1,y+1,FUR_EDGE)


def legs(d,cx,base,feet,facing,across,fold):
    order=(2,0) if across>0 else (0,2)
    for index in order:
        x, up = feet[index:index+2]
        px,py=cx+x,base-up
        root = cx+(-7 if index==0 else 7)*facing-across
        knee=mix(root,cx+(-14 if index==0 else 13),fold)
        hip=base-12+6*fold
        thigh=[(root-3,hip),(root+3,hip)]
        if fold:
            thigh.append((knee+3,base-6+fold))
        polygon(d,thigh+[(px+2,py-3),(px+1,py-2),(px-3,py-2)],ROBE_SHADE)
        rect(d,px-2,py-4,px+1,py-2,TRIM)
        paw(d,px,py,True)


def robe(d,cx,base,comp,lean,sway,facing,across,fold):
    sx,sy=cx+lean,base-22+comp
    waist=base-12+comp*.45
    hem=base-6+min(0,comp)*.45+4*fold
    breadth=1-.26*abs(across)
    shoulder=round(9*breadth)
    hip=round(8*breadth+3*fold)
    edge=round(12*breadth+abs(sway)*.30+5*fold)
    skirt=[(sx-shoulder+2,sy-2),(sx+shoulder-2,sy-2),(sx+shoulder+1,sy+2),
           (cx+hip,waist),(cx+edge+sway,hem-2),(cx+edge+sway,hem),
           (cx+2+sway,hem+1),(cx-3+sway,hem),(cx-edge-1+sway,hem),
           (cx-edge-1+sway,hem-2),(cx-hip,waist),(sx-shoulder-2,sy+2)]
    polygon(d,skirt,ROBE)
    polygon(d,[(sx+shoulder*.4,sy-1),(sx+shoulder,sy+2),(cx+hip-1,waist),
               (cx+edge+sway,hem-2),(cx+edge+sway,hem),(cx+3+sway,hem+1),
               (cx+1,waist)],ROBE_SHADE)
    line(d,[(cx-5,waist+2),(cx-7+sway,hem-1)],ROBE_LIGHT,2)
    line(d,[(cx+3,waist+2),(cx+5+sway,hem-1)],ROBE,2)
    line(d,[(cx-edge+sway,hem-1),(cx-4+sway,hem-1)],TRIM)
    if facing<-.3:
        # A back yoke and two short folded ribbons replace the front collar.
        neck=cx-2*across+lean
        line(d,[(sx-shoulder+1,sy),(neck,sy+3),(sx+shoulder-1,sy)],TRIM,2)
        line(d,[(neck,sy+4),(cx,waist-1)],ROBE_SHADE,2)
        line(d,[(cx-hip,waist),(cx+hip,waist)],'#454440',2)
        line(d,[(cx,waist+1),(cx+2+sway*.5,waist+4)],'#777363',2)
    else:
        # The nearer lapel travels toward the side seam in profile.
        neck=sx+4*across
        polygon(d,[(neck-6*breadth,sy-1),(neck-3*breadth,sy-1),(neck+2,sy+5),
                   (neck,sy+7),(neck-3,sy+4)],TRIM)
        polygon(d,[(neck+4*breadth,sy-1),(neck+7*breadth,sy),(neck+5*breadth,sy+3),
                   (neck-1,sy+9),(neck-3,sy+8),(neck+1,sy+4)],COLLAR)
        line(d,[(cx-hip+1,waist),(cx+hip-1,waist)],ROBE_SHADE,2)
        knot=cx+4*across
        rect(d,knot-1,waist-1,knot+2,waist,KNOT)
        polygon(d,[(knot+1,waist),(knot+3,waist),(knot+6+sway*.4,waist+3),
                   (knot+4+sway*.4,waist+4)],'#8a755a')


def seated_legs(d,cx,base,fold,feet,tail_curl):
    # Bent knees sit outside the pooled coat. The near folded shin, cuff and
    # curled tail overlap the hem instead of hanging underneath as if standing.
    if fold<.24:
        return
    for side,i in ((1,2),(-1,0)):
        knee=cx+side*(5+9*fold)
        ky=base-4-fold
        heel=cx+feet[i]
        hy=base-feet[i+1]-1
        polygon(d,[(knee-3*side,ky-2),(knee+2*side,ky-2),(knee+4*side,ky),
                   (knee+3*side,ky+3),(heel,hy+1),(heel,hy-1)],ROBE_SHADE)
        line(d,[(knee+side,ky-1),(knee+2*side,ky),(heel+3*side,hy-1)],ROBE_LIGHT)
        rect(d,heel-2,hy-1,heel+1,hy,TRIM)
        paw(d,heel,hy+1,True)
    if fold>.64:
        end=cx-6+12*fold
        bend=base-1
        points=[(cx-12,base-6),(cx-16,base-4),(cx-16,bend-1),
                (cx-12,bend+1),(end-3,bend+1),(end,bend)]
        if fold<.88:
            unfurl=(fold-.64)/.24
            points=[(mix(cx-11,x,unfurl),mix(base-5,y,unfurl)) for x,y in points]
        if tail_curl:
            lifted=at((cx,base),[(-12,-6),(-16,-4),(-21,-6),
                                (-23,-12),(-23,-16),(-20,-18)])
            points=[(mix(x,u,tail_curl),mix(y,v,tail_curl))
                    for (x,y),(u,v) in zip(points,lifted)]
        line(d,points,FUR_SHADE,3)
        line(d,points[:-1],FUR,2)
        x,y=points[-1]
        line(d,[(x-2,y),(x,y)],FUR_EDGE)


def arm(d,shoulder,wrist,side,facing,across):
    sx,sy=shoulder
    sx+=side*8*facing+2*across
    wx,wy=wrist
    # The bell arm opens its silhouette away from the head on the upstroke.
    ex=sx+(wx-sx)*.56+3*side*facing
    ey=sy+min(5,2+(wy-sy)*.35)
    def sleeve_segment(a,b,ra,rb):
        vx,vy=b[0]-a[0],b[1]-a[1]
        length=max(1,hypot(vx,vy))
        nx,ny=-vy/length,vx/length
        if ny<0:
            nx,ny=-nx,-ny
        topa=(a[0]-nx*ra,a[1]-ny*ra)
        topb=(b[0]-nx*rb,b[1]-ny*rb)
        lowa=(a[0]+nx*ra,a[1]+ny*ra)
        lowb=(b[0]+nx*rb,b[1]+ny*rb)
        polygon(d,[topa,topb,lowb,lowa],ROBE)
        line(d,[lowa,lowb],ROBE_SHADE,2)
        return topb,lowb
    sleeve_segment((sx,sy),(ex,ey),3.7,3.1)
    cuff=sleeve_segment((ex,ey),(wx,wy),3,3.6)
    line(d,cuff,TRIM,2)


def direction(angle):
    theta=radians(angle)
    return cos(theta),sin(theta)


def basis(origin,angle,points):
    ux,uy=direction(angle)
    return [(origin[0]+u*ux-v*uy,origin[1]+u*uy+v*ux) for u,v in points]


def knife(d,p,angle):
    polygon(d,basis(p,angle,[(-4,-1),(4,-1),(4,1),(-4,1)]),WOOD)
    polygon(d,basis(p,angle,[(4,-2),(9,-2),(13,-3),(16,-5),(15,-1),(11,2),(4,2)]),'#909b96')
    polygon(d,basis(p,angle,[(4,-2),(9,-2),(13,-3),(16,-5),(13,-1),(5,1)]),STEEL)
    line(d,basis(p,angle,[(3,-2.4),(3,2.4)]),'#a48a64',2)
    paw(d,*p)


def rattle(d,p,shaft,lag):
    polygon(d,basis(p,shaft,[(-4,-1),(8,-1),(8,1),(-4,1)]),WOOD)
    line(d,basis(p,shaft,[(2,-1),(7,-1)]),'#a58b60')
    joint=basis(p,shaft,[(8,0)])[0]
    # Four brass bells on short links. The fork follows the fist rigidly, but
    # the cluster continues through damped angles after the wrist stops.
    axis=shaft+lag
    positions=basis(joint,axis,[(3,-2.9),(3.3,2.5),(8,-2.5),(8.2,2.7)])
    for xy in positions:
        line(d,[joint,xy],DARK_GOLD)
    for i,(x,y) in enumerate(positions):
        x,y=round(x),round(y)
        metal='#bb9252' if i<2 else GOLD
        rect(d,x-1,y-1,x+1,y+1,'#7e623e')
        rect(d,x-2,y,x+2,y,metal)
        rect(d,x-1,y-1,x+1,y,metal)
        rect(d,x-1,y-2,x,y-2,GOLD_GLINT)
        rect(d,x+1,y,x+1,y+1,'#997744')
        rect(d,x-1,y+1,x-1,y+1,metal)
        rect(d,x,y+1,x,y+2,'#756045')
    ix,iy=joint
    rect(d,ix-1,iy-1,ix+1,iy,DARK_GOLD)
    paw(d,*p)


def sweep_glint(d,wrist,angle,arc):
    # Short, stepped impressions follow the outside of a fast turning blade.
    if abs(arc)<13:
        return
    for radius,tint,scale in ((17,'#8d9d91',1),(14,'#75877c',.7)):
        points=[basis(wrist,angle+arc*f*scale,[(radius,0)])[0] for f in (.21,.47,.73,1)]
        line(d,points,tint)


def paint(pose):
    image=Image.new('RGBA',FRAME)
    d=ImageDraw.Draw(image)
    dx,jump,compress,lean=pose.body
    cx,base=FLOOR[0]+dx,FLOOR[1]+pose.depth-jump
    compress+=8*pose.folded
    facing,across=direction(pose.turn)
    shoulder=(cx+lean,base-22+compress)
    wrist_blade=(cx+pose.knife[0],base+pose.knife[1]+compress*.65)
    wrist_bells=(cx+pose.rattle[0],base+pose.rattle[1]+compress*.65)
    def sleeve(side):
        wrist=wrist_blade if side==-1 else wrist_bells
        arm(d,shoulder,wrist,side,facing,across)
    def prop(side):
        if side==-1:
            sweep_glint(d,wrist_blade,pose.knife[2],pose.stroke_arc)
            knife(d,wrist_blade,pose.knife[2])
        else:
            rattle(d,wrist_bells,pose.rattle[2],pose.bells)

    if pose.depth>1:
        # A small contact patch on the foreground wood marks which plane the
        # cat is on, and recedes before the dancer reaches the blade.
        ground=round(FLOOR[1]+pose.depth)
        half=round(4+8*pose.folded+max(0,3-jump))
        ink='#584b43' if jump>1 else '#4f443e'
        line(d,[(cx-half,ground+1),(cx+half,ground+1)],ink,1)
    if pose.folded<=.64:
        tail(d,cx,base,pose.hem,facing,across,pose.folded)
    legs(d,cx,base,pose.feet,facing,across,pose.folded)
    # At the two profiles, the far hand and its prop pass behind the
    # silhouette. The front-facing opening sweeps come across the near sleeve.
    far=0 if abs(across)<.62 else (1 if across>0 else -1)
    if far:
        sleeve(far)
        prop(far)
    robe(d,cx,base,compress,lean,pose.hem,facing,across,pose.folded)
    seated_legs(d,cx,base,pose.folded,pose.feet,pose.tail_curl)
    near_sides=[side for side in (-1,1) if side!=far]
    for side in near_sides:
        sleeve(side)
    angle=(pose.turn+180)%360-180
    view=min(4,round(abs(angle)/45))
    head=hatted_head(view,angle<0,compress>=3 or pose.body==STILL.body,pose.nuzzle>.6)
    # The broad brim tips with the shoulders; rotate about the neck rather
    # than the hat center so the head stays attached during the side steps.
    roll=round(-1.5*lean-2*across+11*pose.nuzzle)
    hat_x=round(cx-21+lean+across+pose.nuzzle)
    hat_y=round(base-49+compress-2*pose.nuzzle)
    if roll:
        pad=Image.new('RGBA',(50,36))
        pad.alpha_composite(head,(4,3))
        head=pad.rotate(roll,Image.Resampling.NEAREST,center=(25,30))
        hat_x-=4
        hat_y-=3
    image.alpha_composite(head,(hat_x,hat_y))
    for side in near_sides:
        if side==-1 and abs(wrist_blade[0]-cx)<12:
            # The raised forearm must meet the fist when it crosses the face.
            sleeve(side)
        prop(side)
    return image


def sequence(keys, atlas, numbers):
    result=[]
    for pose,ms in drawings(keys):
        frame=paint(pose)
        footprint=frame.tobytes()
        if footprint not in numbers:
            numbers[footprint]=len(atlas)
            atlas.append(frame)
        index=numbers[footprint]
        if result and result[-1][0]==index:
            result[-1]=(index,result[-1][1]+ms)
        else:
            result.append((index,ms))
    return result


def timeline_literal(seq):
    # Keep generated timing easy to inspect without duplicating the phrase.
    chunks=[]
    for i in range(0,len(seq),6):
        chunks.append('  '+', '.join(f'[{n}, {ms}]' for n,ms in seq[i:i+6])+',')
    return '[\n'+'\n'.join(chunks)+'\n]'


def pixel_hands(source):
    # The shared hand SVG is drawn entirely with horizontal/vertical pixel steps.
    # Sample the interior of each pixel so adjacent SVG edges stay square.
    symbols = ElementTree.parse(source).findall('{*}symbol')
    hands = {}
    for symbol in symbols:
        image = Image.new('RGBA', (68, 44))
        draw = ImageDraw.Draw(image)
        for path in symbol.findall('{*}path'):
            points = []
            for command, coords in re.findall(r'([MHVZ])([^MHVZ]*)',path.attrib['d']):
                values = [int(n) for n in re.findall(r'-?\d+', coords)]
                if command == 'M':
                    points = [tuple(values)]
                elif command == 'H':
                    points.append((values[0],points[-1][1]))
                elif command == 'V':
                    points.append((points[-1][0],values[0]))
                else:
                    draw.polygon([(x*2,y*2) for x,y in points],fill=path.attrib['fill'])
        hands[symbol.attrib['id']] = image.resize((19,12),Image.Resampling.NEAREST)
    return hands


def save_petting(out):
    hands = pixel_hands(Path(__file__).resolve().parents[1] / 'public/art/player/petting-hand.svg')
    sheet = Image.new('RGBA', (FRAME[0]*len(pet_cells), FRAME[1]))
    for index,(pose,gesture,x,y) in enumerate(pet_cells):
        frame = paint(pose)
        if gesture:
            frame.alpha_composite(hands[gesture],(x,y))
        sheet.paste(frame,(index*FRAME[0],0))
        if index == 3:
            frame.save(out/'ritual-cat-pet-still.webp','WEBP',lossless=True,method=6,exact=True)
    sheet.save(out/'ritual-cat-pet.webp','WEBP',lossless=True,method=6,exact=True)


def save(root):
    dist = root/'src'/'game'
    out = root/'public/art/pixel'
    out.mkdir(parents=True,exist_ok=True)
    frames,numbers=[],{}
    intro=sequence(intro_keys,frames,numbers)
    phrases=[sequence(keys,frames,numbers) for keys in (opening_keys,turn_keys,travel_keys)]
    finale=sequence(finale_keys,frames,numbers)
    outro=sequence(outro_keys,frames,numbers)
    assert sum(ms for _,ms in intro)==INTRO_MS and sum(ms for _,ms in outro)==OUTRO_MS
    assert all(sum(ms for _,ms in phrase)==PHRASE_MS for phrase in phrases)
    assert sum(ms for _,ms in finale)==FINALE_MS
    assert intro_keys[0][1]==outro_keys[-1][1]==SEATED
    rows=(len(frames)+COLUMNS-1)//COLUMNS
    atlas=Image.new('RGBA',(FRAME[0]*COLUMNS,FRAME[1]*rows))
    for i,frame in enumerate(frames):
        x,y,r,b=frame.getbbox()
        assert x>0 and y>0 and r<FRAME[0] and b<FRAME[1], (i,frame.getbbox())
        atlas.paste(frame,(i%COLUMNS*FRAME[0],i//COLUMNS*FRAME[1]))
    atlas.save(out/'ritual-cat-atlas.webp','WEBP',lossless=True,quality=100,method=6,exact=True)
    frames[intro[0][0]].save(out/'ritual-cat-idle.webp','WEBP',lossless=True,method=6,exact=True)
    save_petting(out)
    data=f"""// Native pixel frames painted by scripts/draw_ritual_cat.py.
export const RITUAL_SPRITE = Object.freeze({{ width: {FRAME[0]}, height: {FRAME[1]}, columns: {COLUMNS}, feetX: {FLOOR[0]}, feetY: {FLOOR[1]} }});

export const RITUAL_INTRO = {timeline_literal(intro)};
export const RITUAL_PHRASE = {timeline_literal(phrases[0])};
const turn = {timeline_literal(phrases[1])};
const travel = {timeline_literal(phrases[2])};
export const RITUAL_PHRASES = [RITUAL_PHRASE, turn, travel];

export const RITUAL_FINALE = {timeline_literal(finale)};
export const RITUAL_OUTRO = {timeline_literal(outro)};

export const RITUAL_TIMELINE = [...RITUAL_INTRO, ...RITUAL_PHRASES.flat(), ...RITUAL_FINALE, ...RITUAL_OUTRO];

const duration = timeline => timeline.reduce((sum, [, ms]) => sum + ms, 0);
export const ritualPreludeMs = {PRELUDE_MS};
export const ritualPetMs = {PET_MS};
export const ritualIntroMs = duration(RITUAL_INTRO);
export const ritualWoodKnockMs = {WOOD_KNOCK_MS};
export const ritualTakeoffMs = {PUSH_OFF_MS};
export const ritualFinaleStartMs = RITUAL_PHRASES.reduce((sum, phrase) => sum + duration(phrase), ritualIntroMs);
export const ritualFinalHitMs = ritualFinaleStartMs + {HIT_MS};
export const ritualOutroStartMs = ritualFinaleStartMs + duration(RITUAL_FINALE);
export const ritualDanceMs = duration(RITUAL_TIMELINE);
"""
    (dist/'ritual-choreography.mjs').write_text(data)
    return frames,intro,phrases,finale,outro


if __name__=='__main__':
    save(Path(__file__).resolve().parents[1])
