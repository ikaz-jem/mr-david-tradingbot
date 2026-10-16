from pathlib import Path

import fitz


ROOT = Path(r"D:\development\mr david\mothercompany\enriveatradingbot")
SOURCE_DIR = ROOT / "cctv-cleaned"
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BLUE = (0.07, 0.34, 0.85)
MAGENTA = (0.85, 0.10, 0.38)
GREEN = (0.00, 0.52, 0.38)
ORANGE = (0.95, 0.40, 0.00)
NAVY = (0.04, 0.12, 0.24)
WHITE = (1, 1, 1)
LIGHT = (0.96, 0.98, 1.00)


PLANS = {
    "ETAGE": {
        "source": "421-PE-CFA-PLAN ECF-ETAGE-original.pdf",
        "output": "421-PE-CFA-PLAN ECF-ETAGE-ARCHITECTURE.pdf",
        "nodes": [
            ("MDF", (725, 1967), "LOCAL SERVEURS - core / NVR / fibre ODF", BLUE),
            ("E1-A", (1212, 1955), "CFA riser nearest MDF - PoE switch + UPS", MAGENTA),
            ("E1-B", (1190, 1276), "Opposite CFA riser - PoE switch + UPS", MAGENTA),
        ],
        "fiber": [((725, 1967), (1212, 1955)), ((725, 1967), (1190, 1276))],
        "copper": [],
        "notes": [
            "MDF selected: LOCAL SERVEURS",
            "Two ETAGE IDFs: adjacent cabinets beside CFA risers",
            "OS2 10G star uplinks; do not install rack equipment inside 0.20 m shaft",
        ],
    },
    "RDC BAS": {
        "source": "421-PE-CFA-PLAN ECF-RDC BAS-original.pdf",
        "output": "421-PE-CFA-PLAN ECF-RDC BAS-ARCHITECTURE.pdf",
        "nodes": [
            ("RB-A", (1177, 2039), "CFA riser A - PoE switch + UPS", MAGENTA),
            ("RB-B", (1078, 1344), "CFA riser nearest LOCAL SECURITE - PoE switch + UPS", MAGENTA),
            ("CR", (1488, 1033), "LOCAL SECURITE - VMS + 4 displays + access switch", GREEN),
        ],
        "fiber": [],
        "copper": [((1078, 1344), (1488, 1033))],
        "notes": [
            "Control room selected: LOCAL SECURITE",
            "RB-A and RB-B receive OS2 10G uplinks to MDF on ETAGE",
            "Cat6A RB-B to control switch - verify permanent link <= 90 m",
        ],
    },
    "RDC HAUT": {
        "source": "421-PE-CFA-PLAN ECF-RDC HAUT-original.pdf",
        "output": "421-PE-CFA-PLAN ECF-RDC HAUT-ARCHITECTURE.pdf",
        "nodes": [
            ("RH-A", (1180, 1912), "CFA riser A - PoE switch + UPS", MAGENTA),
            ("RH-B", (1081, 1218), "CFA riser B - PoE switch + UPS", MAGENTA),
        ],
        "fiber": [],
        "copper": [],
        "notes": [
            "Two local PoE IDFs beside the two CFA risers",
            "Each IDF receives OS2 10G star uplink to MDF on ETAGE",
            "1000 VA / 600 W only if measured continuous load <= 480 W",
        ],
    },
}


def add_marker(page, code, point, color):
    x, y = point
    page.draw_circle(
        fitz.Point(x, y),
        31,
        color=color,
        fill=WHITE,
        width=8,
        fill_opacity=0.92,
        overlay=True,
    )
    rect = fitz.Rect(x - 30, y - 30, x + 30, y + 30)
    page.insert_textbox(
        rect,
        code,
        fontsize=15 if len(code) > 3 else 18,
        fontname="hebo",
        color=color,
        rotate=270,
        align=1,
        overlay=True,
    )


def add_panel(page, title, nodes, notes):
    # Underlying pages are portrait with Rotate 270; this rectangle renders at upper-left.
    panel = fitz.Rect(1775, 120, 2325, 1040)
    page.draw_rect(panel, color=NAVY, fill=LIGHT, width=5, fill_opacity=0.96, overlay=True)
    page.draw_rect(fitz.Rect(1775, 120, 1865, 1040), color=NAVY, fill=NAVY, width=0, overlay=True)
    page.insert_textbox(
        fitz.Rect(1792, 150, 1848, 1015),
        "CCTV NETWORK ARCHITECTURE - CONCEPT",
        fontsize=24,
        fontname="hebo",
        color=WHITE,
        rotate=270,
        align=1,
        overlay=True,
    )
    lines = [f"PLAN: {title}", "", "NODES"]
    lines.extend(f"{code}: {description}" for code, _, description, _ in nodes)
    lines.extend(["", "CABLING"] + notes)
    lines.extend(["", "Legend: magenta = fibre; green = Cat6A", "CONCEPT ONLY - routes require site survey"])
    page.insert_textbox(
        fitz.Rect(1885, 155, 2295, 1010),
        "\n".join(lines),
        fontsize=17,
        fontname="helv",
        color=NAVY,
        rotate=270,
        align=0,
        lineheight=1.25,
        overlay=True,
    )


for title, spec in PLANS.items():
    source = SOURCE_DIR / spec["source"]
    destination = OUTPUT_DIR / spec["output"]
    doc = fitz.open(source)
    page = doc[0]
    # Isolate the supplied content streams so their final graphics / OCG state
    # cannot leak into the concept overlay appended below.
    page.wrap_contents()

    for start, end in spec["fiber"]:
        page.draw_line(
            fitz.Point(*start),
            fitz.Point(*end),
            color=MAGENTA,
            width=7,
            dashes="[18 12] 0",
            stroke_opacity=0.82,
            overlay=True,
        )
    for start, end in spec["copper"]:
        page.draw_line(
            fitz.Point(*start),
            fitz.Point(*end),
            color=GREEN,
            width=7,
            dashes="[10 8] 0",
            stroke_opacity=0.85,
            overlay=True,
        )

    for code, point, description, color in spec["nodes"]:
        add_marker(page, code, point, color)

    add_panel(page, title, spec["nodes"], spec["notes"])

    doc.set_metadata(
        {
            **doc.metadata,
            "title": f"{title} - CCTV network architecture concept",
            "subject": "Concept overlay for MDF, IDF, fibre backbone, UPS and control room",
        }
    )
    if destination.exists():
        destination.unlink()
    doc.save(destination, garbage=4, deflate=True)
    doc.close()
    print(destination)
