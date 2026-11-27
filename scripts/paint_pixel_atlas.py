"""Paint one limited-palette terrain tile with landmarks in its relief."""

import numpy as np
from PIL import Image, ImageColor, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter


PIXELS_PER_UNIT = 2
BIOMES = (
    ('온대', '#a4b475'), ('열대림', '#60936e'), ('초원', '#b6aa70'),
    ('사막', '#d8b780'), ('침엽수림', '#799e86'), ('툰드라', '#adc5b1'),
    ('설원', '#d9dfc6'), ('고산', '#9c9382'),
)


def pixel_coverage(geometry, polygons, top, bottom):
    size = (360 * PIXELS_PER_UNIT, (bottom - top) * PIXELS_PER_UNIT)
    scale = 3 * PIXELS_PER_UNIT
    mask = Image.new('L', (size[0] * 3, size[1] * 3))
    draw = ImageDraw.Draw(mask)
    for polygon in polygons(geometry):
        for index, ring in enumerate(polygon):
            draw.polygon([(x * scale, (y - top) * scale) for x, y in ring], fill=255 if index == 0 else 0)
    return np.asarray(mask.resize(size, Image.Resampling.BOX))


def pixel_territory_paths(territories, land, polygons, top, bottom):
    # Assign each visible land cell to the country covering most of it.
    # This uses the same grid and sampling as the coast, with no shared or ocean cells.
    coverage = np.stack([pixel_coverage(shape, polygons, top, bottom) for shape in territories.values()])
    if np.any(land & (coverage.max(axis=0) == 0)):
        raise ValueError('Atlas territory masks leave land pixels unassigned')
    owners = coverage.argmax(axis=0)
    return {key: pixel_path(land & (owners == index), top) for index, key in enumerate(territories)}


def pixel_path(mask, top):
    # Consolidate vertically identical runs into rectangles to keep the SVG path compact.
    parts, active = [], {}
    for y, row in enumerate(np.vstack([mask, np.zeros(mask.shape[1], dtype=bool)])):
        bounds = np.flatnonzero(np.diff(row, prepend=False, append=False))
        runs = {tuple(pair) for pair in bounds.reshape(-1, 2)}
        for (left, right), start in active.items():
            if (left, right) not in runs:
                x = left / PIXELS_PER_UNIT
                width = (right - left) / PIXELS_PER_UNIT
                height = (y - start) / PIXELS_PER_UNIT
                parts.append(f'M{x:g} {top + start / PIXELS_PER_UNIT:g}h{width:g}v{height:g}H{x:g}Z')
        active = {run: active.get(run, y) for run in sorted(runs)}
    return ''.join(parts)


def geography(top, bottom, projection):
    x, y = np.meshgrid(np.arange(360) + .5, np.arange(top, bottom) + .5)
    lon, lat = x - 180, np.clip((126 - y) / 1.23, -90, 90)
    # Invert the same shallow geographic warp used by the country outlines.
    for _ in range(7):
        px, py = projection(lon, lat)
        lon += x - px
        lat = np.clip(lat + (py - y) / 1.23, -90, 90)
    return lon, lat


def patches(lon, lat, regions):
    field = np.zeros(lon.shape)
    for x, y, wide, tall, turn in regions:
        dx, dy = (lon - x + 180) % 360 - 180, lat - y
        u, v = dx + turn * dy, dy - turn * dx
        field = np.maximum(field, np.exp(-((u / wide) ** 2 + (v / tall) ** 2)))
    return field


