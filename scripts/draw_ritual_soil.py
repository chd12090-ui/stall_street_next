"""Paint two small bones in a single clay colour on the earthen altar."""

from pathlib import Path

from PIL import Image


ART = Path(__file__).resolve().parents[1] / 'public/art/pixel'
CLAY = (97, 82, 68, 255)

# A long bone with two knobs at each end, and a little forked wishbone.
LONG_BONE = (
    '                         ',
    '                 ##      ',
    '                ####     ',
    '    ##          ####     ',
    '   ####        ####      ',
    '   ####    ########      ',
    '    ########### ####     ',
    '    #######      ##      ',
    '   ####                  ',
    '    ##                   ',
    '                         ',
    '                         ',
)

WISHBONE = (
    '                   ',
    '    ##      ##     ',
    '    ##      ##     ',
    '    ###    ###     ',
    '     ###  ###      ',
    '      ######       ',
    '        ###        ',
    '         ##        ',
    '                   ',
    '                   ',
)


def write_bone(name, pattern):
    sprite = Image.new('RGBA', (len(pattern[0]), len(pattern)))
    for y, row in enumerate(pattern):
        for x, pixel in enumerate(row):
            if pixel == '#':
                sprite.putpixel((x, y), CLAY)
    sprite.save(ART / f'ritual-soil-{name}.webp', lossless=True, method=6)


if __name__ == '__main__':
    write_bone('long-bone', LONG_BONE)
    write_bone('ribs', WISHBONE)
