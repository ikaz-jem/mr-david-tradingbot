from pathlib import Path
import math

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(r"D:\development\mr david\mothercompany\enriveatradingbot")
OUTPUT = ROOT / "output" / "pdf" / "ARCHITECTURE-RACCORDEMENT-CONTROLE-ACCES-FR.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

W, H = landscape(A4)
NAVY = HexColor("#10243E")
BLUE = HexColor("#1769AA")
ACCESS = HexColor("#E76F00")
MAGENTA = HexColor("#C2185B")
GREEN = HexColor("#15866B")
PALE = HexColor("#F4F7FB")
PALE_ORANGE = HexColor("#FFF5E8")
LINE = HexColor("#D3DEE9")
TEXT = HexColor("#1B2733")
MUTED = HexColor("#647383")

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

styles = {
    "body": ParagraphStyle("body", fontName="Arial", fontSize=8.2, leading=10.4, textColor=TEXT),
    "small": ParagraphStyle("small", fontName="Arial", fontSize=7.2, leading=9, textColor=TEXT),
    "center": ParagraphStyle("center", fontName="Arial", fontSize=7.0, leading=8.5, alignment=TA_CENTER, textColor=TEXT),
    "white": ParagraphStyle("white", fontName="Arial-Bold", fontSize=7.4, leading=9, textColor=colors.white),
}


def p(text, style="body"):
    return Paragraph(text, styles[style])


def header(c, title, subtitle, page_no):
    c.setFillColor(NAVY)
    c.rect(0, H - 18 * mm, W, 18 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 15)
    c.drawString(15 * mm, H - 9.4 * mm, title)
    c.setFont("Arial", 7.4)
    c.drawRightString(W - 15 * mm, H - 9.2 * mm, subtitle)
    c.setFillColor(MUTED)
    c.setFont("Arial", 6.8)
    c.drawString(15 * mm, 7 * mm, "Architecture de raccordement - contrôle d'accès sur VLAN dédié")
    c.drawRightString(W - 15 * mm, 7 * mm, f"Page {page_no} / 2")


def node(c, x, y, w, h, title, body, accent, fill=colors.white):
    c.setFillColor(fill)
    c.setStrokeColor(accent)
    c.setLineWidth(1.25)
    c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 8 * mm, w, 8 * mm, 3 * mm, fill=1, stroke=0)
    c.rect(x, y + h - 8 * mm, w, 3 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 7.2)
    c.drawCentredString(x + w / 2, y + h - 5.5 * mm, title)
    para = p(body, "center")
    _, ph = para.wrap(w - 5 * mm, h - 11 * mm)
    para.drawOn(c, x + 2.5 * mm, y + (h - 8 * mm - ph) / 2)


def arrow(c, x1, y1, x2, y2, colour, width=1.8, both=False, dashed=False):
    c.setStrokeColor(colour)
    c.setFillColor(colour)
    c.setLineWidth(width)
    c.setDash(5, 3) if dashed else c.setDash()
    c.line(x1, y1, x2, y2)
    c.setDash()

    def head(ax, ay, angle):
        size = 2.2 * mm
        path = c.beginPath()
        path.moveTo(ax, ay)
        path.lineTo(ax + size * math.cos(angle + 2.62), ay + size * math.sin(angle + 2.62))
        path.lineTo(ax + size * math.cos(angle - 2.62), ay + size * math.sin(angle - 2.62))
        path.close()
        c.drawPath(path, fill=1, stroke=0)

    angle = math.atan2(y2 - y1, x2 - x1)
    head(x2, y2, angle)
    if both:
        head(x1, y1, angle + math.pi)


def local_pair(c, x, y, code):
    node(
        c, x, y + 19 * mm, 48 * mm, 17 * mm,
        f"SWITCH CCTV {code}",
        "Ports caméras<br/><b>Port 23 ou 24 réservé</b>",
        BLUE,
    )
    node(
        c, x, y, 48 * mm, 17 * mm,
        f"SWITCH ACCÈS {code}",
        "16 ports<br/>VLAN CONTRÔLE D'ACCÈS",
        ACCESS,
        PALE_ORANGE,
    )
    arrow(c, x + 24 * mm, y + 17 * mm, x + 24 * mm, y + 19 * mm, ACCESS, 2.1, both=True)
    c.setFillColor(ACCESS)
    c.setFont("Arial-Bold", 5.8)
    c.drawString(x + 27 * mm, y + 17.3 * mm, "RJ45")