def climate_colors(lon, lat):
    # Simplified biomes suggest the geography of the game, including inland rain shadows.
    noise = np.random.default_rng(716).standard_normal(lon.shape)
    large = gaussian_filter(noise, 5, mode=('nearest', 'wrap')) * 12
    small = gaussian_filter(noise, 1.30, mode=('nearest', 'wrap')) * 3.1
    dry = patches(lon, lat, [
        (12, 25, 37, 9.8, 0), (50, 26, 20, 8.5, .08), (63, 39, 18, 6, -.06),
        (105, 43, 20, 6.3, -.13), (134, -25, 21, 9.1, -.08), (16, -24, 12, 8, .08),
        (-111, 30, 10, 8, -.23), (-70, -23, 3.4, 12, -.08),
    ])
    rain = patches(lon, lat, [
        (-62, -5, 29, 12, -.08), (22, -1, 22, 9, -.08),
        (108, 9, 34, 18, -.16), (147, -6, 23, 11, -.12),
    ])
    ranges = patches(lon, lat, [
        (-117, 49, 5.7, 19, .40), (-107, 38, 7.1, 12, .18), (-71, -13, 4.1, 19, -.23),
        (-69, -33, 3.6, 18, -.07), (10, 46, 10, 2.7, -.08), (-6, 32, 10, 3.5, .1),
        (35, -4, 5.4, 12, -.09), (87, 32, 19, 5.6, .03), (73, 38, 13, 5.2, -.19),
        (99, 30, 9, 4.5, -.3), (159, 60, 10, 5, -.25), (170, -43, 5, 2.8, .42),
    ])
    climate = np.zeros(lon.shape, dtype=np.uint8)
    heat = np.abs(lat + large * 4)
    climate[(heat < 35) & ((rain < .40) | (dry > .25))] = 2
    climate[(heat < 31) & (rain + large * .05 > .36)] = 1
    climate[dry + large * .07 > .55] = 3
    climate[(lat + large * 4 > 52) & ((lon > 25) | (lon < -58))] = 4
    climate[(lat + large * 3 > 65) | (lat < -50)] = 5
    climate[(lat + large * 2 > 74) | ((lon > -63) & (lon < -18) & (lat > 64))] = 6
    climate[(ranges + small * .10 > .57) & (climate != 6)] = 7
    snow = ranges + small * .13 > np.clip(.94 - ((heat - 30) / 135), .66, .96)
    climate[snow & ((heat > 25) | ((lon < -60) & (lon > -80)))] = 6
    palette = np.asarray([ImageColor.getrgb(color) for _, color in BIOMES], dtype=np.int16)
    shade = np.digitize(.61 * large + .39 * small, [-.29, .36])
    tint = np.asarray([[-10, -12, -7], [0, 0, 0], [9, 7, 4]])
    return palette[climate] + tint[shade], climate


