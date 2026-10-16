from pathlib import Path
import math
import fitz


ROOT = Path(r"D:\development\mr david\mothercompany\enriveatradingbot")
SRC = ROOT / "cctv-cleaned"
OUT = ROOT / "output" / "pdf" / "PLAN-IMPLANTATION-CCTV-PROPOSE-FR.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

# Colours (RGB 0..1)
BLUE = (0.02, 0.28, 0.78)
CYAN = (0.00, 0.62, 0.78)
GREEN = (0.00, 0.55, 0.32)
MAGENTA = (0.78, 0.05, 0.42)
ORANGE = (0.92, 0.42, 0.02)
NAVY = (0.03, 0.12, 0.24)
WHITE = (1, 1, 1)
PALE = (0.96, 0.98, 1.00)


# Camera tuples are expressed in the visible, rotated A0 sheet coordinates:
# (x, y, direction_degrees, type), where 0=east and 90=south.
PLANS = {
    "ETAGE": {
        "source": "421-PE-CFA-PLAN ECF-ETAGE-NO-CCTV.pdf",
        "prefix": "E1",
        "split": 1650,
        "switches": [
            (1276, 1194, "SW-E1-A", "LOCAL + UPS"),
            (1955, 1172, "SW-E1-B", "LOCAL + UPS"),
            (1967, 1659, "SW-CENTRAL", "LOCAL SERVEURS + UPS"),
            (2140, 1220, "SW-CONTROLE", "A DEFINIR + UPS"),
        ],
        "cameras": [
            # Exterior / perimeter
            (835, 430, 225, "B"), (2370, 430, 315, "B"),
            (830, 1670, 135, "B"), (2370, 1670, 45, "B"),
            (825, 760, 180, "B"), (2380, 760, 0, "B"),
            # Upper circulation
            (950, 675, 0, "D"), (1200, 675, 180, "D"),
            (1450, 675, 0, "D"), (1820, 675, 180, "D"),
            (2050, 675, 0, "D"), (2280, 675, 180, "D"),
            # Stair and lift lobbies
            (1150, 790, 90, "D"), (2080, 790, 90, "D"),
            (1150, 1370, 270, "D"), (2080, 1370, 270, "D"),
            # Patio / workshop circulation
            (1250, 920, 0, "D"), (1500, 920, 180, "D"),
            (1800, 920, 0, "D"), (2050, 920, 180, "D"),
            (1380, 1210, 0, "D"), (2020, 1190, 180, "D"),
            # IT / server circulation
            (1050, 1440, 0, "D"), (1450, 1440, 180, "D"),
            (1850, 1440, 0, "D"), (2200, 1440, 180, "D"),
            # Sensitive room entrances
            (1830, 1570, 90, "D"), (2140, 1280, 270, "D"),
        ],
    },
    "RDC BAS": {
        "source": "421-PE-CFA-PLAN ECF-RDC BAS-NO-CCTV.pdf",
        "prefix": "RB",
        "split": 1650,
        "switches": [
            (1344, 1306, "SW-RB-A", "LOCAL + UPS"),
            (2039, 1207, "SW-RB-B", "LOCAL + UPS"),
        ],
        "cameras": [
            # Exterior / accesses
            (850, 220, 225, "B"), (850, 850, 180, "B"),
            (850, 1680, 135, "B"), (1200, 1680, 90, "B"),
            (2200, 220, 315, "B"), (2250, 850, 0, "B"),
            (2250, 1680, 45, "B"), (1900, 1680, 90, "B"),
            # Upper warehouse zones
            (950, 310, 45, "D"), (1200, 310, 135, "D"),
            (1450, 310, 45, "D"), (1580, 520, 315, "D"),
            (1750, 310, 135, "D"), (1950, 310, 45, "D"),
            (2150, 310, 135, "D"), (2050, 520, 225, "D"),
            # Main circulation
            (980, 670, 0, "D"), (1250, 670, 180, "D"),
            (1500, 670, 0, "D"), (1800, 670, 180, "D"),
            (2050, 670, 0, "D"), (2200, 670, 180, "D"),
            # Lobbies and controlled passages
            (1200, 790, 90, "D"), (1500, 790, 90, "D"),
            (1800, 790, 90, "D"), (2050, 790, 90, "D"),
            # Stock zones
            (1300, 980, 45, "D"), (1500, 1200, 315, "D"),
            (1800, 980, 135, "D"), (1900, 1120, 225, "D"),
            # Pharmacy circulation
            (1150, 1450, 0, "D"), (1500, 1450, 180, "D"),
            (1850, 1450, 0, "D"), (2150, 1450, 180, "D"),
        ],
    },
    "RDC HAUT": {
        "source": "421-PE-CFA-PLAN ECF-RDC HAUT-NO-CCTV.pdf",
        "prefix": "RH",
        "split": 1650,
        "switches": [
            (1218, 1303, "SW-RH-A", "LOCAL + UPS"),
            (1912, 1204, "SW-RH-B", "LOCAL + UPS"),
        ],
        "cameras": [
            # Exterior / accesses
            (820, 430, 225, "B"), (820, 1600, 135, "B"),
            (1250, 1690, 90, "B"), (2240, 430, 315, "B"),
            (2250, 1050, 0, "B"), (2050, 1690, 90, "B"),
            # Upper stores
            (950, 440, 45, "D"), (1200, 440, 135, "D"),
            (1450, 440, 45, "D"), (1580, 610, 315, "D"),
            (1750, 440, 135, "D"), (1950, 440, 45, "D"),
            (2150, 440, 135, "D"), (2050, 610, 225, "D"),
            # Main logistics circulation
            (980, 700, 0, "D"), (1250, 700, 180, "D"),
            (1500, 700, 0, "D"), (1800, 700, 180, "D"),
            (2050, 700, 0, "D"), (2200, 700, 180, "D"),
            # Large medical-equipment zone
            (1280, 860, 45, "D"), (1520, 1060, 315, "D"),
            (1800, 860, 135, "D"), (2020, 1060, 225, "D"),
            # Stair / lift lobbies
            (1180, 790, 90, "D"), (1500, 790, 90, "D"),
            (1800, 790, 90, "D"), (2070, 790, 90, "D"),
            # Pharmacy and conference circulation
            (1200, 1370, 0, "D"), (1500, 1370, 180, "D"),
            (1850, 1370, 0, "D"), (2150, 1370, 180, "D"),
        ],
    },
}


