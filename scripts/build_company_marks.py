#!/usr/bin/env python3
"""Render exchange brandmarks and horizontal lockups to WebP."""

import io
import json
from pathlib import Path
from subprocess import run
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

from PIL import Image
from draw_security_badges import fund_badge, stock_badge


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/art/companies"
LOCKUPS = ROOT / "scripts/artwork/signatures"


def path(points, color="", **attributes):
    attrs = "".join(f' {key.replace("_", "-")}="{value}"' for key, value in attributes.items())
    fill = f' fill="{color}"' if color else ""
    return f'<path d="{points}"{fill}{attrs}/>'


def dot(x, y, radius, color=""):
    fill = f' fill="{color}"' if color else ""
    return f'<circle cx="{x}" cy="{y}" r="{radius}"{fill}/>'


def rect(x, y, width, height, color="", radius=0):
    fill = f' fill="{color}"' if color else ""
    return f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{radius}"{fill}/>'


def tile(field, ink, *forms):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
        + rect(0, 0, 48, 48, field) + f'<g fill="{ink}">' + "".join(forms) + "</g></svg>"
    )


# Archived equities remain visible in holdings and older game records.
MARKS = {
    # The leg of the bank's K sweeps out into a wide bracket serif.
    "crown": tile("#f4eee5", "#762d3c",
        path("M8 10h15v3h-4v11l13-11h-4v-3h12v3h-3L25 24c3 5 7 9 12 11l4 1v2H30c-5-2-9-7-11-12v9h4v3H8v-3h4V13H8z")),
    # Two cut vanes suggest the changing direction of a North Sea wind.
    "nord": tile("#153d43", "#d9f3e6",
        path("M8 32c2-13 8-21 23-23-7 5-10 11-11 19z"),
        path("M16 39c9-6 10-12 12-18 3-5 6-8 13-11-2 17-9 28-25 29z", "#74c9b4")),
    # Minato's broad, stamped M ends in a pair of inward-bevelled flanges.
    "tide": tile("#203f68", "#f4f4ec",
        path("M7 13h7l10 13 10-13h7v17l-8 5V24l-9 12-9-12v11l-8-5z")),
    # Seiwa's foil roll is one open spiral, cut square across both ends.
    "corl": tile("#f3ecf2", "#723563",
        path("M8 36V23c0-9 7-15 16-15s16 6 16 15c0 8-6 14-14 14-6 0-10-4-10-10s4-10 10-10h5v6h-5c-3 0-4 2-4 4 0 3 2 4 5 4 5 0 7-4 7-8 0-5-4-9-10-9s-10 4-10 10v12z")),
    # The broad J and the rectangular aperture form a single industrial chop.
    "jhmi": tile("#a33332", "#fcf4e8",
        path("M8 11h31v13c0 10-7 15-18 15H9v-7h13c6 0 9-3 9-8v-6h-9v8H11v-6h5v-2H8z")),
    # Savita's sun nests above the slow, upturned sweep of a palm.
    "svht": tile("#fff3de", "#8a3b29",
        dot(25, 16.5, 7, "#bc532d"),
        path("M6 25c6 1 9 3 13 6 5 3 12 1 23-9-4 10-12 16-21 16-6 0-12-5-15-13z")),
    # A station platform returns into the L with a single radiused inside corner.
    "lmx": tile("#164183", "#faf6e9",
        path("M9 10h8v16c0 4 2 6 6 6h18l-7 7H22c-8 0-13-5-13-13z"),
        path("M22 22h18l-5 6H22z", "#f1ad58")),
    # The diagonal of the machine maker's R starts deep inside the counter.
    "rtkw": tile("#e9bf55", "#252e35",
        path("M10 9h16c8 0 13 4 13 11 0 5-3 9-7 11l8 8H29L18 24h8c4 0 6-1 6-4s-2-5-6-5h-8v24h-8z")),
    # A winged maple seed is the railway's fleet insignia.
    "mnrd": tile("#f6f0e8", "#a02e39",
        path("M7.5 31c2-4 6-6 11-8C28 19 27 11 41 8c-1 13-6 22-16 24-4 1-6 2-8 5-3 4-8 4-10 1-1.5-2-1.2-5 .5-7zM11 33c-.8 1.8 0 3.2 1.7 3.2 2 0 3.3-1.7 3.4-3.9-2-1-3.9-.8-5.1.7z",
             fill_rule="evenodd")),
    # A bench-cut mine seen in cross-section.
    "vrs": tile("#254f40", "#f3d78b",
        path("M6 11h9v7h6v6h6v6h5l-8 10h-3L6 18zM27 23l9-12h7L31 28z")),
    # A horned antelope in a single silhouette, like a mark cast into a tool.
    "krv": tile("#f4ead7", "#73442d",
        path("M8 38c7-6 12-10 13-15l-9 1 6-6 4-1c-5-3-7-7-7-12 2 5 6 8 10 10 3-3 6-7 7-11 2 6 0 11-4 15l6 2 7 5-2 4-9-1c-1 4-3 7-6 10z")),
    # Four cropped billets leave the southern star in the space between them.
    "scmt": tile("#2a344f", "#efc496",
        path("M9 9h14l-3 11-11 4zm18 0h12v14l-10-3zm12 18v12H25l3-10zm-18 1 2 11H9V26z")),
    # The upper and lower faces of a lens meet across one open optical axis.
    "netp": tile("#322353", "#f6f1ff",
        path("M8 28C5 18 12 8 22 7c6-1 12 1 16 6z"),
        path("M11 33l29-16c3 9-2 18-11 21-7 2-13 0-18-5z", "#9fdbed")),
    # The split cap and keel of a terminal's heavy landing gantry.
    "fvt": tile("#efbd53", "#253f47",
        path("M8 11h15v7h-7v6l8 7 8-7v-6h-6v-7h14v16L24 40 8 27z")),
    # A Mediterranean signal pennant with a second, shorter fly.
    "ibpt": tile("#f6f1e7", "#174e67",
        path("M8 12c10 5 21-6 32-1v9c-12-5-22 6-32 1z"),
        path("M8 26c7 3 15-2 23-3-5 6-13 10-23 13z", "#c65132")),
    # The three open cores of the cable maker's extrusion die.
    "mexl": tile("#703e2e", "#f6dac0",
        path("M23 7h2l14 8v17l-15 9-15-9V15zM20 18a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 1 0-7.6 0zm-6 11a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 1 0-7.6 0zm12 0a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 1 0-7.6 0z",
             fill_rule="evenodd")),
    # A forged C with a broad base and both terminals sheared on the bias.
    "andb": tile("#f4e9da", "#9e4930",
        path("M39 13l-6 7c-4-5-11-5-15-1-4 5-3 11 2 14 4 3 10 2 14-2l5 5c-7 7-20 7-27 0-7-7-7-17 0-24 7-7 20-7 27 1z")),
    # The opening in the cooperative's P is the shape of a hatched seed.
    "pamp": tile("#e8edcf", "#385438",
        path("M10 39V23c0-9 6-15 15-15h13v11c0 10-6 16-16 16h-4v4zM18 28c8 0 13-4 14-12-8 1-13 5-14 12z", fill_rule="evenodd")),
    # A single waterway cuts a curved channel through the river delta.
    "nild": tile("#184853", "#f4e1aa",
        path("M5 37 24 8c0 6-2 11-6 17-3 4-6 8-7 12zm23-26 16 26H18c1-5 3-8 6-12s5-9 4-14z")),
    # A two-ink toucan, sized to work as a roast-bag stamp.
    "ork": tile("#f7ead4", "#4e3730",
        path("M8 37c4-4 6-8 6-14v-3c0-7 4-11 11-11 5 0 9 3 11 7l-7 6c-4 4-3 10-8 14-3 3-8 4-13 3z"),
        path("M24 14c10-3 15 0 18 9-6-1-12-.5-18 1z", "#c85931"),
        dot(21, 16, 1.8, "#f7ead4")),
    # A creamery bottle is carved out of the counter of Oura's initial.
    "orur": tile("#173f43", "#f7f2d8",
        path("M24 6c10 0 18 8 18 18s-8 18-18 18S6 34 6 24 14 6 24 6zm-5 6v4h1v2c0 3-4.5 5-4.5 9v7h17v-7c0-4-4.5-6-4.5-9v-2h1v-4z", fill_rule="evenodd")),
    # An albatross dips the long outside wing to turn into the trade winds.
    "paci": tile("#1e4b78", "#faf1dc",
        path("M4 18c10-3 17 0 23 7 3-6 8-10 17-12-7 7-11 15-14 22h-6C20 27 13 21 4 18z")),
    # Two broad, offset arcs transmit from the delta network's first station.
    "ngnt": tile("#ebecc9", "#315637",
        dot(13, 33, 5.5),
        path("M8 21c9-10 22-12 33-7l-3 6c-9-4-19-2-26 5z"),
        path("M21 28c5-4 11-5 17-3l-3 6c-4-1-7-1-10 1z")),
    # A cut phosphate crystal, printed as an eight-sided stamp.
    "atls": tile("#7b443c", "#f2d6a2",
        path("M24 6l5 6 7-1 1 7 5 6-6 5 1 7-7 1-6 5-5-6-7 1-1-7-5-6 6-5-1-7 7-1zM24 17l-7 7 7 7 7-7z", fill_rule="evenodd")),
    # A broad lower-case g with an open return stroke below the bowl.
    "kgeo": tile("#e9ede0", "#345c51",
        path("M37 10v17c0 9-5 14-14 14-5 0-10-2-13-5l4-5c3 3 6 4 9 4 4 0 7-2 7-6v-2c-2 2-5 4-9 4-7 0-12-5-12-12S14 8 21 8c4 0 7 1 9 4v-2zM16 20c0 4 3 6 7 6s7-3 7-7-3-6-7-6-7 3-7 7z", fill_rule="evenodd")),
    # Opposing banks cut the same canal out of two solid fields.
    "pacp": tile("#e7efea", "#205e6b",
        path("M8 10h33c-5 8-10 12-18 14-7 2-11 4-15 9z"),
        path("M40 38H7c5-7 10-11 18-13 7-2 11-5 15-10z")),
    # A single quinoa seed and its curved germ form the grower's stamp.
    "uruq": tile("#6d344c", "#f7ddbd",
        path("M25 8c10 0 16 7 16 15 0 9-7 16-17 17-10 0-17-6-17-15 0-9 7-16 18-17zm-9 21c-4-6 0-14 7-16 6-1 11 2 13 7-5-3-9-3-13 0-4 4-1 10 6 8-3 7-10 7-13 1z", fill_rule="evenodd")),
    # Segwang Motors: a low coachbuilder's S, suitable for a stamped bonnet badge.
    "sgmo": tile("#162837", "#f0f3f1",
                 path("M42 13H16.2c-5.5 0-9 3.6-9 8.4 0 4.1 3.1 6.3 7.9 6.3h11.6c1.4 0 2 .4 2 1.3s-.7 1.5-2.2 1.5H10.4L5 36h22.6c6.2 0 10.3-3.6 10.3-8.5 0-4.1-3-6.1-8.6-6.1H17c-1.3 0-2-.4-2-1.3 0-1 .8-1.6 2.4-1.6h18.8Z")),
    # Onnuri Telecom: an open signal loop that curls into a soft inner terminal.
    "ontl": tile("#f7f1ee", "#673478",
                 path("M39.4 21.2C36.4 11.5 27.4 7 18.2 10.4 8.4 14 5.4 23.8 10.6 32c4 6.2 12.1 8.8 19.1 6.1 6-2.3 9.3-7.5 8-12.3-1.3-4.6-6.5-6.3-10.4-3.8-2.3 1.4-3.2 4.2-2.3 6.4 2.2-1.8 4.2-1.4 4.4.1.3 1.5-1.4 3.3-4 4.1-4.1 1.1-8.3-.7-10.1-4.4-2.3-4.8-.4-10.3 4.6-12.4 4.9-2.1 10.2-.3 12.9 4.5Z")),
    # Geumgang Precision: a wafer flat registers against a square gauge jaw.
    "ggpm": tile("#174e65", "#f1f5ec",
                 path("M13.5 8H29l6 6H17.1L13 18.1v11.8l4.1 4.1h12l4.9-4.9V26h-9v-6h15v11.8L31.8 40H13.6L6 32.3V15.8Z")),
    # Serim Shipyards: two fair curves of plating meeting at the raked stem.
    "slyd": tile("#ebefed", "#14496a",
                 path("M4 22c11.3.8 24.8-2.6 39-12l-3.4 8C28.7 24.3 18 27.5 8.8 28.2Z"),
                 path("M10.3 31.6c10.2-1.1 20.2-4.5 27.2-8.3l-2.8 6.9c-6.6 3.6-13.1 6-20.2 7.2Z", "#247e87")),
    # Moraenae Games: a slightly tilted sandglass with a soft, hand-pinched waist.
    "mrgm": tile("#ffd184", "#462638",
                 path("M10.7 10.3c7.4 2 16.6 1.3 26-1.4-.2 6.4-2.6 10.4-8.1 13.7-1.4.9-1.6 2.3-.1 3.1 5.9 3.4 8 6.9 9.1 12.3-10.2-1.8-19-1.1-27.2 1.2.2-5.5 2.5-10.2 8.2-14 1.5-1 1.5-2.4-.1-3.2-4.6-2.4-7-6.1-7.8-11.7Z"),
                 path("M16.5 34.7c1.7-2.8 4.2-4.7 6.9-5.9 2.5.8 4.5 2.1 6.2 4.1-4.2-.1-8.6.6-13.1 1.8Z", "#ffd184")),
    # Solbit Energy: woodcut sun with the light opening between two pine needles.
    "sben": tile("#edf1df", "#246045",
                 path("M39.8 20.8A16.3 16.3 0 1 0 16.6 38.7l8-19.7-2 21.2a16.2 16.2 0 0 0 6.2-.7L34.6 19l-1.5 18.1a16.2 16.2 0 0 0 6.7-16.3Z")),
    # Kaon Systems: the K's two arms are blades cut from a single telemetry stencil.
    "kaon": tile("#202e31", "#c9e5a6",
                 path("M9 9h8.5v13L12 28.2V39H9ZM20.8 23.3 32.1 9H41L29.9 22.6 40.4 36H30l-7.7-9.1-7.2 8.6v-6.8Z")),
    # Daeyoung Foods: a round fruit maker's stamp with one folded peel.
    "dyfd": tile("#fff1d8", "#b03e28",
                 path("M11.1 15c4.5-2.5 9.8-1.4 13.3-.4C25 8 30 5.4 36.1 6.8c-.8 4.4-3.5 7.1-8.1 8.1 8.1-1.4 13.1 3.7 12.3 10.8-.8 8.3-8.8 14.2-18.1 13.8-9.1-.3-15.9-6.1-15.4-14.2.2-4.5 1.6-8 4.3-10.3Z"),
                 path("M12.4 25.9c.2 4.1 3.7 7.3 8.2 8.3 1.9.4 3.5.5 4.9.3-6.4-2.8-7.5-6.2-8.1-10.4Z", "#fff1d8")),
    # Redwood Devices: a section of heartwood, cut flat on two faces.
    "rwdv": tile("#99513e", "#fff7ea",
                 path("M7 20.8C7 13.1 13 8 20.4 8H25c9.4 0 15.5 6.7 15.5 15.3v4.5c0 7.3-5 12.2-12 12.2H24V34h4c4.2 0 6.5-2.7 6.5-6.9v-3.9c0-5.4-3.6-9.3-9.2-9.3h-4.7c-4.7 0-7.6 2.8-7.6 7v15H7Z"),
                 path("M17 22c0-3.1 1.6-4.7 4.6-4.7h2.8c4.4 0 7.1 2.8 7.1 7.3V28h-5v-3.3c0-1.8-.7-2.6-2.4-2.6H22V40h-5Z")),
    # Briarwood Therapeutics: a serif b whose counter takes the form of a bud.
    "bwtx": tile("#f4ecec", "#622d55",
                 path("M9 12 21 7v16c2.7-3.7 5.5-5.6 9.5-5.6 5.7 0 9.3 4.5 8.5 10.6-.8 7.2-6.4 12.1-13 12.1-3.4 0-6.4-.9-8.1-2.6l-4.7 2.6h-1V16.6c0-1.8-1.2-2.7-3.2-2.7Zm12 17.9v3.3c-.1 2.1 1.2 3.5 3.6 3.5 3.9 0 6.9-4.8 6.9-10.5 0-2.1-.8-3.6-2.5-3.7-3.4-.1-6.8 3.5-8 7.4Z", fill_rule="evenodd")),
    # Juniper Foods: a grocer's J curling out of the tapered end of a needle.
    "jnfd": tile("#224c39", "#ffedcf",
                 path("M37.4 7.4c-1 5.7-4.5 9.2-10.9 10.5l-1.9.4C23 11.9 28.2 7.9 35.1 7.4ZM17.5 22.6l14.6-4.3-2.3 12.5c-1.1 5.9-5.4 9.6-11.6 9.6-5.9 0-9.3-3.1-9.2-7.3 0-2.8 2.3-4.8 5.1-4.6 1.9.1 3.3 1.4 3.5 3.1-2.2.4-3.1 1.6-2.7 3 .3 1 1.2 1.7 2.8 1.7 2.7 0 4.2-2.3 5-6l1.3-6.1-6.8 1.1Z")),
    # Meridian Aero: an airfoil swept through a circular plotting arc.
    "mdra": tile("#153852", "#edf6f8",
                 path("M8.6 28.3C5.9 21.6 9.1 13.6 15.8 10c5.6-3 12-2.6 16.8 1.1-4.1-1.5-8.6-.8-12.1 1.7-4.7 3.2-6.3 8-5.3 12.2Z"),
                 path("M5 36.3 42.4 13.8 33.9 25l-16 10.1 6.4-1.2c4.1-.9 6.6-2.4 9.4-5.9l-3.1 8.3c-4.9 4-10.6 4.3-16.5 1.8Z", "#8dd5dc")),
    # Vertex Payments: a clipped transaction slip locking into its counterpart.
    "vxpm": tile("#f6ece9", "#9e2f54",
                 path("M6 17.2 13.2 10h17.6l-6.4 6.4H17L12.4 21v6l7.4-7.4h8.7L12.1 36H6Z"),
                 path("M42 30.8 34.8 38H17.2l6.4-6.4H31l4.6-4.6v-6l-7.4 7.4h-8.7L35.9 12H42Z")),
    # Breakwater Security: a reinforced wall intercepts two incoming wave fronts.
    "bwsc": tile("#133d43", "#c9ede2",
                 path("M27 8h10v32H27V28c-2.4.2-4.1 1.5-6.6 4.6C17.5 36 14.3 38 9 38v-6.9c3-.2 5.1-1.7 7.8-5 3.1-3.6 6.1-5.4 10.2-5.6Z"),
                 path("M8.5 21c3.3-.4 5.3-2.1 8.1-5.5 2.1-2.5 4.2-3.9 7.1-4.6v6.6c-1.4.5-2.7 1.8-4.2 3.6-3 3.5-5.9 5.8-11 6.5Z")),
    # Ironpeak Robotics: a servo end plate with a D-shaped keyed bore.
    "irpk": tile("#f4b852", "#243339",
                 path("m18 7 18.5 5.9 6 12.1-6.3 6.9-2.3-2.2-3.2 3.5 2.3 2.1-5.1 5.6L10.6 35 6 22.7Zm1.9 11.7-3.3 7 6.8 3.3c3.8 1.6 7.1-.2 8.7-3.9l.4-1.2-6.1-3.1-1.5 2.5-3-1.5 1.2-2Z", fill_rule="evenodd")),
    # Stonebridge Consumer: three cut stones fit over the open arch.
    "sbcg": tile("#f1ede2", "#315958",
                 path("M17.6 9.8a22.5 22.5 0 0 1 12.8 0l-3.7 12.7a9.6 9.6 0 0 0-5.4 0Z"),
                 path("M14.1 11.4 18 24.2c-3.9 2.4-6 6.5-6.1 12.1H4.8c0-10.6 2.6-19 9.3-24.9Zm19.8 0c6.7 5.9 9.3 14.3 9.3 24.9H36c-.1-5.6-2.2-9.7-6.1-12.1Z")),
    # Kumoto Motors: curved press lines split a spindle into two offset halves.
    "kmtd": tile("#e9edf0", "#283844",
                 path("M4 26.1c4.5-7 10.6-12.2 20.5-13.5 6.4-.8 12.8.2 19 3.6-10.6.3-16.2 2.3-22.8 7.4-5.3 4-11 5.3-16.7 2.5Z"),
                 path("M5.2 30.7c6.4.8 12.8-.5 19.5-5.1 7.3-4.9 11.3-6.4 18.3-6.6-3.3 6.4-8.9 11.5-16.6 14.1-8.9 2.9-15.7 1.4-21.2-2.4Z")),
    # Asamizu Electronics: one fluid crest rises from a level contact surface.
    "asmz": tile("#eff3f6", "#2968a1",
                 path("M6 34.8C13 31.5 14.7 24 15.9 17.5c1.5-7.1 5-10.3 10.3-10.4-3.3 2.8-4.2 7-4.2 11.2 0 5.8-1.7 10-5 13.1 6.1-2.3 10.6-5.6 16.6-6.2 3.7-.4 6.9.4 9.6 2.4-6.8.4-12.2 5.4-17.9 8.9C19.2 40.1 11.6 40.1 6 34.8Z")),
    # Donghu Digital: a custom single-character 东 seal with a wide central crossing.
    "dhdg": tile("#b84333", "#fff2df",
                 path("M9 12h13l2.6-5H32l-2.6 5h10v5.4H26.7l-3.9 7.1h3.4v-4.6h6v4.6H39v5.2h-6.8v6.9c0 3-1.6 4.2-4.8 4.2h-5.1l-1.6-5h4.2c.9 0 1.3-.4 1.3-1.3v-4.8H12.4l6.8-12.3H9Z"),
                 path("M15.6 31h6.2l-7.1 8.3H7.9Zm20.6 0 5.9 7.3h-6.2L32.8 34Z")),
}