def paint_texture(image, climate, land):
    draw = ImageDraw.Draw(image)
    rng = np.random.default_rng(1125)
    motifs = {
        1: ((0, 1), (1, 0), (1, 1), (1, 2), (2, 1)),
        3: ((0, 1), (1, 0), (2, 0)),
        4: ((0, 2), (1, 1), (1, 0), (1, 2), (2, 2)),
        6: ((0, 1), (1, 1), (2, 0)),
        7: ((0, 2), (1, 1), (2, 0), (3, 1)),
    }
    height, width = land.shape
    for row in range(4, height - 4, 11):
        for col in range(4, width - 4, 11):
            y, x = row + rng.integers(-3, 4), col + rng.integers(-3, 4)
            biome = climate[y // PIXELS_PER_UNIT, x // PIXELS_PER_UNIT]
            odds = .57 if biome in (1, 4, 7) else .34
            if biome not in motifs or rng.random() > odds or not land[y:y+4, x:x+4].all():
                continue
            shade = tuple(int(channel * .84) for channel in image.getpixel((x, y)))
            draw.point([(x + dx, y + dy) for dx, dy in motifs[biome]], fill=shade)


def paint_terrain(directory, land, borders, lines, projection, top, bottom):
    h, w = land.shape
    wrapped = np.tile(land, (1, 3))
    shore = distance_transform_edt(~wrapped)[:, w:-w] / PIXELS_PER_UNIT
    inland = distance_transform_edt(wrapped)[:, w:-w] / PIXELS_PER_UNIT
    ocean_palette = np.asarray([(66, 108, 99), (49, 87, 86), (38, 72, 76), (31, 61, 67), (27, 53, 59)])
    image = ocean_palette[np.digitize(shore, [1.2, 3.8, 10, 48])]
    # One clean coastal pixel connects the shallows and terrain, including across the seam.
    climate, biome = climate_colors(*geography(top, bottom, projection))
    land_colors = np.repeat(np.repeat(climate, PIXELS_PER_UNIT, axis=0), PIXELS_PER_UNIT, axis=1)
    image[land] = land_colors[land]
    coast = land & (inland <= 1 / PIXELS_PER_UNIT)
    image[coast] = (image[coast] * .82 + np.array([115, 154, 111]) * .18).astype(np.uint8)
    surface = Image.fromarray(image.astype(np.uint8))
    paint_texture(surface, biome, land)
    paint_landmark_relief(surface, land, projection, top)

    marks = ImageDraw.Draw(surface)
    for row in range(55, h - 7, 28):
        for col in range(22, w - 8, 37):
            x, y = col + (row * 3 + col) % 11, row + (col + row) % 7
            if not land[y, x:x+5].any() and shore[y, x] > 3.8:
                shade = tuple(channel + 7 for channel in surface.getpixel((x, y)))
                marks.line((x, y, x + 2, y), fill=shade)
                marks.point((x + 4, y - 1), fill=shade)

    stencil = Image.new('1', (w, h))
    draw = ImageDraw.Draw(stencil)
    for line in lines(borders):
        draw.line([(round(x * PIXELS_PER_UNIT - .5), round((y - top) * PIXELS_PER_UNIT - .5)) for x, y in line], fill=1)
    boundaries = np.asarray(stencil) & land
    image = np.asarray(surface).copy()
    image[boundaries] = (image[boundaries] * .48 + np.array([43, 61, 51]) * .52).astype(np.uint8)
    Image.fromarray(image).save(directory / 'atlas-terrain.webp', lossless=True, method=6)


# Relief colors are offsets from the existing sand, rock or vegetation at each pixel.
RELIEF_SHADES = {
    '+': (13, 11, 8),
    '=': (5, 4, 2),
    '-': (-17, -15, -10),
}
SNOW_PEAK = (
    '...+...', '..++=..', '..+==-.', '.++==-.', '.+=---.', '=-----.',
)
LANDMARK_RELIEF = (
    # Torch on the eastern shore and strata in the western canyon.
    (-75.4, 41.1, ('..+..', '..=..', '..=-.', '..==.', '.+==-', '.===-', '----.')),
    (-112.1, 36.2, ('..++..+...', '.++===++..', '+===--==-', '.=---=-..-', '..-----...')),
    # Andean terraces and a forest lookout in the eastern basin.
    (-72.54, -13.16, ('......+..', '....++=-.', '..++==--.', '.+==--...', '+==--....', '----.....')),
    (-59.94, -3.12, ('...+...', '..++=..', '.+==--.', '..+=-..', '..=.-..', '.=..-..')),
    # Rock circle and a narrow iron tower in Europe.
    (-2, 52.1, ('..+=....', '.+-..+=.', '.=-..=-.', '..=---..')),
    (2.29, 48.86, ('...+...', '...=...', '...=...', '..+=-..', '..+.-..', '.==.--.')),
    # A reclining cat sphinx with two ears and an extended forepaw in the western desert.
    (27.8, 28.5, ('...+.+......', '...++=......', '..++==-.....', '...++=-.....',
                   '...+==+==...', '.+++======-.', '.==--------.', '..--.....--.')),
    (37.35, -3.07, SNOW_PEAK),
    (86.93, 27.99, SNOW_PEAK),
    # The wall follows the northern ridgeline. The temple and peak are short inland strokes.
    (116.56, 40.43, ('...+..+.+..', '...+=.+=-..', '..+==+=-...', '.+==---....', '=---.......')),
    (127.18, 40.04, ('..++..', '.++=-.', '++===-', '.+=-..', '.---..')),
    (138.73, 35.36, SNOW_PEAK),
    # A low sandstone formation and the outline of the coastal shell roofs.
    (131.04, -25.34, ('...+++....', '..++===-..', '.+===----.', '==-----...')),
    (150.8, -33.8, ('..+.+...', '..+=+=..', '.+=+===.', '.==-=--.')),
)


def paint_landmark_relief(image, land, projection, top):
    height, width = land.shape
    pixels = image.load()
    for lon, lat, rows in LANDMARK_RELIEF:
        x, y = projection(lon, lat)
        left = round(x * PIXELS_PER_UNIT) - max(map(len, rows)) // 2
        top_row = round((y - top) * PIXELS_PER_UNIT) - len(rows) // 2
        for dy, row in enumerate(rows):
            py = top_row + dy
            if not 0 <= py < height:
                continue
            for dx, cell in enumerate(row):
                px = (left + dx) % width
                if cell in RELIEF_SHADES and land[py, px]:
                    shade = RELIEF_SHADES[cell]
                    pixels[px, py] = tuple(max(0, min(255, channel + shift))
                                           for channel, shift in zip(pixels[px, py], shade))