def vis_to_pdf(page, point):
    """Visible sheet coordinates -> unrotated PDF coordinates for /Rotate 270."""
    vx, vy = point
    return fitz.Point(page.mediabox.width - vy, vx)


def polar(origin, radius, angle_deg):
    a = math.radians(angle_deg)
    return origin[0] + radius * math.cos(a), origin[1] + radius * math.sin(a)


def camera_id(prefix, zone, index):
    return f"{prefix}-{zone}{index:02d}"


def draw_camera(page, vx, vy, angle, kind, label):
    centre = (vx, vy)
    if kind == "B":
        colour = BLUE
        spread = 56
        reach = 140
    else:
        colour = GREEN
        spread = 76
        reach = 92

    # Translucent field of view.
    arc = [polar(centre, reach, angle - spread / 2 + spread * i / 10) for i in range(11)]
    polygon = [centre] + arc + [centre]
    page.draw_polyline(
        [vis_to_pdf(page, pt) for pt in polygon],
        color=colour,
        fill=colour,
        width=1.8,
        fill_opacity=0.10,
        stroke_opacity=0.65,
        overlay=True,
    )

    pc = vis_to_pdf(page, centre)
    forward = vis_to_pdf(page, polar(centre, 20, angle))
    if kind == "D":
        page.draw_circle(pc, 11, color=colour, fill=WHITE, width=3.2, overlay=True)
        page.draw_line(pc, forward, color=colour, width=4, overlay=True)
        page.draw_circle(pc, 3.5, color=colour, fill=colour, width=0, overlay=True)
    else:
        # A compact bullet-camera body aligned to its viewing direction.
        a = math.radians(angle)
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        body = []
        for along, side in [(-10, -6), (12, -6), (12, 6), (-10, 6), (-10, -6)]:
            body.append((vx + along * ux + side * px, vy + along * uy + side * py))
        page.draw_polyline(
            [vis_to_pdf(page, pt) for pt in body],
            color=colour,
            fill=colour,
            width=2,
            overlay=True,
        )
        page.draw_circle(forward, 4.5, color=colour, fill=WHITE, width=2, overlay=True)

    # Small camera ID beside the symbol; text remains horizontal on the rendered sheet.
    label_anchor = vis_to_pdf(page, (vx + 16, vy - 14))
    page.insert_text(
        label_anchor,
        label,
        fontsize=11,
        fontname="hebo",
        color=NAVY,
        rotate=270,
        overlay=True,
    )