def coin_mark(code, ink):
    if code == "bit":
        # Notched ears, cheek tufts, and negative-space eyes in the stamped cat head.
        return path("M12 12h3v3h3v3h12v-3h3v-3h3v15h3v3h-3v3h-6v3H18v-3h-6v-3H9v-3h3z"
                    "M17 24v3h4v-3zM27 24v3h4v-3zM22 29v2h4v-2z", ink, fill_rule="evenodd")
    return (
        path("m24 9 10 15-10 6-10-6zm0 23 10-6-10 14-10-14z", ink)
        + path("m24 9 10 15-10 6zm0 23 10-6-10 14z", "#8b8ab4")
    )


# Keep the original stamped cat coin as the reference for the exchange tiles.
MARKS["nyan"] = ('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" shape-rendering="crispEdges">'
                 + path("M15 2h18v3h6v4h4v6h3v18h-3v6h-4v4h-6v3H15v-3H9v-4H5v-6H2V15h3V9h4V5h6z", "#985924")
                 + path("M16 3h16v3h7v5h3v7h2v11h-3v7h-5v4h-6v3H16v-3h-6v-4H6v-7H4V16h3v-6h4V6h5z", "#e9b451")
                 + path("M16 6h15v2h-15zM9 12h3v5H9zM6 19h2v8H6z", "#fbe4a3")
                 + coin_mark("bit", "#724221") + "</svg>")
