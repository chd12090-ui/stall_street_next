"""Paint rooms on a fixed pixel grid with small, independent idle poses."""

from PIL import Image, ImageDraw

SIZE = (108, 192)
PAPER = '#f5ead4'
ROOM_COLORS = {
    'morning': '#e0af67',
    'office': '#739fc0',
    'pub': '#784162',
    'bed': '#3c3768',
    'bank': '#b7b49c',
}


def box(draw, coords, color):
    draw.rectangle(coords, fill=color)


def slab(draw, points, color):
    draw.polygon(points, fill=color)


def stroke(draw, points, color, width=1):
    draw.line(points, fill=color, width=width)


def ceramic(draw, side, top=PAPER):
    slab(draw, [(0,116),(18,116),(16,122),(15,143),(0,143)],side)
    slab(draw, [(0,112),(19,112),(19,116),(15,120),(0,120)],top)
    box(draw,(0,117,15,120),'#bbc9c8')
    box(draw,(1,113,13,114),'#7a949d')
    stroke(draw,[(6,111),(6,105),(10,105),(10,108)],'#aec7cd',2)
    box(draw,(14,107,16,112),'#cd946c')


def room_door(draw, left, top, right, panel, trim, handle='#b7b9a4'):
    box(draw,(left,top,right,172),trim)
    box(draw,(left+3,top+3,right-3,170),panel)
    x = right-9
    box(draw,(x-3,100,x+3,107),handle)
    box(draw,(x-10,101,x+1,103),PAPER)


def office(draw, pose):
    box(draw,(0,0,107,30),'#9cbfd5')
    room_door(draw,10,29,82,'#487aaa','#75a7c5')
    box(draw,(0,29,9,167),'#6b96b9')
    box(draw,(10,33,12,167),'#568bb2')
    slab(draw,[(20,13),(84,13),(84,15),(87,15),(85,20),(82,22),
               (24,22),(24,20),(20,20)],PAPER)
    box(draw,(24,22,82,24),'#a9c5d9')
    box(draw,(84,100,107,162),'#b3d5e0')
    for y,join in ((117,95),(133,99),(147,94)):
        stroke(draw,[(84,y),(107,y)],'#89b3c8')
        stroke(draw,[(join,y-13),(join,y)],'#89b3c8')
    slab(draw,[(91,90),(106,90),(107,92),(107,109),(93,109),(93,105),(89,105),
               (89,94),(91,94)],PAPER)
    box(draw,(93,100,107,103),'#89b2cd')
    box(draw,(97,104,107,113),'#c3dae4')
    box(draw,(0,54,8,94),'#81aac6')
    box(draw,(0,58,5,90),'#a0c0d5')
    box(draw,(47,81,52,86),'#416b93')
    box(draw,(48,82,50,84),('#bf9188','#d29c8d','#dfa78d')[pose])
    box(draw,(96,119,98,119),('#bed9e2','#c6dee6','#cbe3e9')[pose])
    stroke(draw,[(30,59),(34,59),(36,57)],'#6092bc')
    stroke(draw,[(64,118),(66,118),(66,124)],'#5b8eb9')
    box(draw,(0,163,107,191),'#688db4')
    ceramic(draw,'#7cacc8')


def morning(draw, pose):
    box(draw,(0,0,107,29),'#eec88b')
    room_door(draw,27,29,105,'#72a85e','#92bc7a')
    box(draw,(31,32,34,156),'#80b471')
    box(draw,(0,18,27,63),'#eec280')
    box(draw,(0,22,23,56),'#a1d4d1')
    cloud = [(3,36),(8,36),(8,33),(12,33),(12,35),(17,35),(17,37),
             (21,37),(21,39),(3,39)]
    slab(draw,[(x+(pose>0),y) for x,y in cloud],('#f5e8ca','#f5e8ca','#f8edd2')[pose])
    box(draw,(8,22,9,56),'#eaddaa')
    box(draw,(0,57,27,60),PAPER)
    slab(draw,[(49,46),(79,46),(79,48),(82,48),(82,59),(48,59),(48,53)],'#e4ad67')
    box(draw,(51,50,53,51),'#ac8360')
    box(draw,(73,55,78,56),'#ac8360')
    stroke(draw,[(36,42),(36,46),(34,46),(34,51)],'#b4bc7d')
    stroke(draw,[(68,69),(67,75),(64,75)],'#8fbd76')
    box(draw,(0,167,107,191),'#ba916c')
    ceramic(draw,'#92b67f')


