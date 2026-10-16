from pathlib import Path
import math

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(r"D:\development\mr david\mothercompany\enriveatradingbot")
OUTPUT = ROOT / "output" / "pdf" / "ARCHITECTURE-INFRASTRUCTURE-VIDEOSURVEILLANCE-FR.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

W, H = landscape(A4)
NAVY = HexColor("#10243E")
BLUE = HexColor("#1769AA")
FIBRE = HexColor("#D14A8C")
GREEN = HexColor("#16856B")
GOLD = HexColor("#D08A16")
PALE = HexColor("#F4F7FB")
LINE = HexColor("#D5DFEA")
TEXT = HexColor("#1B2733")
MUTED = HexColor("#647383")

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

styles = {
    "body": ParagraphStyle("body", fontName="Arial", fontSize=8.2, leading=10.4, textColor=TEXT),
    "small": ParagraphStyle("small", fontName="Arial", fontSize=7.2, leading=9, textColor=TEXT),
    "center": ParagraphStyle("center", fontName="Arial", fontSize=7.1, leading=8.8, alignment=TA_CENTER, textColor=TEXT),
    "white": ParagraphStyle("white", fontName="Arial-Bold", fontSize=7.4, leading=9, textColor=colors.white),
    "cellhead": ParagraphStyle("cellhead", fontName="Arial-Bold", fontSize=7.4, leading=9, textColor=TEXT),
}


def p(text, style="body"):
    return Paragraph(text, styles[style])


def page_header(c, title, subtitle, page_no):
    c.setFillColor(NAVY)
    c.rect(0, H - 18 * mm, W, 18 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 15)
    c.drawString(15 * mm, H - 9.4 * mm, title)
    c.setFont("Arial", 7.4)
    c.drawRightString(W - 15 * mm, H - 9.2 * mm, subtitle)
    c.setFillColor(MUTED)
    c.setFont("Arial", 6.8)
    c.drawString(15 * mm, 7 * mm, "Architecture de vidéosurveillance — infrastructure existante")
    c.drawRightString(W - 15 * mm, 7 * mm, f"Page {page_no} / 2")


def rounded_node(c, x, y, w, h, title, body, accent=BLUE, fill=colors.white):
    c.setFillColor(fill)
    c.setStrokeColor(accent)
    c.setLineWidth(1.3)
    c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 9 * mm, w, 9 * mm, 3 * mm, fill=1, stroke=0)
    c.rect(x, y + h - 9 * mm, w, 3 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Arial-Bold", 7.4)
    c.drawCentredString(x + w / 2, y + h - 6.1 * mm, title)
    para = p(body, "center")
    _, ph = para.wrap(w - 6 * mm, h - 12 * mm)
    para.drawOn(c, x + 3 * mm, y + (h - 9 * mm - ph) / 2)


def arrow(c, x1, y1, x2, y2, color, width=1.8, both=False):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)

    def head(ax, ay, angle):
        size = 2.4 * mm
        path = c.beginPath()
        path.moveTo(ax, ay)
        path.lineTo(ax + size * math.cos(angle + 2.62), ay + size * math.sin(angle + 2.62))
        path.lineTo(ax + size * math.cos(angle - 2.62), ay + size * math.sin(angle - 2.62))
        path.close()
        c.drawPath(path, fill=1, stroke=0)

    ang = math.atan2(y2 - y1, x2 - x1)
    head(x2, y2, ang)
    if both:
        head(x1, y1, ang + math.pi)