MARKS["eth"] = tile("#e8e5f1", "#454475", coin_mark("eth", "#454475"))


SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
LISTED = ROOT / "scripts/artwork/listed"

# The square original is shared by the market list and the signature. Names are
# set as whole runs in the wide variant, so their shapes never enter the badge.
# Each row is (name, secondary line, primary typeface, size, weight, italic).
SANS = "Noto Sans CJK KR"
SERIF = "Noto Serif CJK KR"
SIGNATURES = {
    "moon": ("Moonline", "달밤물류   LOGISTICS", "Nimbus Sans", 35, 700, True),
    "mart": ("장터마트", "JANGTEO MART", SERIF, 30, 700, False),
    "rail": ("이음철도", "IEUM RAIL", SANS, 30, 700, False),
    "volt": ("온빛전력", "ONBIT POWER", SANS, 30, 700, False),
    "bmem": ("BAEKSAN", "백산칩   SEMICONDUCTORS", "Nimbus Sans", 31, 700, False),
    "wjbt": ("한칸전지", "ONECELL BATTERY", SANS, 29, 700, False),
    "yjrx": ("맑음제약", "CLEARDAY PHARMA", SERIF, 29, 700, False),
    "dhcp": ("물결금융", "TIDEWAY FINANCE", SERIF, 29, 700, False),
    "arc": ("NORTHSTAR", "CHIPS", "Nimbus Sans Narrow", 33, 700, False),
    "nova": ("cloudlift", "CLOUD INFRASTRUCTURE", "URW Gothic", 32, 700, False),
    "harb": ("WHALE LINE", "", "Nimbus Sans Narrow", 34, 700, False),
    "hzma": ("DASH EV", "", "Nimbus Sans", 34, 700, True),
    "altq": ("Clickfind", "", "URW Gothic", 36, 700, False),
    "qrgr": ("QUARRY", "POWER", "Nimbus Sans", 30, 700, False),
    "wfbk": ("Fieldline Bank", "", "P052", 28, 700, False),
    "flfx": ("Flarefox", "GAME STUDIO", "URW Bookman", 32, 700, True),
    "hridx": ("한강자산운용", "KOREA ETF", SANS, 26, 700, False),
    "mor2": ("한강자산운용", "LEADERS 2X", SANS, 26, 700, False),
    "amidx": ("Meridian", "US ETF", "P052", 33, 700, False),
}