def pub(draw, pose):
    box(draw,(0,0,107,32),'#925276')
    room_door(draw,18,31,113,'#784566','#a15c81')
    for x,end in ((24,141),(42,169),(66,157),(87,172),(101,150)):
        stroke(draw,[(x,34),(x,83),(x+1,83),(x+1,end)],'#895073')
    box(draw,(0,48,12,81),'#c9819c')
    box(draw,(0,51,9,77),'#a767a4')
    stroke(draw,[(85,0),(85,11),(86,18)],'#b084b7',2)
    slab(draw,[(79,17),(91,17),(91,20),(95,20),(95,22),(97,22),
               (97,27),(74,27),(74,24),(77,24),(77,20)],'#b376a3')
    box(draw,(78,24,94,27),'#d494b5')
    box(draw,(82,28,91,31),'#f0b5c3')
    box(draw,(85,29,88,30),('#f3c0cd','#f6c6d2','#facdd6')[pose])
    box(draw,(91,66,107,79),'#976084')
    box(draw,(94,68,107,76),'#ae739e')
    box(draw,(98,71,104,72),('#c990b1','#d59abb','#dfa6c3')[pose])
    box(draw,(0,162,107,191),'#70445f')
    ceramic(draw,'#976187','#ecc7c8')


def bedroom(draw, pose):
    box(draw,(0,29,66,76),'#7c77b2')
    box(draw,(0,33,63,71),'#555a93')
    box(draw,(29,32,30,74),'#777db1')
    slab(draw,[(16,71),(16,63),(20,63),(20,61),(24,61),(24,71),
               (35,71),(35,60),(40,60),(40,63),(43,63),(43,71),
               (51,71),(51,62),(59,62),(59,72),(5,72),(5,67),(11,67),(11,71)],'#484f80')
    box(draw,(43,43,52,49),'#efdbfa')
    box(draw,(45,41,50,51),'#efdbfa')
    for x,y in ((7,44),(35,39),(57,55)):
        box(draw,(x,y,x+1,y+1),'#c4c5ea')
    box(draw,(20,56,21,57),('#a8abd8','#b8bce7','#c7c9ee')[pose])
    box(draw,(0,74,67,77),'#9d90c3')
    box(draw,(76,104,107,155),'#7f6398')
    box(draw,(76,106,107,110),'#987aaf')
    for y in (120,136,147):
        stroke(draw,[(76,y),(107,y)],'#6c588a')
        box(draw,(94,y-7,101,y-6),'#bb9ac5')
    slab(draw,[(89,70),(98,70),(98,73),(101,73),(101,79),(104,79),
               (104,87),(85,87),(85,83),(87,83),(87,75),(89,75)], '#a28ac7')
    box(draw,(93,88,95,102),'#bfa1cc')
    box(draw,(89,102,99,104),'#a28ac7')
    slab(draw,[(0,150),(24,150),(24,147),(42,147),(46,151),(76,151),
               (76,155),(107,155),(107,191),(0,191)], '#665e9b')
    stroke(draw,[(0,154),(21,154),(24,153),(39,153)],'#8779b3')
    stroke(draw,[(62,154),(75,154),(76,158),(106,158)],'#8779b3')


