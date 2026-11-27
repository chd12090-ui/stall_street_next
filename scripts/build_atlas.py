#!/usr/bin/env python3
"""Build the fictional atlas from unsimplified Natural Earth 1:110m admin-0 GeoJSON."""
from argparse import ArgumentParser
from collections import defaultdict
import ctypes as c
import ctypes.util
import json
from math import dist
from pathlib import Path
import re

import numpy as np
from paint_pixel_atlas import BIOMES, PIXELS_PER_UNIT, paint_terrain, pixel_coverage, pixel_territory_paths

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT/'src'/'game'  # game modules (formerly dist/)
# Exactly one playable government owns every inhabited map polygon. These eight
# regional blocs are game territories, not claims about real-world membership.
TERRITORIES = {
    'mora': 'KOR',
    'haeon': 'JPN',
    'arden': 'USA PRI',
    'chai': 'CHN MNG TWN PRK RUS KAZ KGZ TJK UZB TKM',
    'vietlan': 'VNM MMR THA KHM LAO MYS BRN PHL IDN TLS IND BGD NPL BTN LKA',
    'lumen': 'GBR IRL ISL FRA BEL NLD LUX CHE ITA DEU CZE SVK POL AUT DNK NOR SWE FIN HUN SVN BIH HRV ALB MKD SRB MNE KOS GRC BGR ROU ESP PRT BLR UKR MDA LTU LVA EST',
    'misran': 'EGY ISR LBN PSX SYR JOR ARE QAT KWT IRQ OMN YEM SAU TUR GEO ARM AZE CYN CYP IRN AFG PAK',
    'kanora': 'CAN GRL MEX GTM BLZ HND SLV NIC CRI CUB BHS HTI DOM JAM TTO PAN',
    'brazin': 'BRA GUY SUR ARG PRY URY FLK CHL PER ECU BOL COL VEN',
    'azania': 'MAR SAH DZA MRT TUN SEN GMB LBY SDN SDS TCD NGA MLI BEN NER TGO GHA CIV GIN GNB LBR SLE BFA CMR CAF COG COD GAB GNQ KEN TZA RWA BDI SOM SOL ETH DJI ERI UGA MDG ZAF LSO NAM BWA ZWE SWZ ZMB MWI MOZ AGO',
    'austran': 'AUS ATF NZL PNG FJI VUT NCL SLB',
}
REGIONS = {
    'asia': [219,58,119,91],
    'europe': [148,27,92,69],
    'north': [24,17,121,108],
    'south': [100,113,64,83],
    'africa': [154,76,82,103],
    'oceania': [277,125,94,65],
}
MAP_TOP, MAP_BOTTOM = -9, 204
MAP_GRID = .001
SLIVER_AREA = .012


def bind(lib, name, *args, result=c.c_void_p):
    func = getattr(lib, name)
    func.argtypes = args
    func.restype = result
    return func