def section_title(c, x, y, text, color=BLUE):
    c.setFillColor(color)
    c.roundRect(x, y - 7 * mm, 4 * mm, 7 * mm, 1.5 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("Arial-Bold", 11)
    c.drawString(x + 7 * mm, y - 5.2 * mm, text)


def draw_table(c, rows, widths, x, top):
    data = []
    for r, row in enumerate(rows):
        style = "white" if r == 0 else "small"
        data.append([p(str(cell), style) for cell in row])
    tbl = Table(data, colWidths=widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    _, h = tbl.wrapOn(c, sum(widths), H)
    tbl.drawOn(c, x, top - h)
    return h


c = canvas.Canvas(str(OUTPUT), pagesize=(W, H))
c.setTitle("Architecture infrastructure de vidéosurveillance")
c.setAuthor("Dossier d'architecture — infrastructure existante")
c.setSubject("Architecture réseau CCTV en français")

# PAGE 1 — Schéma général
page_header(c, "ARCHITECTURE INFRASTRUCTURE DE VIDÉOSURVEILLANCE", "Réseau unique — câblage existant", 1)

c.setFillColor(NAVY)
c.setFont("Arial-Bold", 19)
c.drawString(15 * mm, H - 31 * mm, "Schéma général de raccordement")
c.setFillColor(MUTED)
c.setFont("Arial", 8.8)
c.drawString(15 * mm, H - 38 * mm, "Les liaisons cuivre et fibre optique déjà établies sont utilisées par l'ensemble de l'installation.")

# Central server room
rounded_node(
    c, 99 * mm, 137 * mm, 99 * mm, 34 * mm,
    "LOCAL SERVEURS — ÉTAGE",
    "<b>Switch central uniquement</b><br/>Onduleur dédié<br/>Point central des liaisons fibre optique",
    NAVY, HexColor("#F7FAFD")
)

# Technical switches: two on each plan level
technical = [
    (13, 108, "LOCAL TECHNIQUE E1-A", "Switch PoE + onduleur 1000 VA / 600 W+"),
    (13, 89, "LOCAL TECHNIQUE E1-B", "Switch PoE + onduleur 1000 VA / 600 W+"),
    (13, 70, "LOCAL TECHNIQUE RB-A", "Switch PoE + onduleur 1000 VA / 600 W+"),
    (13, 51, "LOCAL TECHNIQUE RB-B", "Switch PoE + onduleur 1000 VA / 600 W+"),
    (13, 32, "LOCAL TECHNIQUE RH-A", "Switch PoE + onduleur 1000 VA / 600 W+"),
    (13, 13, "LOCAL TECHNIQUE RH-B", "Switch PoE + onduleur 1000 VA / 600 W+"),
]
for x, y, title, body in technical:
    rounded_node(c, x * mm, y * mm, 58 * mm, 17 * mm, title, body, BLUE)

# Fibre bus and connections
bus_x = 86 * mm
c.setStrokeColor(FIBRE)
c.setLineWidth(2.2)
c.line(bus_x, 21.5 * mm, bus_x, 137 * mm)
c.setFillColor(FIBRE)
c.setFont("Arial-Bold", 6.8)
c.saveState()
c.translate(bus_x + 4 * mm, 78 * mm)
c.rotate(90)
c.drawCentredString(0, 0, "FIBRE OPTIQUE EXISTANTE")
c.restoreState()

for x, y, _, _ in technical:
    sx = (x + 58) * mm
    sy = (y + 8.5) * mm
    arrow(c, sx, sy, bus_x, sy, FIBRE, 1.5, both=True)
arrow(c, bus_x, 137 * mm, 99 * mm, 137 * mm, FIBRE, 2, both=True)

# Control room on same floor as server room
rounded_node(
    c, 211 * mm, 104 * mm, 71 * mm, 51 * mm,
    "SALLE DE CONTRÔLE — « A DÉFINIR »",
    "Même étage que le LOCAL SERVEURS<br/><b>Switch de contrôle + son onduleur</b><br/>NVR ou serveur VMS<br/>Onduleur NVR séparé si configuration NVR<br/>Baies de stockage<br/><b>Onduleur supplémentaire exclusivement dédié aux baies</b><br/>Poste de supervision + <b>4 écrans</b>",
    GREEN, HexColor("#F4FBF8")
)
rounded_node(
    c, 217 * mm, 57 * mm, 59 * mm, 28 * mm,
    "GAINE TECHNIQUE CFA PROCHE",
    "1.00 x 0.20 x h<br/>Départ RJ45 existant",
    GOLD, HexColor("#FFFBF1")
)
arrow(c, 246.5 * mm, 85 * mm, 246.5 * mm, 104 * mm, GOLD, 2, both=True)
c.setFillColor(GOLD)
c.setFont("Arial-Bold", 6.8)
c.drawString(250 * mm, 93 * mm, "RJ45 existant")

# Control link to central network
arrow(c, 198 * mm, 147 * mm, 211 * mm, 137 * mm, GREEN, 2, both=True)

c.setFillColor(HexColor("#EAF1F8"))
c.setStrokeColor(LINE)
c.roundRect(153 * mm, 18 * mm, 129 * mm, 26 * mm, 3 * mm, fill=1, stroke=1)
flow = p("<b>Flux de raccordement :</b><br/>Caméras → RJ45 existant → switch local PoE → fibre optique existante → switch central → salle de contrôle « A DÉFINIR » → NVR/VMS et baies de stockage → 4 écrans", "body")
flow.wrapOn(c, 119 * mm, 20 * mm)
flow.drawOn(c, 158 * mm, 23 * mm)

c.showPage()

# PAGE 2 — Structure de l'installation
page_header(c, "STRUCTURE DE L'INSTALLATION", "Implantation et composition", 2)

section_title(c, 15 * mm, H - 29 * mm, "Implantation des équipements")
rows = [
    ["Emplacement", "Équipements installés", "Raccordement dans l'architecture"],
    ["Chaque local technique", "1 switch local PoE<br/>1 onduleur 1000 VA / 600 W+", "Caméras par RJ45 existant<br/>Uplink par fibre optique existante vers le switch central"],
    ["LOCAL SERVEURS — ÉTAGE", "1 switch central uniquement<br/>1 onduleur pour le switch central", "Réunit toutes les fibres optiques provenant des locaux techniques et centralise le réseau"],
    ["Salle de contrôle « A DÉFINIR » — ÉTAGE", "1 switch de contrôle + son onduleur<br/>1 NVR ou serveur VMS<br/>1 onduleur NVR séparé si configuration NVR<br/>Baies de stockage<br/>1 onduleur supplémentaire exclusivement dédié aux baies de stockage<br/>1 poste de supervision + 4 écrans", "RJ45 existant depuis la gaine technique CFA proche<br/>Connexion au même réseau de vidéosurveillance"],
]
draw_table(c, rows, [67 * mm, 83 * mm, 116 * mm], 15 * mm, H - 39 * mm)

section_title(c, 15 * mm, 91 * mm, "Organisation par niveau")
level_rows = [
    ["Niveau", "Points techniques", "Chemin réseau"],
    ["ÉTAGE", "Deux locaux techniques + LOCAL SERVEURS + salle de contrôle « A DÉFINIR »", "Switchs locaux → fibre existante → switch central<br/>Gaine CFA proche → RJ45 existant → switch de contrôle → NVR/VMS et stockage"],
    ["RDC BAS", "Deux locaux techniques", "Switchs locaux → fibre optique existante → switch central au LOCAL SERVEURS"],
    ["RDC HAUT", "Deux locaux techniques", "Switchs locaux → fibre optique existante → switch central au LOCAL SERVEURS"],
]
draw_table(c, level_rows, [47 * mm, 100 * mm, 119 * mm], 15 * mm, 82 * mm)

# Bottom statement
c.setFillColor(NAVY)
c.roundRect(15 * mm, 14 * mm, W - 30 * mm, 22 * mm, 3 * mm, fill=1, stroke=0)
c.setFillColor(colors.white)
c.setFont("Arial-Bold", 9.2)
c.drawString(21 * mm, 28 * mm, "PRINCIPE D'ENSEMBLE")
statement = p(
    "Total : <b>8 switchs</b> (6 locaux + 1 central + 1 contrôle). Configuration NVR : <b>10 onduleurs</b> (8 pour les switchs + 1 réservé au NVR + 1 supplémentaire exclusivement réservé aux baies de stockage). Configuration VMS seul : <b>9 onduleurs</b> (8 pour les switchs + 1 exclusivement pour les baies). Aucun de ces onduleurs n'est partagé.",
    "white",
)
statement.wrapOn(c, W - 48 * mm, 10 * mm)
statement.drawOn(c, 21 * mm, 17 * mm)

c.showPage()
c.save()
print(OUTPUT)