def handheld(draw, world, pose):
    sleeve = {'office':'#a0c2e4','morning':'#c6d797','pub':'#b482aa','bed':'#978ec8'}[world]
    slab(draw,[(0,179),(8,179),(14,174),(22,172),(33,179),(33,185),
               (39,189),(39,191),(0,191)],sleeve)
    slab(draw,[(107,179),(100,179),(94,174),(88,172),(78,179),(78,185),
               (73,189),(73,191),(107,191)],sleeve)
    slab(draw,[(39,116),(69,116),(69,118),(74,118),(74,121),(76,121),(76,181),
               (73,181),(73,186),(38,186),(38,183),(35,183),(35,120),(39,120)],'#415875')
    box(draw,(39,122,72,177),'#263e54')
    box(draw,(48,181,62,182),'#8fa5bb')
    box(draw,(42,127,55,128),'#80aebd')
    box(draw,(64,127,66,128),('#709785','#83ac93','#8fbb9b')[pose])
    for y in (137,148,159,168):
        stroke(draw,[(41,y),(70,y)],'#476783')
    for x,y,rise in ((43,158,1),(47,155,1),(51,157,0),(55,152,1),(59,148,1),(63,151,0),(67,143,1),(70,141,1)):
        fill = '#97cf82' if rise else '#df9b8a'
        stroke(draw,[(x,y-2),(x,y+4)],fill)
        box(draw,(x-1,y,x+1,y+2),fill)
    fur = '#f1bc83' if world != 'bed' else '#d5a6a4'
    pad = '#c58680' if world != 'bed' else '#bc7e91'
    shape = [(15,174),(15,166),(19,163),(19,151),(23,151),(23,146),(27,146),
             (27,142),(32,142),(32,139),(37,139),(37,143),(41,143),(41,148),
             (43,148),(43,155),(38,155),(38,163),(34,163),(34,169),(29,169),
             (29,176),(21,179),(19,176)]
    for mirrored in (False,True):
        x = (lambda n:109-n) if mirrored else (lambda n:n)
        slab(draw,[(x(px),py) for px,py in shape],fur)
        for px,y in ((25,154),(30,150),(35,147)):
            box(draw,(min(x(px),x(px+2)),y,max(x(px),x(px+2)),y+2),pad)
        slab(draw,[(x(px),py) for px,py in ((25,161),(29,160),(33,160),(33,163),
                   (30,166),(25,166))],pad)


SIGN_GLYPHS = {
    'B': ('1110', '1001', '1110', '1001', '1001', '1110'),
    'A': ('0110', '1001', '1001', '1111', '1001', '1001'),
    'N': ('1001', '1101', '1101', '1011', '1011', '1001'),
    'K': ('1001', '1010', '1100', '1010', '1001', '1001'),
    '1': ('010', '110', '010', '010', '010', '111'),
    '2': ('110', '001', '001', '010', '100', '111'),
    '3': ('110', '001', '010', '001', '001', '110'),
}


def pixel_sign(draw, text, x, y, color):
    for char in text:
        rows = SIGN_GLYPHS[char]
        for dy, row in enumerate(rows):
            for dx, dot in enumerate(row):
                if dot == '1':
                    draw.point((x + dx, y + dy), fill=color)
        x += len(rows[0]) + 2


def clerk(draw, pose):
    slab(draw, [(35, 117), (35, 111), (40, 111), (40, 107), (65, 107),
                (65, 111), (70, 111), (70, 124), (35, 124)], '#526e65')
    slab(draw, [(47, 107), (59, 107), (59, 111), (55, 117), (52, 117),
                (47, 111)], '#e4e2ca')
    box(draw, (52, 111, 54, 121), '#9a695f')
    box(draw, (60, 115, 65, 116), '#dbca97')
    slab(draw, [(37, 99), (37, 87), (39, 87), (39, 77), (43, 77),
                (43, 80), (47, 80), (47, 83), (61, 83), (61, 80),
                (65, 80), (65, 78), (68, 78), (68, 86), (71, 86),
                (71, 98), (68, 98), (68, 104), (64, 104), (64, 108),
                (43, 108), (43, 105), (39, 105), (39, 101), (37, 101)], '#474d48')
    box(draw, (40, 80, 42, 85), '#6c615a')
    box(draw, (65, 81, 67, 86), '#6c615a')
    slab(draw, [(65, 88), (71, 88), (71, 98), (68, 98), (68, 104),
                (64, 104), (64, 108), (62, 108), (62, 102), (65, 102)], '#3a423f')
    slab(draw, [(51, 95), (55, 95), (55, 97), (59, 97), (59, 99),
                (62, 99), (62, 104), (59, 104), (59, 108), (48, 108),
                (48, 104), (45, 104), (45, 99), (48, 99), (48, 97),
                (51, 97)], '#ebe5cc')
    box(draw, (48, 105, 59, 108), '#c6cbb3')
    for eye, (x, y) in enumerate(((45, 92), (60, 93))):
        closed = pose == 2 or (pose == 1 and eye == 0)
        box(draw, (x, y + int(closed), x + 1 + int(closed), y + 1), '#ceba83')
    box(draw, (52, 98, 55, 100), '#ab6d5a')
    box(draw, (53, 101, 54, 103), '#6f5550')
    box(draw, (51, 103, 56, 103), '#6f5550')