def dissolved_shapes(data):
    lib = c.CDLL(ctypes.util.find_library('geos_c'))
    bind(lib,'initGEOS',c.c_void_p,c.c_void_p,result=None)(None,None)
    reader = bind(lib,'GEOSGeoJSONReader_create')()
    writer = bind(lib,'GEOSGeoJSONWriter_create')()
    parse = bind(lib,'GEOSGeoJSONReader_readGeometry',c.c_void_p,c.c_char_p)
    export = bind(lib,'GEOSGeoJSONWriter_writeGeometry',c.c_void_p,c.c_void_p,c.c_int)
    free = bind(lib,'GEOSFree',c.c_void_p,result=None)
    destroy = bind(lib,'GEOSGeom_destroy',c.c_void_p,result=None)
    dissolve = bind(lib,'GEOSUnaryUnionPrec',c.c_void_p,c.c_double)
    precision = bind(lib,'GEOSGeom_setPrecision',c.c_void_p,c.c_double,c.c_int)
    boundary = bind(lib,'GEOSBoundary',c.c_void_p)
    difference = bind(lib,'GEOSDifferencePrec',c.c_void_p,c.c_void_p,c.c_double)
    validate = bind(lib,'GEOSMakeValid',c.c_void_p)
    coverage_valid = bind(lib,'GEOSCoverageIsValid',c.c_void_p,c.c_double,c.POINTER(c.c_void_p),result=c.c_int)
    coverage_union = bind(lib,'GEOSCoverageUnion',c.c_void_p)
    simplify = bind(lib,'GEOSCoverageSimplifyVW',c.c_void_p,c.c_double,c.c_int)
    line_merge = bind(lib,'GEOSLineMerge',c.c_void_p)
    shapes = []

    def keep(shape):
        if not shape:
            raise ValueError('Could not process atlas geometry')
        shapes.append(shape)
        return shape

    def read(geometry):
        return keep(parse(reader,json.dumps(geometry,separators=(',',':')).encode()))

    def collection(group):
        return read({'type':'GeometryCollection','geometries':group})

    def unpack(shape):
        output = export(writer,shape,0)
        out = json.loads(c.string_at(output))
        free(output)
        return out

    def merge(group, grid=MAP_GRID):
        joined = keep(dissolve(keep(validate(collection(group))),grid))
        return unpack(keep(precision(joined,grid,0))) if grid else unpack(joined)

    def coverage(territories):
        joined = collection(list(territories.values()))
        if coverage_valid(joined,0,None)!=1:
            raise ValueError('Atlas territories must share identical edges. Use unsimplified source polygons.')
        return joined

    try:
        # Align coincident source vertices before warping. Independently simplified polygons
        # leave diverging edges and small triangular ocean gaps behind the boundary.
        territories = {key:project_shape(merge(group)) for key,group in data.items()}
        draft = coverage(territories)
        earth = unpack(keep(coverage_union(draft)))
        for key,slivers in edge_slivers(territories,earth).items():
            territories[key] = merge([territories[key],*slivers],grid=0)

        # Use one topology-preserving simplification for all borders. Keep the outer shoreline
        # intact at the longitude seam so neighboring, repeated tiles still meet exactly.
        clean = keep(simplify(coverage(territories),.28,1))
        territories = dict(zip(territories,unpack(clean)['geometries']))
        globe = keep(coverage_union(coverage(territories)))
        coast = keep(boundary(globe))
        all_lines = collection([unpack(keep(boundary(read(shape)))) for shape in territories.values()])
        noded_lines = keep(dissolve(all_lines,0))
        borders = keep(line_merge(keep(difference(noded_lines,coast,0))))
        tile_edges = collection([{'type':'LineString','coordinates':[(x,MAP_TOP),(x,MAP_BOTTOM)]} for x in (0,360)])
        shore = keep(line_merge(keep(difference(coast,tile_edges,0))))
        return territories,unpack(globe),unpack(borders),unpack(shore)
    finally:
        for shape in reversed(shapes):
            destroy(shape)
        bind(lib,'GEOSGeoJSONReader_destroy',c.c_void_p,result=None)(reader)
        bind(lib,'GEOSGeoJSONWriter_destroy',c.c_void_p,result=None)(writer)
        bind(lib,'finishGEOS',result=None)()


def projection(lon,lat):
    # A continuous regional warp changes geographic silhouettes across the same shared lines.
    decay = np.sin(np.radians((lon+180)/2))**2
    central = np.sin(np.radians(lat))
    south_america = np.exp(-((lon+62)/40)**2-((lat+15)/38)**2)*decay
    africa = np.exp(-((lon-10)/38)**2-((lat-4)/39)**2)*decay
    x = lon+180+decay*(3.2*np.sin(np.radians(2.3*lon+lat))+2.0*central)-8*south_america+5*africa
    y = 126-lat-17*central+2.8*decay*np.cos(np.radians(lon*3-lat))*np.cos(np.radians(lat))
    return x,y


def polygons(geometry):
    if geometry['type']=='Polygon':
        yield geometry['coordinates']
    elif geometry['type']=='MultiPolygon':
        yield from geometry['coordinates']
    elif geometry['type']=='GeometryCollection':
        for member in geometry['geometries']:
            yield from polygons(member)


def project_shape(geometry):
    return {'type':'MultiPolygon','coordinates':[
        [[tuple(round(v,3) for v in projection(*p[:2])) for p in ring] for ring in poly]
        for poly in polygons(geometry)
    ]}


def geographic_lines(geometry):
    if geometry['type']=='LineString':
        yield geometry['coordinates']
    elif geometry['type']=='MultiLineString':
        yield from geometry['coordinates']
    elif geometry['type']=='GeometryCollection':
        for member in geometry['geometries']:
            yield from geographic_lines(member)