def draw_switch(page, vx, vy, code, detail, colour=MAGENTA):
    p = vis_to_pdf(page, (vx, vy))
    rect = fitz.Rect(p.x - 24, p.y - 24, p.x + 24, p.y + 24)
    page.draw_rect(rect, color=colour, fill=colour, width=3, overlay=True)
    page.insert_textbox(
        rect,
        "SW",
        fontsize=13,
        fontname="hebo",
        color=WHITE,
        rotate=270,
        align=1,
        overlay=True,
    )
    text_rect = fitz.Rect(p.x - 25, p.y + 32, p.x + 50, p.y + 235)
    page.insert_textbox(
        text_rect,
        f"{code}\n{detail}",
        fontsize=12,
        fontname="hebo",
        color=colour,
        rotate=270,
        align=0,
        lineheight=1.05,
        overlay=True,
    )


def draw_panel(page, plan_name, total, a_count, b_count):
    # This becomes a landscape panel in the free upper-left area when rendered.
    panel = fitz.Rect(1870, 105, 2328, 620)
    page.draw_rect(panel, color=NAVY, fill=PALE, width=5, fill_opacity=0.97, overlay=True)
    page.draw_rect(fitz.Rect(1870, 105, 1945, 620), color=NAVY, fill=NAVY, width=0, overlay=True)
    page.insert_textbox(
        fitz.Rect(1885, 125, 1932, 600),
        "PLAN D'IMPLANTATION CCTV PROPOSE",
        fontsize=22,
        fontname="hebo",
        color=WHITE,
        rotate=270,
        align=1,
        overlay=True,
    )

    lines = [
        f"NIVEAU : {plan_name}",
        f"CAMERAS : {total}",
        f"ZONE A : {a_count}  |  ZONE B : {b_count}",
        "",
        "LEGENDE",
        "D = dome interieur - champ vert",
        "B = bullet exterieur - champ bleu",
        "SW = switch PoE / central / controle",
        "",
        "ARCHITECTURE",
        "Switchs locaux pres des gaines CFA",
        "Fibre existante vers SW-CENTRAL",
        "Salle de controle dans A DEFINIR",
        "TOTAL GENERAL : 94 CAMERAS",
    ]
    page.insert_textbox(
        fitz.Rect(1970, 125, 2300, 598),
        "\n".join(lines),
        fontsize=16,
        fontname="helv",
        color=NAVY,
        rotate=270,
        align=0,
        lineheight=1.18,
        overlay=True,
    )


def annotate_page(doc, name, spec):
    page = doc[0]
    page.wrap_contents()
    zone_counts = {"A": 0, "B": 0}
    for vx, vy, angle, kind in spec["cameras"]:
        zone = "A" if vx < spec["split"] else "B"
        zone_counts[zone] += 1
        ident = camera_id(spec["prefix"], zone, zone_counts[zone])
        draw_camera(page, vx, vy, angle, kind, ident)

    for vx, vy, code, detail in spec["switches"]:
        colour = NAVY if code == "SW-CENTRAL" else (ORANGE if code == "SW-CONTROLE" else MAGENTA)
        draw_switch(page, vx, vy, code, detail, colour)

    draw_panel(page, name, len(spec["cameras"]), zone_counts["A"], zone_counts["B"])


assert sum(len(spec["cameras"]) for spec in PLANS.values()) == 94
assert len(PLANS["ETAGE"]["cameras"]) == 28
assert len(PLANS["RDC BAS"]["cameras"]) == 34
assert len(PLANS["RDC HAUT"]["cameras"]) == 32

combined = fitz.open()
for name, spec in PLANS.items():
    source = SRC / spec["source"]
    doc = fitz.open(source)
    annotate_page(doc, name, spec)
    combined.insert_pdf(doc)
    doc.close()

combined.set_metadata({
    "title": "Plan d'implantation CCTV propose - 94 cameras",
    "author": "Etude d'implantation de videosurveillance",
    "subject": "Implantation des cameras, champs de vision et switchs selon l'architecture retenue",
})
if OUT.exists():
    OUT.unlink()
combined.save(OUT, garbage=4, deflate=True)
combined.close()
print(OUT)
