from pathlib import Path

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
OUTPUT = ROOT / "output" / "pdf" / "CCTV-ARCHITECTURE-EXISTING-INFRASTRUCTURE.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

W, H = landscape(A4)
NAVY = HexColor("#0B1F3A")
BLUE = HexColor("#1565C0")
MAGENTA = HexColor("#D81B60")
GREEN = HexColor("#00897B")
ORANGE = HexColor("#EF6C00")
CYAN = HexColor("#00A8E8")
LIGHT = HexColor("#F4F7FB")
MID = HexColor("#D9E2EF")
TEXT = HexColor("#17212B")
MUTED = HexColor("#5E6B78")

pdfmetrics.registerFont(TTFont("Body", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Body-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

STYLES = {
    "body": ParagraphStyle("body", fontName="Body", fontSize=8.5, leading=11, textColor=TEXT),
    "small": ParagraphStyle("small", fontName="Body", fontSize=7.1, leading=9, textColor=TEXT),
    "tiny": ParagraphStyle("tiny", fontName="Body", fontSize=6.2, leading=7.5, textColor=TEXT),
    "white": ParagraphStyle("white", fontName="Body-Bold", fontSize=8, leading=10, textColor=colors.white),
    "center": ParagraphStyle("center", fontName="Body", fontSize=7, leading=9, alignment=TA_CENTER, textColor=TEXT),
}


def para(text, style="body"):
    return Paragraph(text, STYLES[style])


def header(c, title, page_no):
    c.setFillColor(NAVY)
    c.rect(0, H - 16 * mm, W, 16 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Body-Bold", 15)
    c.drawString(16 * mm, H - 10.5 * mm, title)
    c.setFont("Body", 7)
    c.drawRightString(W - 16 * mm, H - 10 * mm, "CONFIRMED EXISTING BACKBONE - CONCEPT ARCHITECTURE")
    c.setFillColor(MUTED)
    c.drawString(16 * mm, 8 * mm, "CCTV switching and control architecture | Existing copper/fibre infrastructure retained")
    c.drawRightString(W - 16 * mm, 8 * mm, f"Page {page_no} / 4")


def box(c, x, y, w, h, title, body, accent=BLUE):
    c.setFillColor(LIGHT)
    c.setStrokeColor(MID)
    c.roundRect(x, y, w, h, 4 * mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 11 * mm, w, 11 * mm, 4 * mm, fill=1, stroke=0)
    c.rect(x, y + h - 11 * mm, w, 4 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Body-Bold", 9.5)
    c.drawString(x + 5 * mm, y + h - 7.5 * mm, title)
    p = para(body)
    p.wrapOn(c, w - 10 * mm, h - 17 * mm)
    p.drawOn(c, x + 5 * mm, y + 5 * mm)


def node(c, x, y, w, h, title, body, color):
    c.setFillColor(colors.white)
    c.setStrokeColor(color)
    c.setLineWidth(1.4)
    c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=1)
    c.setFillColor(color)
    c.rect(x, y + h - 9 * mm, w, 9 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Body-Bold", 7.5)
    c.drawCentredString(x + w / 2, y + h - 6 * mm, title)
    p = para(body, "center")
    _, ph = p.wrap(w - 6 * mm, h - 12 * mm)
    p.drawOn(c, x + 3 * mm, y + (h - 9 * mm - ph) / 2)


def arrow(c, x1, y1, x2, y2, color=MAGENTA, width=2):
    import math

    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    a = math.atan2(y2 - y1, x2 - x1)
    s = 2.7 * mm
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(x2 + s * math.cos(a + 2.6), y2 + s * math.sin(a + 2.6))
    path.lineTo(x2 + s * math.cos(a - 2.6), y2 + s * math.sin(a - 2.6))
    path.close()
    c.drawPath(path, fill=1, stroke=0)


def table(c, rows, widths, x, top):
    data = []
    for i, row in enumerate(rows):
        data.append([para(str(value), "white" if i == 0 else "small") for value in row])
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.5, MID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    _, th = t.wrapOn(c, sum(widths), H)
    t.drawOn(c, x, top - th)
    return th


c = canvas.Canvas(str(OUTPUT), pagesize=(W, H))
c.setTitle("CCTV Architecture - Existing Infrastructure")
c.setAuthor("OpenAI Codex - architecture prepared from supplied information and drawings")

# Page 1
header(c, "CCTV Architecture - Existing Infrastructure", 1)
c.setFillColor(NAVY)
c.setFont("Body-Bold", 25)
c.drawString(18 * mm, H - 35 * mm, "One central switch. Existing backbone.")
c.setFillColor(MUTED)
c.setFont("Body", 11)
c.drawString(18 * mm, H - 43 * mm, "Equipment and logical-network architecture only - no new copper or fibre installation proposed")

third = (W - 46 * mm) / 3
box(c, 18 * mm, H - 103 * mm, third, 45 * mm, "CENTRAL POINT", "<b>LOCAL SERVEURS - ETAGE</b><br/>One managed central switch aggregates every technical-local switch through the existing backbone and connects the NVR/VMS servers.", BLUE)
box(c, 23 * mm + third, H - 103 * mm, third, 45 * mm, "TECHNICAL LOCALS", "One managed PoE switch at each established technical location, each protected by its own UPS rated at <b>1000 VA / 600 W minimum</b>.", MAGENTA)
box(c, 28 * mm + 2 * third, H - 103 * mm, third, 45 * mm, "CONTROL ROOM", "<b>LOCAL SECURITE - RDC BAS</b><br/>One local operator switch, VMS workstation or decoder, and four displays. Existing RJ45 infrastructure is reused.", GREEN)

box(
    c,
    18 * mm,
    42 * mm,
    W - 36 * mm,
    48 * mm,
    "CONFIRMED DESIGN BASIS",
    "All copper and fibre links from the technical locations to LOCAL SERVEURS are already installed. The architecture therefore starts at the patch panels and active equipment: local cameras connect to the nearest PoE switch; every local switch reaches the central switch through the existing fibre; the central switch joins the full CCTV system; the NVR/VMS and control-room workstation access the same managed network. Existing links must be tested and labelled, but no new backbone route is included in this design.",
    ORANGE,
)
c.setFillColor(HexColor("#E8F5E9"))
c.setStrokeColor(GREEN)
c.roundRect(18 * mm, 18 * mm, W - 36 * mm, 16 * mm, 3 * mm, fill=1, stroke=1)
c.setFillColor(TEXT)
c.setFont("Body-Bold", 8)
c.drawString(23 * mm, 27 * mm, "Architecture decision:")
c.setFont("Body", 8)
c.drawString(57 * mm, 27 * mm, "The server-room switch is the only central aggregation point. The switch in the control room is an access/operator switch, not a second core.")
c.showPage()

# Page 2
header(c, "Logical architecture", 2)
node(c, 91 * mm, 151 * mm, 115 * mm, 29 * mm, "CENTRAL SWITCH - LOCAL SERVEURS", "Managed L3-capable switch<br/>Existing fibre aggregation<br/>NVR / VMS / management", NAVY)

idf_positions = [
    (14, 102, "SW-E1-A", "ETAGE technical local A"),
    (72, 102, "SW-E1-B", "ETAGE technical local B"),
    (130, 102, "SW-RB-A", "RDC BAS technical local A"),
    (188, 102, "SW-RB-B", "RDC BAS technical local B"),
    (43, 57, "SW-RH-A", "RDC HAUT technical local A"),
    (101, 57, "SW-RH-B", "RDC HAUT technical local B"),
]
for x, y, title, subtitle in idf_positions:
    node(c, x * mm, y * mm, 49 * mm, 24 * mm, title, f"{subtitle}<br/>PoE switch + local UPS", MAGENTA)

central = (148.5 * mm, 151 * mm)
targets = [(38.5, 126), (96.5, 126), (154.5, 126), (212.5, 126), (67.5, 81), (125.5, 81)]
for x, y in targets:
    arrow(c, central[0], central[1], x * mm, y * mm, MAGENTA, 1.8)

node(c, 212 * mm, 51 * mm, 68 * mm, 34 * mm, "CONTROL - LOCAL SECURITE", "Operator access switch + UPS<br/>VMS workstation / decoder<br/>4 monitors via HDMI/DP", GREEN)
arrow(c, 212.5 * mm, 102 * mm, 240 * mm, 85 * mm, GREEN, 2.2)

c.setFillColor(MAGENTA)
c.setFont("Body-Bold", 7)
c.drawString(17 * mm, 138 * mm, "EXISTING FIBRE BACKBONE - no new fibre installation in scope")
c.setFillColor(GREEN)
c.drawString(213 * mm, 92 * mm, "Existing RJ45 link")

box(c, 15 * mm, 17 * mm, 182 * mm, 29 * mm, "TRAFFIC FLOW", "Camera -> nearest local PoE switch -> existing fibre -> central switch -> NVR/VMS. Operators view and manage the system from LOCAL SECURITE. All switching remains under one management and VLAN policy.", BLUE)
box(c, 207 * mm, 17 * mm, 74 * mm, 29 * mm, "FOUR MONITORS", "Use one VMS workstation with four GPU outputs or a compatible IP decoder. The screens are display endpoints, not camera switch ports.", GREEN)
c.showPage()

# Page 3
header(c, "Equipment schedule", 3)
rows = [
    ["Location", "Equipment", "Minimum requirement", "Connection"],
    ["LOCAL SERVEURS - ETAGE", "Central switch", "Managed L3-capable switch; sufficient SFP/SFP+ ports for every technical-local uplink; VLAN, ACL, STP/RSTP, SNMP; capacity for NVR/VMS traffic", "All existing fibre uplinks terminate here"],
    ["Each technical local", "Local PoE switch", "Managed PoE+; port count and PoE budget based on cameras in that zone; SFP/SFP+ compatible with installed fibre", "Existing fibre to central switch; camera RJ45 locally"],
    ["Each technical local", "Local UPS", "1000 VA / 600 W minimum; monitored model preferred; design load <=480 W unless manufacturer permits otherwise", "PoE switch and local active accessories"],
    ["LOCAL SECURITE - RDC BAS", "Operator switch", "Managed access switch; ports for VMS workstation, decoder and management equipment; local UPS", "Existing RJ45 from nearest technical local"],
    ["LOCAL SECURITE - RDC BAS", "Operator station", "VMS workstation or decoder with four simultaneous display outputs", "Four monitors via HDMI/DisplayPort"],
    ["LOCAL SERVEURS - ETAGE", "NVR/VMS", "Storage and throughput sized after camera count, resolution, FPS and retention are confirmed", "Central switch server ports"],
]
table(c, rows, [58 * mm, 45 * mm, 112 * mm, 52 * mm], 15 * mm, H - 27 * mm)

box(c, 15 * mm, 18 * mm, 82 * mm, 41 * mm, "UPS RULE", "A 600 W UPS should normally be designed around a maximum continuous load of approximately <b>480 W</b> to retain headroom. If the PoE switch and cameras exceed that load or require longer autonomy, move to 1500 VA or higher.", ORANGE)
box(c, 107 * mm, 18 * mm, 82 * mm, 41 * mm, "POE RULE", "For every local switch: <b>required PoE budget >= sum of camera maximum watts x 1.20</b>. Keep spare ports and spare PoE budget for future cameras. Switch rating and UPS rating are separate checks.", MAGENTA)
box(c, 199 * mm, 18 * mm, 82 * mm, 41 * mm, "EXISTING LINKS", "Before connection, identify both ends, clean fibre connectors, verify optical levels, test every copper link, and confirm that installed SFP optics match the fibre type and link speed.", CYAN)
c.showPage()

# Page 4
header(c, "Network configuration and acceptance", 4)
vlan_rows = [
    ["Logical segment", "Example VLAN", "Devices", "Policy"],
    ["CCTV cameras", "120", "All IP cameras", "Reach NVR/VMS, DNS/NTP and approved management only; no general Internet access"],
    ["VMS / operators", "121", "NVR/VMS, control-room workstation and decoder", "Reach cameras and recording services; role-based operator access"],
    ["Infrastructure management", "199", "Central/local switches and UPS network cards", "Accessible only from authorised administration hosts; SNMPv3, syslog and NTP"],
]
table(c, vlan_rows, [52 * mm, 33 * mm, 73 * mm, 108 * mm], 15 * mm, H - 27 * mm)

box(c, 15 * mm, 75 * mm, 82 * mm, 48 * mm, "CENTRAL SWITCH", "Create the VLAN gateways and ACLs at the central switch or upstream firewall. Mark every existing technical-local uplink as a controlled trunk. Enable loop protection; do not connect a second uncontrolled path from the control room.", BLUE)
box(c, 107 * mm, 75 * mm, 82 * mm, 48 * mm, "DEVICE MANAGEMENT", "Use unique credentials, HTTPS/SSH, current firmware, fixed IPs or DHCP reservations, central NTP, configuration backups and a maintained IP/port/camera register.", GREEN)
box(c, 199 * mm, 75 * mm, 82 * mm, 48 * mm, "RECORDING", "Confirm camera count, codec, resolution, frame rate, bitrate and retention before selecting storage. Test live view, playback, export, alarm display and time synchronisation from the control room.", MAGENTA)

acceptance = [
    ["Acceptance checklist", "Required result"],
    ["Existing fibre and RJ45 identification", "Both ends labelled and mapped to the correct switch ports"],
    ["Link tests", "Copper certification and fibre optical-loss results recorded"],
    ["UPS test", "Actual load and runtime recorded for every technical local"],
    ["Network test", "VLANs, ACLs, management access and loop protection verified"],
    ["CCTV test", "Every camera records, plays back and exports correctly from LOCAL SECURITE"],
]
table(c, acceptance, [116 * mm, 150 * mm], 15 * mm, 66 * mm)

c.setFillColor(HexColor("#FFF4E5"))
c.setStrokeColor(ORANGE)
c.roundRect(15 * mm, 11 * mm, W - 30 * mm, 10 * mm, 2.5 * mm, fill=1, stroke=1)
c.setFillColor(TEXT)
c.setFont("Body-Bold", 6.8)
c.drawString(20 * mm, 17 * mm, "Scope:")
c.setFont("Body", 6.8)
c.drawString(33 * mm, 17 * mm, "Active equipment and logical configuration only. Existing backbone cabling is reused; testing and labelling are acceptance activities, not new installation works.")
c.showPage()

c.save()
print(OUTPUT)
