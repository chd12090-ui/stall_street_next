"""Draw exchange tiles on the same coarse grid as the in-game coin."""

from PIL import Image, ImageChops, ImageColor, ImageDraw


# An underlying has one paper/ink pair across its entire product family.
FUND_COLORS = {
    "HRIDX": ("#006653", "#EDFFF1"),
    "AMIDX": ("#F5DFC0", "#213653"),
    "BMEM": ("#BCD5E1", "#172B3D"),
    "ARC": ("#E8E7FA", "#43399A"),
    "HZMA": ("#303436", "#EBEDE6"),
    # Older products can still be reached from a saved portfolio.
    "MOON/MART/RAIL/VOLT": ("#CAD8B4", "#34492D"),
    "ARC/NOVA": ("#526680", "#F1F6FB"),
    "BIT": ("#E9B451", "#56351F"),
    "ETH": ("#B3ACDD", "#302B52"),
    "ANDB/PAMP/ORK": ("#F0C6AF", "#673D36"),
    "NILD/NGNT/ATLS/KGEO": ("#D4C486", "#3D4329"),
    "CLIDX": ("#984354", "#FFF2D9"),
    "NHIDX": ("#D6DFEF", "#354569"),
}

# At 32 CSS pixels the syllables keep their full strokes. Every multiplier
# character shares the same five-by-six grid and single-cell stroke width.
GLYPHS = {
    "인": ("0111001", "1000101", "1000101", "0111001", "0000001", "0100000", "0100000", "0111111"),
    "버": ("1001001", "1001001", "1001001", "1111011", "1001001", "1001001", "1111001", "0000001"),
    "스": ("0001000", "0001000", "0010100", "0100010", "1000001", "0000000", "0000000", "1111111"),
    "1": ("00100", "01100", "10100", "00100", "00100", "11111"),
    "2": ("01110", "10001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "01110", "00001", "10001", "01110"),
    "X": ("10001", "01010", "00100", "00100", "01010", "10001"),
}

# These marks have lettering, overlapping limbs or fine negative spaces that
# need different strokes when drawn at coin scale. Dots are the tile paper.
SMALL_MARKS = {
    "moon": (
        "...11..1.....", "....111.11...", "..11..11111..", "...1111111.1.",
        ".111111111111", "11..1111111..", "....11111.11.", "..11111...111",
        ".111..11.....", "11...........",
    ),
    "mart": (
        "....11111....", "...11...11...", "..11.....11..", "..1.......1..",
        "1111111111111", "1111111111111", ".1221.121.21.", ".11221212211.",
        "..11.1221.1..", "..1221.1211..", "...1111111...",
    ),
    "rail": (
        ".........1111", ".......111111", "......111....", "1111.111.....",
        "1111111......", "....111..1111", "...111..11111", "11111........",
        "1111.........",
    ),
    "volt": (
        "....1111.1...", "..11111..11..", ".11111..1111.", ".1111..11111.",
        "1111..1111111", "1111.....1111", "111111..11111", ".1111..11111.",
        ".111..111111.", "..11.111111..", "....11111....",
    ),
    "dhcp": (
        "........111..", ".......1...11", ".......11....", "........11...",
        "......11.1...", "1...11111....", ".1111111.....", "...1111....22",
        ".22.....222..", "...222222....",
    ),
    "harb": (
        "..........1.1", ".........1111", ".111111...11.", "11111111.11..",
        "11111111111..", ".....1111.11.", ".1111111...11", "..1111.......",
    ),
    "flfx": (
        "..........1..", "..1......11.1", "1..11...11111", ".1111111111.1",
        "...1111111111", "111111111111.", ".111111111...", "....1111.1...",
        "...11...11...", "..11.........", ".11..........",
    ),
}


def tile_mask(size):
    mask = Image.new("L", (16, 16))
    draw = ImageDraw.Draw(mask)
    for y in range(16):
        edge = min(y, 15 - y)
        inset = max(0, 2 - edge)
        draw.line((inset, y, 15 - inset, y), fill=255)
    return mask.resize((size, size), Image.Resampling.NEAREST)


def centered_text(image, text, y, scale, ink):
    glyphs = [GLYPHS[c] for c in text]
    width = sum(len(g[0]) + 1 for g in glyphs) - 1
    x = (image.width - width * scale) // 2
    draw = ImageDraw.Draw(image)
    for glyph in glyphs:
        for row, line in enumerate(glyph):
            for col, bit in enumerate(line):
                if bit == "1":
                    left, top = x + col * scale, y + row * scale
                    draw.rectangle((left, top, left + scale - 1, top + scale - 1), fill=ink)
        x += (len(glyph[0]) + 1) * scale


def fund_badge(family, factor):
    field, ink = FUND_COLORS[family]
    badge = Image.new("RGB", (32, 32), field)
    lines = [("인버스", 1)] if factor < 0 else []
    lines.append((f"{abs(factor)}X", 2))
    gap = 1
    heights = [len(GLYPHS[text[0]]) * scale for text, scale in lines]
    block_height = sum(heights) + gap * (len(lines) - 1)
    y = (badge.height - block_height) // 2
    for (text, scale), height in zip(lines, heights):
        centered_text(badge, text, y, scale, ink)
        y += height + gap
    badge.putalpha(tile_mask(32))
    return badge


def stock_badge(issuer, master, colors):
    """Fit just the ink to a 13-pixel square and snap it to the issuer's inks."""
    swatches = [ImageColor.getrgb(color) for color in colors]
    field = swatches[0]
    if issuer in SMALL_MARKS:
        rows = SMALL_MARKS[issuer]
        ink = Image.new("RGB", (len(rows[0]), len(rows)), field)
        for y, row in enumerate(rows):
            for x, color in enumerate(row):
                if color != ".":
                    ink.putpixel((x, y), swatches[int(color)])
    else:
        master = master.convert("RGB")
        blank = Image.new("RGB", master.size, field)
        bounds = ImageChops.difference(master, blank).getbbox()
        ink = master.crop(bounds)
        ink.thumbnail((13, 13), Image.Resampling.BOX)
        palette = Image.new("P", (1, 1))
        palette.putpalette([channel for color in swatches for channel in color]
                           + list(field) * (256 - len(swatches)))
        ink = ink.quantize(palette=palette, dither=Image.Dither.NONE).convert("RGB")
    mask = ImageChops.difference(ink, Image.new("RGB", ink.size, field))
    ink = ink.crop(mask.getbbox())
    # Keep the 16px artwork grid, but place it on a doubled canvas so an odd
    # ink width or height can be centred without rounding toward the top left.
    ink = ink.resize((ink.width * 2, ink.height * 2), Image.Resampling.NEAREST)
    badge = Image.new("RGB", (32, 32), field)
    badge.paste(ink, ((32 - ink.width) // 2, (32 - ink.height) // 2))
    badge.putalpha(tile_mask(32))
    return badge