def signature(artwork, spec):
    square = ET.fromstring(artwork)
    field = square.find(f"{{{SVG_NS}}}rect").attrib["fill"]
    symbol = square.find(f"{{{SVG_NS}}}g")
    ink = symbol.attrib["fill"]
    name, subtitle, family, size, weight, italic = spec
    x = 80
    primary_y = 43 if subtitle else 49
    style = "italic" if italic else "normal"
    primary = (f'<text id="company-name" x="{x}" y="{primary_y}" fill="{ink}" '
               f'font-family="{family}" font-size="{size}" font-weight="{weight}" '
               f'font-style="{style}">{escape(name)}</text>')
    secondary = ""
    if subtitle:
        secondary = (f'<text id="descriptor" x="{x + 1}" y="60" fill="{ink}" '
                     f'font-family="{SANS}" font-size="9.5" font-weight="500" '
                     f'letter-spacing="1.05">{escape(subtitle)}</text>')
    badge = ET.tostring(symbol, encoding="unicode")
    return (f'<svg xmlns="{SVG_NS}" width="300" height="76" viewBox="0 0 300 76">'
            f'{rect(0, 0, 300, 76, field)}'
            f'<g id="symbol" transform="translate(9 8) scale(.9375)">{badge}</g>'
            f'{primary}{secondary}</svg>')