def outline(ring, closed):
    unique = [p for i,p in enumerate(ring) if i==0 or p!=ring[i-1]]
    if closed and unique and unique[-1]==unique[0]:
        unique.pop()
    if len(unique)<(3 if closed else 2):
        return ''
    return 'M'+'L'.join(f'{x:g} {y:g}' for x,y in unique)+('Z' if closed else '')


def area(ring):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:])))/2


def edge_slivers(territories,earth):
    # Put a subpixel gap into its longest shared neighbor rather than drawing a tiny coastline.
    owners = {}
    for key,shape in territories.items():
        for poly in polygons(shape):
            for ring in poly:
                for a,b in zip(ring,ring[1:]):
                    owners[tuple(sorted((tuple(a),tuple(b))))] = key
    closure = defaultdict(list)
    for poly in polygons(earth):
        for hole in poly[1:]:
            if area(hole)>SLIVER_AREA:
                continue
            shares = defaultdict(float)
            for a,b in zip(hole,hole[1:]):
                shares[owners[tuple(sorted((tuple(a),tuple(b))))]] += dist(a,b)
            closure[max(shares,key=shares.get)].append({'type':'Polygon','coordinates':[hole]})
    return closure


def terrain_path(geometry):
    return ''.join(outline(ring,True) for polygon in polygons(geometry) for ring in polygon)


def line_path(geometry):
    return ''.join(outline(ring,False) for ring in geographic_lines(geometry))


def main(source):
    data = json.loads(source.read_text())
    id_key = 'ADM0_A3'
    countries = {f['properties'][id_key]:f['geometry'] for f in data['features']}
    groups = {key:[countries[c] for c in codes.split()] for key,codes in TERRITORIES.items()}
    covered = {code for ids in TERRITORIES.values() for code in ids.split()}
    if set(countries)-covered!={'ATA'} or sum(len(codes.split()) for codes in TERRITORIES.values())!=len(covered):
        raise ValueError('Every geographic territory besides Antarctica must be in exactly one group')
    # The GeoJSON groups French Guiana into France. In this world it belongs to the eastern South American coastline.
    groups['lumen'].remove(countries['FRA'])
    for coordinates in polygons(countries['FRA']):
        target = 'brazin' if coordinates[0][0][0]<-20 else 'lumen'
        groups[target].append({'type':'Polygon','coordinates':coordinates})
    territories,earth,borders,shore = dissolved_shapes(groups)

    profiles = re.findall(r"country\('([a-z]+)',[^\n]*?'(?:asia|europe|north|south|africa|oceania)',\[([-\d.]+),([-\d.]+)\]",
                          (DIST/'atlas-data.mjs').read_text())
    pins = {key:[round(x,3) for x in projection(float(lon),float(lat))]
            for key,lon,lat in profiles}
    if pins.keys()!=territories.keys():
        raise ValueError('Territories and country profiles must use matching IDs')
    south_east = max(p[0] for poly in polygons(territories['brazin']) for p in poly[0])
    africa_west = min(p[0] for poly in polygons(territories['azania']) for p in poly[0])
    if africa_west-south_east<19:
        raise ValueError('South America and Africa need open ocean between their coasts')
    art = ROOT/'public/art'
    land = pixel_coverage(earth, polygons, MAP_TOP, MAP_BOTTOM) > 127
    outputs = {
        'territoryPaths':pixel_territory_paths(territories,land,polygons,MAP_TOP,MAP_BOTTOM),
        'countryPins':pins,'regionBoxes':REGIONS,'coastPath':terrain_path(earth),
        'borderPath':line_path(borders),'shorelinePath':line_path(shore),
        'mapBounds':[MAP_TOP,MAP_BOTTOM],
        'northCoast':MAP_TOP+int(np.flatnonzero(land.any(axis=1))[0])/PIXELS_PER_UNIT,'mapBiomes':BIOMES,
    }
    with (DIST/'atlas-map.mjs').open('w') as file:
        file.write('// Fictional territories derived from Natural Earth public-domain cartography.\n')
        for name,value in outputs.items():
            file.write(f'export const {name} = '+json.dumps(value,separators=(',',':'))+';\n')
    paint_terrain(art,land,borders,geographic_lines,projection,MAP_TOP,MAP_BOTTOM)
    print(f'{len(territories)} territories, Atlantic gap of {africa_west-south_east:.1f} map units')


if __name__=='__main__':
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path,help='Unsimplified Natural Earth country GeoJSON with ADM0_A3 properties')
    args = parser.parse_args()
    main(args.source)