def table(c, rows, widths, x, top):
    data = []
    for row_index, row in enumerate(rows):
        data.append([p(str(value), "white" if row_index == 0 else "small") for value in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    _, height = t.wrapOn(c, sum(widths), H)
    t.drawOn(c, x, top - height)
    return height


c = canvas.Canvas(str(OUTPUT), pagesize=(W, H))
c.setTitle("Architecture de raccordement du contrôle d'accès")
c.setAuthor("Dossier d'architecture - infrastructure commune et VLAN séparé")
c.setSubject("Six switchs de contrôle d'accès reliés aux switchs CCTV locaux")

# PAGE 1 - Architecture générale
header(c, "ARCHITECTURE DE RACCORDEMENT DU CONTRÔLE D'ACCÈS", "6 switchs locaux - VLAN dédié", 1)
c.setFillColor(NAVY)
c.setFont("Arial-Bold", 18)
c.drawString(15 * mm, H - 31 * mm, "Raccordement global sur l'infrastructure vidéosurveillance")
c.setFillColor(MUTED)
c.setFont("Arial", 8.5)
c.drawString(15 * mm, H - 38 * mm, "Même infrastructure physique, séparation logique par VLAN CONTRÔLE D'ACCÈS.")

# Local pairs - two per level
positions = [
    (8, 115, "E1-A"), (70, 115, "E1-B"),
    (8, 72, "RB-A"), (70, 72, "RB-B"),
    (8, 29, "RH-A"), (70, 29, "RH-B"),
]
for x, y, code in positions:
    local_pair(c, x * mm, y * mm, code)

# Fibre aggregation bus from CCTV switches
bus_x = 63 * mm
c.setStrokeColor(MAGENTA)
c.setLineWidth(2.2)
c.line(bus_x, 55 * mm, bus_x, 165 * mm)
c.setFillColor(MAGENTA)
c.saveState()
c.translate(bus_x + 4 * mm, 105 * mm)
c.rotate(90)
c.setFont("Arial-Bold", 6.7)
c.drawCentredString(0, 0, "FIBRE EXISTANTE - TRUNK VLAN CCTV + VLAN ACCÈS")
c.restoreState()
for x, y, _ in positions:
    # Fibre departs from each CCTV switch, not from the 16-port access switch.
    if x < 63:
        start_x = (x + 48) * mm
    else:
        start_x = x * mm
    arrow(c, start_x, (y + 27.5) * mm, bus_x, (y + 27.5) * mm, MAGENTA, 1.4, both=True)

# Central server room
node(
    c, 143 * mm, 134 * mm, 66 * mm, 29 * mm,
    "LOCAL SERVEURS - ÉTAGE",
    "<b>Switch central</b><br/>Agrégation des 6 switchs CCTV<br/>Transport des deux VLANs",
    NAVY,
    HexColor("#F7FAFD"),
)
arrow(c, bus_x, 165 * mm, 176 * mm, 163 * mm, MAGENTA, 2.1, both=True)

# Control room
node(
    c, 224 * mm, 118 * mm, 58 * mm, 45 * mm,
    "SALLE DE CONTRÔLE - « A DÉFINIR »",
    "Switch de la salle vidéosurveillance<br/><b>Port affecté au VLAN ACCÈS</b><br/>PC de contrôle d'accès",
    GREEN,
    HexColor("#F2FBF7"),
)
arrow(c, 209 * mm, 148.5 * mm, 224 * mm, 148.5 * mm, MAGENTA, 2.1, both=True)

# PC endpoint
node(
    c, 224 * mm, 70 * mm, 58 * mm, 29 * mm,
    "POSTE CONTRÔLE D'ACCÈS",
    "PC opérateur<br/>RJ45 depuis le switch de la salle<br/>VLAN CONTRÔLE D'ACCÈS",
    ACCESS,
    PALE_ORANGE,
)
arrow(c, 253 * mm, 118 * mm, 253 * mm, 99 * mm, ACCESS, 2.3, both=True)

# Logical path ribbon
c.setFillColor(PALE_ORANGE)
c.setStrokeColor(ACCESS)
c.roundRect(143 * mm, 31 * mm, 66 * mm, 78 * mm, 3 * mm, fill=1, stroke=1)
c.setFillColor(ACCESS)
c.setFont("Arial-Bold", 9)
c.drawString(149 * mm, 99 * mm, "CHEMIN DU VLAN ACCÈS")
flow = p(
    "1. Équipement de contrôle d'accès<br/>"
    "2. Switch accès 16 ports du local<br/>"
    "3. RJ45 vers port 23 ou 24 du switch CCTV<br/>"
    "4. Fibre existante vers le switch central<br/>"
    "5. Liaison réseau vers la salle de contrôle<br/>"
    "6. Port VLAN ACCÈS vers le PC opérateur",
    "body",
)
flow.wrapOn(c, 54 * mm, 60 * mm)
flow.drawOn(c, 149 * mm, 41 * mm)

c.setFillColor(NAVY)
c.roundRect(216 * mm, 26 * mm, 66 * mm, 29 * mm, 3 * mm, fill=1, stroke=0)
c.setFillColor(colors.white)
c.setFont("Arial-Bold", 8.5)
c.drawString(222 * mm, 46 * mm, "RÉSULTAT")
result = p(
    "Les 6 switchs de contrôle d'accès rejoignent le même réseau physique que la vidéosurveillance, tout en restant isolés dans leur propre VLAN.",
    "white",
)
result.wrapOn(c, 54 * mm, 16 * mm)
result.drawOn(c, 222 * mm, 31 * mm)
c.showPage()

# PAGE 2 - Détail d'un local et affectation des ports
header(c, "DÉTAIL DE RACCORDEMENT D'UN LOCAL TECHNIQUE", "Principe identique dans les 6 locaux", 2)
c.setFillColor(NAVY)
c.setFont("Arial-Bold", 17)
c.drawString(15 * mm, H - 31 * mm, "Affectation physique et logique")

# Detailed local diagram
node(
    c, 16 * mm, 104 * mm, 63 * mm, 48 * mm,
    "SWITCH CONTRÔLE D'ACCÈS - 16 PORTS",
    "Ports 1 à 15 : équipements de contrôle d'accès<br/><br/><b>Port 16 : uplink RJ45</b><br/>vers le switch vidéosurveillance local",
    ACCESS,
    PALE_ORANGE,
)
node(
    c, 108 * mm, 104 * mm, 63 * mm, 48 * mm,
    "SWITCH VIDÉOSURVEILLANCE LOCAL",
    "Ports caméras selon implantation<br/><br/><b>Port 23 ou port 24 réservé</b><br/>VLAN CONTRÔLE D'ACCÈS",
    BLUE,
)
arrow(c, 79 * mm, 128 * mm, 108 * mm, 128 * mm, ACCESS, 2.7, both=True)
c.setFillColor(ACCESS)
c.setFont("Arial-Bold", 7.2)
c.drawCentredString(93.5 * mm, 134 * mm, "CÂBLE RJ45 LOCAL")
c.drawCentredString(93.5 * mm, 121 * mm, "VLAN CONTRÔLE D'ACCÈS")

node(
    c, 201 * mm, 104 * mm, 78 * mm, 48 * mm,
    "UPLINK FIBRE EXISTANT",
    "Trunk 802.1Q transportant :<br/><b>VLAN VIDÉOSURVEILLANCE</b><br/><b>VLAN CONTRÔLE D'ACCÈS</b><br/>vers le switch central",
    MAGENTA,
    HexColor("#FFF3F8"),
)
arrow(c, 171 * mm, 128 * mm, 201 * mm, 128 * mm, MAGENTA, 2.7, both=True)

# Endpoint chain below
node(c, 16 * mm, 66 * mm, 63 * mm, 23 * mm, "ÉQUIPEMENTS D'ACCÈS", "Contrôleurs / interfaces IP<br/>raccordés au switch 16 ports", ACCESS, PALE_ORANGE)
arrow(c, 47.5 * mm, 89 * mm, 47.5 * mm, 104 * mm, ACCESS, 2.0, both=True)
node(c, 201 * mm, 66 * mm, 78 * mm, 23 * mm, "DESTINATION", "Switch central → switch salle de contrôle<br/>→ PC contrôle d'accès", GREEN, HexColor("#F2FBF7"))
arrow(c, 240 * mm, 104 * mm, 240 * mm, 89 * mm, GREEN, 2.0, both=True)

# Port schedule
c.setFillColor(NAVY)
c.setFont("Arial-Bold", 11)
c.drawString(16 * mm, 53 * mm, "Table d'affectation")
rows = [
    ["Équipement", "Port", "Affectation", "VLAN / liaison"],
    ["Switch contrôle d'accès 16 ports", "1 à 15", "Équipements de contrôle d'accès du local", "VLAN CONTRÔLE D'ACCÈS"],
    ["Switch contrôle d'accès 16 ports", "16", "Uplink RJ45 vers switch CCTV local", "VLAN CONTRÔLE D'ACCÈS"],
    ["Switch CCTV local", "23 ou 24", "Port réservé au switch de contrôle d'accès", "VLAN CONTRÔLE D'ACCÈS"],
    ["Switch CCTV local", "Uplink fibre", "Vers switch central du LOCAL SERVEURS", "Trunk : VLAN CCTV + VLAN ACCÈS"],
    ["Switch salle de contrôle", "Port PC", "PC de contrôle d'accès", "Port d'accès dans le VLAN CONTRÔLE D'ACCÈS"],
]
table(c, rows, [62 * mm, 30 * mm, 94 * mm, 80 * mm], 16 * mm, 48 * mm)
c.showPage()

c.save()
print(OUTPUT)