def rasterize(artwork, width):
    render = run(
        ["inkscape", "--pipe", "--export-type=png", "--export-filename=-", f"--export-width={width}"],
        input=artwork.encode("utf-8"), check=True, capture_output=True,
    )
    with Image.open(io.BytesIO(render.stdout)) as bitmap:
        alpha = bitmap.convert("RGBA")
        image = alpha.convert("RGB") if alpha.getextrema()[3] == (255, 255) else alpha
        return image


def main():
    listings = run(
        ["node", "--input-type=module", "-e", """
         import {stocks,isSpot,fundTracking,trackedFundMember} from './src/game/securities-data.mjs';
         import {continuousTradingDay} from './src/game/clock-calendar.mjs';
         console.log(JSON.stringify(stocks.filter(s=>!s.bond&&!s.option).map(s=>({
           id:s.id, spot:isSpot(s), listed:!s.archiveOnly,
           family:s.reference && (trackedFundMember(s) ?? (s.indexTracker?s.code:s.reference.join('/'))),
           factor:s.reference && fundTracking(s,continuousTradingDay).factor,
         }))));
         """],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    stocks = json.loads(listings.stdout)
    listed_shares = {issue["id"] for issue in stocks if issue["listed"] and not issue.get("family") and not issue["spot"]}
    originals = {p.stem: p.read_text() for p in LISTED.glob("*.svg")}
    if originals.keys() != SIGNATURES.keys() or not listed_shares.issubset(originals):
        raise ValueError("Every listed company needs its square original and signature specification")
    marks = {**MARKS, **originals}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for issue in stocks:
        issuer = issue["id"]
        if issue.get("family"):
            image = fund_badge(issue["family"], issue["factor"])
        elif issue["spot"]:
            image = rasterize(marks[issuer], 72)
        else:
            artwork = marks[issuer]
            colors = list(dict.fromkeys(el.get("fill") for el in ET.fromstring(artwork).iter()
                                        if el.get("fill", "").startswith("#")))
            image = stock_badge(issuer, rasterize(artwork, 144), colors)
        image.save(OUTPUT / f"{issuer}.webp", lossless=True, method=6)
    LOCKUPS.mkdir(parents=True, exist_ok=True)
    for issuer, artwork in originals.items():
        rasterize(signature(artwork, SIGNATURES[issuer]), 600).save(
            LOCKUPS / f"{issuer}-signature.webp", lossless=True, method=6)


if __name__ == "__main__":
    main()