def teller(draw, pose):
    green, brass, stone = '#395d54', '#c2a16a', '#d1ccac'
    box(draw, (0, 0, 107, 22), '#959b84')
    box(draw, (0, 19, 107, 22), '#8a927c')
    box(draw, (0, 42, 107, 46), '#a0a48d')
    box(draw, (23, 26, 85, 39), green)
    stroke(draw, [(23, 25), (85, 25)], brass)
    slab(draw, [(33, 28), (37, 28), (37, 30), (40, 30), (40, 35),
                (37, 35), (37, 37), (33, 37), (33, 35), (30, 35),
                (30, 30), (33, 30)], brass)
    box(draw, (34, 30, 35, 35), green)
    pixel_sign(draw, 'BANK', 46, 30, '#f0dfac')

    for number, (left, right) in enumerate(((8, 29), (33, 76), (80, 101)), 1):
        box(draw, (left, 62, right, 120), '#6e867b')
        box(draw, (left + 2, 64, right - 2, 116), '#97b0a3')
        box(draw, (left + 2, 66, right - 2, 67), '#c3cec0')
        x = (left + right) // 2
        box(draw, (x - 5, 51, x + 5, 60), green)
        pixel_sign(draw, str(number), x - 1, 53, '#f0dba0')

    # The side window faces the vault, the right window has a rate board.
    slab(draw, [(14, 77), (23, 77), (23, 80), (26, 80), (26, 104),
                (23, 104), (23, 108), (14, 108), (14, 104), (11, 104),
                (11, 81), (14, 81)], '#738e87')
    box(draw, (15, 84, 22, 101), '#91a8a0')
    box(draw, (17, 92, 21, 93), '#5b786e')
    box(draw, (19, 90, 20, 95), '#5b786e')
    box(draw, (83, 71, 98, 93), '#596f66')
    for y in (75, 81, 87):
        box(draw, (85, y, 91, y + 1), stone)
        box(draw, (94, y, 96, y + 1), brass)

    if pose is not None:
        clerk(draw, pose)
    bank_counter(draw)


def bank_counter(draw):
    green, brass, stone = '#395d54', '#c2a16a', '#d1ccac'
    box(draw, (66, 104, 78, 115), '#496159')
    box(draw, (67, 105, 76, 112), '#738e82')
    box(draw, (71, 115, 73, 119), '#4f695f')
    box(draw, (64, 118, 79, 119), '#637d70')
    box(draw, (9, 117, 100, 119), '#dad3b2')
    box(draw, (0, 121, 107, 147), green)
    box(draw, (0, 121, 107, 125), stone)
    box(draw, (0, 126, 107, 128), '#6a8373')
    box(draw, (0, 144, 107, 147), '#324e47')
    for x in (18, 53, 89):
        box(draw, (x - 13, 132, x + 13, 141), '#476d60')
        stroke(draw, [(x - 13, 132), (x + 13, 132)], '#58796a')
    box(draw, (40, 119, 60, 121), '#7d9987')
    box(draw, (44, 119, 54, 120), PAPER)

    box(draw, (0, 148, 107, 191), '#a2a48d')
    for y in (155, 170, 185):
        stroke(draw, [(0, y), (107, y)], '#8c917e')
        for x in (22, 54, 86):
            start = x + (12 if y == 170 else 0)
            stroke(draw, [(start, y), (start, min(y + 14, 191))], '#8c917e')
    box(draw, (25, 153, 84, 154), '#975c57')
    for x in (24, 83):
        box(draw, (x - 1, 151, x + 1, 166), brass)
        box(draw, (x - 3, 166, x + 3, 167), '#707b6a')


PAINTERS = {'morning':morning, 'office':office, 'pub':pub,
            'bed':bedroom, 'bank':teller}


def scene(name, pose=0):
    image = Image.new('RGB',SIZE,ROOM_COLORS[name])
    draw = ImageDraw.Draw(image)
    PAINTERS[name](draw,pose)
    if name in ('morning','office','pub','bed'):
        handheld(draw,name,pose)
    return image
