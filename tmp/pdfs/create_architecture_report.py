from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(r"D:\development\mr david\mothercompany\enriveatradingbot")
OUTPUT = ROOT / "output" / "pdf" / "CCTV-NETWORK-ARCHITECTURE-CONCEPT.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

PAGE_W, PAGE_H = landscape(A4)
NAVY = HexColor("#0B1F3A")
BLUE = HexColor("#1565C0")
CYAN = HexColor("#00A8E8")
MAGENTA = HexColor("#D81B60")
GREEN = HexColor("#00897B")
ORANGE = HexColor("#EF6C00")
LIGHT = HexColor("#F4F7FB")
MID = HexColor("#D9E2EF")
TEXT = HexColor("#17212B")
MUTED = HexColor("#5E6B78")

pdfmetrics.registerFont(TTFont("DejaVu", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", r"C:\Windows\Fonts\arialbd.ttf"))


styles = {
    "body": ParagraphStyle(
        "body", fontName="DejaVu", fontSize=8.5, leading=11, textColor=TEXT
    ),
    "small": ParagraphStyle(
        "small", fontName="DejaVu", fontSize=7, leading=9, textColor=TEXT
    ),
    "tiny": ParagraphStyle(
        "tiny", fontName="DejaVu", fontSize=6.2, leading=7.5, textColor=TEXT
    ),
    "white": ParagraphStyle(
        "white", fontName="DejaVu", fontSize=8, leading=10, textColor=colors.white
    ),
    "white_bold": ParagraphStyle(
        "white_bold", fontName="DejaVu-Bold", fontSize=9, leading=11, textColor=colors.white
    ),
    "center": ParagraphStyle(
        "center", fontName="DejaVu", fontSize=7, leading=9, alignment=TA_CENTER, textColor=TEXT
    ),
}


def p(text, style="body"):
    return Paragraph(text, styles[style])


def page_header(c, title, page_no):
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H - 16 * mm, PAGE_W, 16 * mm, fill=1, stroke=0)
    c.setFont("DejaVu-Bold", 15)
    c.setFillColor(colors.white)
    c.drawString(16 * mm, PAGE_H - 10.5 * mm, title)
    c.setFont("DejaVu", 7)
    c.drawRightString(PAGE_W - 16 * mm, PAGE_H - 10 * mm, "CONCEPT - NOT FOR CONSTRUCTION")
    c.setFillColor(MUTED)
    c.setFont("DejaVu", 7)
    c.drawString(16 * mm, 8 * mm, "CCTV network concept | Based on ECF ETAGE / RDC BAS / RDC HAUT drawings")
    c.drawRightString(PAGE_W - 16 * mm, 8 * mm, f"Page {page_no} / 6")


def rounded_box(c, x, y, w, h, title, body, accent=BLUE):
    c.setFillColor(LIGHT)
    c.setStrokeColor(MID)
    c.roundRect(x, y, w, h, 4 * mm, fill=1, stroke=1)
    c.setFillColor(accent)
    c.roundRect(x, y + h - 12 * mm, w, 12 * mm, 4 * mm, fill=1, stroke=0)
    c.rect(x, y + h - 12 * mm, w, 5 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("DejaVu-Bold", 10)
    c.drawString(x + 5 * mm, y + h - 8 * mm, title)
    para = p(body, "body")
    para.wrapOn(c, w - 10 * mm, h - 18 * mm)
    para.drawOn(c, x + 5 * mm, y + 5 * mm)


def draw_switch(c, x, y, w, h, title, subtitle, color=BLUE):
    c.setStrokeColor(color)
    c.setFillColor(colors.white)
    c.roundRect(x, y, w, h, 3 * mm, fill=1, stroke=1)
    c.setFillColor(color)
    c.rect(x, y + h - 9 * mm, w, 9 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("DejaVu-Bold", 7.5)
    c.drawCentredString(x + w / 2, y + h - 6 * mm, title)
    c.setFillColor(TEXT)
    c.setFont("DejaVu", 6.5)
    lines = subtitle.split("\n")
    for index, line in enumerate(lines):
        c.drawCentredString(x + w / 2, y + h - 14 * mm - index * 4 * mm, line)


def arrow(c, x1, y1, x2, y2, color=MAGENTA, dashed=False, width=2):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.setDash(5, 3) if dashed else c.setDash()
    c.line(x1, y1, x2, y2)
    import math

    angle = math.atan2(y2 - y1, x2 - x1)
    size = 3 * mm
    a1 = angle + 2.6
    a2 = angle - 2.6
    path = c.beginPath()
    path.moveTo(x2, y2)
    path.lineTo(x2 + size * math.cos(a1), y2 + size * math.sin(a1))
    path.lineTo(x2 + size * math.cos(a2), y2 + size * math.sin(a2))
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    c.setDash()


def draw_table(c, data, col_widths, x, y_top, row_heights=None, header=True, font_size=7):
    cooked = []
    for row_no, row in enumerate(data):
        cooked.append([p(str(cell), "white_bold" if header and row_no == 0 else "small") for cell in row])
    table = Table(cooked, colWidths=col_widths, rowHeights=row_heights, repeatRows=1 if header else 0)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY if header else colors.white),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white if header else TEXT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, MID),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    tw, th = table.wrapOn(c, sum(col_widths), PAGE_H)
    table.drawOn(c, x, y_top - th)
    return th


c = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_W, PAGE_H))
c.setTitle("CCTV Network and Installation Architecture - Concept")
c.setAuthor("OpenAI Codex - concept prepared from supplied drawings")

# Page 1
page_header(c, "CCTV Network & Installation Architecture", 1)
c.setFillColor(NAVY)
c.setFont("DejaVu-Bold", 26)
c.drawString(18 * mm, PAGE_H - 35 * mm, "Concept design")
c.setFillColor(MUTED)
c.setFont("DejaVu", 11)
c.drawString(18 * mm, PAGE_H - 43 * mm, "Core, fibre backbone, local PoE distribution, UPS protection and surveillance control room")

box_w = (PAGE_W - 46 * mm) / 3
rounded_box(
    c,
    18 * mm,
    PAGE_H - 104 * mm,
    box_w,
    47 * mm,
    "MDF / CORE",
    "<b>LOCAL SERVEURS - ETAGE</b><br/>Collapsed core/distribution, NVR/VMS servers, fibre patch panels and network security boundary.",
    BLUE,
)
rounded_box(
    c,
    23 * mm + box_w,
    PAGE_H - 104 * mm,
    box_w,
    47 * mm,
    "CONTROL ROOM",
    "<b>LOCAL SECURITE - RDC BAS</b><br/>Four-display operator position, VMS workstation/decoder and a local managed access switch.",
    GREEN,
)
rounded_box(
    c,
    28 * mm + 2 * box_w,
    PAGE_H - 104 * mm,
    box_w,
    47 * mm,
    "LOCAL DISTRIBUTION",
    "<b>Six IDF nodes</b><br/>Two CFA riser positions per level; each node receives one managed PoE+ switch and one local UPS.",
    MAGENTA,
)

rounded_box(
    c,
    18 * mm,
    39 * mm,
    PAGE_W - 36 * mm,
    54 * mm,
    "DESIGN POSITION",
    "The proposed architecture is sound if implemented as a <b>star fibre backbone</b> from every IDF to the MDF. "
    "Keep all CCTV equipment on the same physical infrastructure but segment it using dedicated VLANs and server-side ACLs. "
    "The switch in the control room is an <b>operator/access switch</b>, not a second independent core. The nearest RDC BAS IDF may feed it by Cat6A only after the permanent-link length is verified at 90 m or less. "
    "A 1000 VA / 600 W UPS is acceptable only where measured continuous load is 480 W or less; larger PoE loads or longer runtime require 1500 VA or greater.",
    ORANGE,
)
c.setFillColor(HexColor("#FFF4E5"))
c.setStrokeColor(ORANGE)
c.roundRect(18 * mm, 18 * mm, PAGE_W - 36 * mm, 15 * mm, 3 * mm, fill=1, stroke=1)
c.setFillColor(TEXT)
c.setFont("DejaVu-Bold", 8)
c.drawString(23 * mm, 27 * mm, "Site constraint:")
c.setFont("DejaVu", 8)
c.drawString(48 * mm, 27 * mm, "The labelled CFA shafts are 1.00 x 0.20 m. Use an adjacent lockable 19-inch wall cabinet; do not place a normal switch and UPS inside a 200 mm-deep riser.")
c.showPage()

# Page 2
page_header(c, "Logical topology", 2)
draw_switch(c, 96 * mm, 151 * mm, 105 * mm, 28 * mm, "MDF - LOCAL SERVEURS", "2 x stackable L3 core switches (recommended)\n10G SFP+ aggregation | NVR/VMS | firewall/ACL", NAVY)
draw_switch(c, 20 * mm, 102 * mm, 58 * mm, 25 * mm, "IDF-E1-A", "ETAGE - nearest MDF\n24-port PoE+ | UPS", MAGENTA)
draw_switch(c, 86 * mm, 102 * mm, 58 * mm, 25 * mm, "IDF-E1-B", "ETAGE - opposite riser\n24-port PoE+ | UPS", MAGENTA)
draw_switch(c, 152 * mm, 102 * mm, 58 * mm, 25 * mm, "IDF-RB-A", "RDC BAS - riser A\n24-port PoE+ | UPS", MAGENTA)
draw_switch(c, 218 * mm, 102 * mm, 58 * mm, 25 * mm, "IDF-RB-B", "RDC BAS - near security\n24-port PoE+ | UPS", MAGENTA)
draw_switch(c, 53 * mm, 57 * mm, 58 * mm, 25 * mm, "IDF-RH-A", "RDC HAUT - riser A\n24-port PoE+ | UPS", MAGENTA)
draw_switch(c, 119 * mm, 57 * mm, 58 * mm, 25 * mm, "IDF-RH-B", "RDC HAUT - riser B\n24-port PoE+ | UPS", MAGENTA)
draw_switch(c, 207 * mm, 50 * mm, 69 * mm, 36 * mm, "CONTROL - LOCAL SECURITE", "Managed access switch + UPS\nVMS workstation / decoder\n4 x displays via HDMI/DP", GREEN)

core_bottom = (148.5 * mm, 151 * mm)
for x, y in [(49, 127), (115, 127), (181, 127), (247, 127), (82, 82), (148, 82)]:
    arrow(c, core_bottom[0], core_bottom[1], x * mm, y * mm, MAGENTA, False, 1.8)
arrow(c, 247 * mm, 102 * mm, 241 * mm, 86 * mm, GREEN, False, 2.2)
c.setFillColor(MAGENTA)
c.setFont("DejaVu-Bold", 7)
c.drawString(18 * mm, 137 * mm, "OS2 single-mode fibre, minimum 4 cores per IDF; active duplex 10G plus spare pair")
c.setFillColor(GREEN)
c.drawString(214 * mm, 92 * mm, "Cat6A S/FTP <= 90 m")
monitor_note = p(
    "Monitors are display outputs from the VMS workstation/decoder, not direct camera network endpoints.",
    "tiny",
)
monitor_note.wrapOn(c, 75 * mm, 12 * mm)
monitor_note.drawOn(c, 202 * mm, 40 * mm)

rounded_box(
    c,
    18 * mm,
    17 * mm,
    173 * mm,
    28 * mm,
    "FAILURE-DOMAIN NOTE",
    "A single core switch remains a single point of failure. Preferred implementation: two stackable/virtual-chassis core switches, dual power feeds where available, and two diverse fibre paths for critical IDFs. If budget permits only one core, install spare SFPs and keep a configured cold-spare switch.",
    ORANGE,
)
c.showPage()

# Page 3
page_header(c, "Node and room schedule", 3)
data = [
    ["Node", "Drawing location", "Role", "Baseline equipment", "Uplink / downstream"],
    ["MDF-CORE", "ETAGE - LOCAL SERVEURS", "Core/distribution + recording", "2 x L3 10G core switches; fibre ODF; NVR/VMS; dedicated UPS", "Aggregates all IDFs"],
    ["IDF-E1-A", "ETAGE - CFA riser nearest LOCAL SERVEURS", "Local PoE access", "24-port managed PoE+; >= 2 x SFP+; UPS", "10G OS2 to MDF"],
    ["IDF-E1-B", "ETAGE - opposite CFA riser", "Local PoE access", "24-port managed PoE+; >= 2 x SFP+; UPS", "10G OS2 to MDF"],
    ["IDF-RB-A", "RDC BAS - CFA riser A", "Local PoE access", "24-port managed PoE+; >= 2 x SFP+; UPS", "10G OS2 to MDF"],
    ["IDF-RB-B", "RDC BAS - CFA riser nearest LOCAL SECURITE", "Local PoE + control-room feeder", "24-port managed PoE+; >= 2 x SFP+; UPS", "10G OS2 to MDF; Cat6A to CR"],
    ["CR-SW", "RDC BAS - LOCAL SECURITE", "Operator/access switch", "Managed switch; 1000-1500 VA UPS; VMS workstation/decoder", "Cat6A from IDF-RB-B"],
    ["IDF-RH-A", "RDC HAUT - CFA riser A", "Local PoE access", "24-port managed PoE+; >= 2 x SFP+; UPS", "10G OS2 to MDF"],
    ["IDF-RH-B", "RDC HAUT - CFA riser B", "Local PoE access", "24-port managed PoE+; >= 2 x SFP+; UPS", "10G OS2 to MDF"],
]
draw_table(c, data, [26 * mm, 58 * mm, 42 * mm, 93 * mm, 48 * mm], 15 * mm, PAGE_H - 25 * mm)
rounded_box(
    c,
    15 * mm,
    19 * mm,
    PAGE_W - 30 * mm,
    31 * mm,
    "CABINET RULE",
    "Each IDF should be an adjacent lockable 6U-12U wall cabinet sized for the selected switch depth, fibre termination, copper patch panel, cable-management radius and UPS ventilation. Confirm clearances, door swing, service access, temperature and electrical earthing during the site survey.",
    BLUE,
)
c.showPage()

# Page 4
page_header(c, "Equipment, fibre and power specification", 4)
spec_data = [
    ["Component", "Minimum concept requirement", "Design check before purchase"],
    ["IDF switch", "Managed 24-port PoE+ (802.3at), VLAN/ACL, RSTP/MSTP, SNMP, >=2 x 10G SFP+", "Camera count, per-camera watts, PoE budget and spare ports"],
    ["Core", "Two stackable/virtual-chassis L3 switches recommended; adequate 10G SFP+ density", "Total uplinks, routing/ACL, multicast and NVR throughput"],
    ["Fibre", "OS2 single-mode, minimum 4 cores to each IDF, LC patching, LSZH/fire-rated cable", "Measured route, fire stopping, bend radius and diverse route availability"],
    ["Copper", "Cat6A S/FTP permanent links; certified channel; max 90 m permanent link", "Bonding/earthing and separation from power"],
    ["Local UPS", "1000 VA / 600 W minimum only when design load <=480 W", "Actual watts, desired runtime, battery replacement and ambient temperature"],
    ["Core UPS", "Online/double-conversion preferred; capacity from measured core + server/NVR load", "Generator interface, bypass, redundancy and runtime objective"],
]
draw_table(c, spec_data, [42 * mm, 122 * mm, 102 * mm], 15 * mm, PAGE_H - 26 * mm)

rounded_box(
    c,
    15 * mm,
    55 * mm,
    128 * mm,
    53 * mm,
    "POE BUDGET",
    "For each IDF:<br/><b>Required PoE budget >= sum(camera maximum watts) x 1.20</b><br/>Then add the switch's own AC consumption when sizing the UPS. Reserve at least 20% switch ports and PoE budget for future devices. IEEE 802.3bt may be used where a future device needs four-pair higher-power PoE, but ordinary cameras usually fit PoE/PoE+.",
    MAGENTA,
)
rounded_box(
    c,
    154 * mm,
    55 * mm,
    128 * mm,
    53 * mm,
    "UPS DECISION",
    "Schneider Electric recommends keeping the connected load around 80% of UPS watt capacity. Therefore a 600 W unit should normally carry no more than about <b>480 W continuous</b>. Runtime must be read from the selected model's load curve; 1000 VA does not guarantee a specific runtime. Use 1500 VA or higher if the load or autonomy target requires it.",
    ORANGE,
)
rounded_box(
    c,
    15 * mm,
    18 * mm,
    PAGE_W - 30 * mm,
    27 * mm,
    "BACKBONE MEDIA",
    "OS2 is recommended for the building backbone because it supports long reach and future upgrades without replacing the cable. Use matched SFP+ optics at both ends, document optical loss, test every pair, and retain at least one spare duplex pair to each IDF.",
    CYAN,
)
c.showPage()

# Page 5
page_header(c, "Network segmentation and operations", 5)
vlan_data = [
    ["Example segment", "Example VLAN", "Members", "Permitted flows"],
    ["CCTV cameras", "120", "IP cameras only", "To VMS/NVR, DNS/NTP and approved management services; deny general Internet"],
    ["VMS / operators", "121", "VMS servers, operator workstation, decoder", "To cameras and recording services; controlled administrative access"],
    ["Network management", "199", "Switch management, UPS network cards", "From authorised admin hosts only; SNMPv3/syslog/NTP"],
]
draw_table(c, vlan_data, [51 * mm, 34 * mm, 67 * mm, 113 * mm], 15 * mm, PAGE_H - 27 * mm)

rounded_box(c, 15 * mm, 68 * mm, 82 * mm, 63 * mm, "ADDRESSING", "Use fixed addressing or DHCP reservations for cameras and infrastructure. Suggested naming: <b>CAM-[LEVEL]-[ZONE]-[NN]</b>, <b>SW-IDF-[LEVEL]-[A/B]</b>, <b>UPS-IDF-[LEVEL]-[A/B]</b>. Maintain an IP/port/camera schedule and label both cable ends.", BLUE)
rounded_box(c, 107 * mm, 68 * mm, 82 * mm, 63 * mm, "SECURITY", "Unique camera credentials; disable unused services; HTTPS/SSH only; firmware lifecycle; no direct Internet exposure; role-based VMS accounts; central logging; configuration backups; restrict inter-VLAN access at the core.", GREEN)
rounded_box(c, 199 * mm, 68 * mm, 82 * mm, 63 * mm, "RESILIENCE", "Enable RSTP/MSTP or routed access as appropriate. Do not create an uncontrolled triangle between the MDF, nearest IDF and control-room switch. A second active path needs a documented STP/LACP/stacking design.", MAGENTA)

rounded_box(
    c,
    15 * mm,
    18 * mm,
    PAGE_W - 30 * mm,
    39 * mm,
    "CONTROL ROOM SIGNAL FLOW",
    "Cameras -> local PoE IDF -> 10G fibre -> MDF/core -> NVR/VMS. The control-room access switch reaches the VMS through IDF-RB-B. The four displays are driven from a VMS workstation or IP video-wall decoder by HDMI/DisplayPort. If the monitors are IP displays, confirm decoder bandwidth and vendor compatibility separately.",
    ORANGE,
)
c.showPage()

# Page 6
page_header(c, "Validation, commissioning and references", 6)
check_data = [
    ["Before detailed design", "Commissioning / acceptance"],
    ["Count cameras per IDF and record maximum PoE watts", "Certify every Cat6A permanent link and label both ends"],
    ["Survey exact cabinet position beside each 200 mm CFA shaft", "OTDR / insertion-loss test all fibre pairs; record results"],
    ["Measure fibre and copper routes; confirm Cat6A <=90 m", "Verify VLANs, ACLs, STP/LACP and management access"],
    ["Confirm control-room furniture, sightlines, heat and four-display arrangement", "Simulate switch/uplink failure and UPS transfer"],
    ["Define recording retention, resolution, FPS and NVR storage", "Verify camera time sync, recording, playback and export"],
    ["Define required UPS autonomy and generator transfer time", "Archive switch, UPS and VMS configuration backups"],
]
draw_table(c, check_data, [132 * mm, 132 * mm], 15 * mm, PAGE_H - 27 * mm)

rounded_box(
    c,
    15 * mm,
    67 * mm,
    PAGE_W - 30 * mm,
    39 * mm,
    "OPEN DECISIONS",
    "1) Final camera count and wattage by zone. 2) Required recording retention and redundancy. 3) Exact rack locations adjacent to each CFA shaft. 4) Fibre route diversity. 5) UPS autonomy target. 6) Whether the core will be a redundant pair. 7) Whether the control room needs a second VMS workstation or only one workstation with four outputs.",
    MAGENTA,
)

c.setFillColor(NAVY)
c.setFont("DejaVu-Bold", 10)
c.drawString(15 * mm, 57 * mm, "Primary references")
references = [
    "Cisco, Campus LAN and Wireless LAN Solution Design Guide - hierarchical access/distribution/core design and resiliency: https://www.cisco.com/c/en/us/td/docs/solutions/CVD/Campus/cisco-campus-lan-wlan-design-guide.html",
    "IEEE 802.3-2022 / 802.3bt - Ethernet and four-pair Power over Ethernet: https://standards.ieee.org/ieee/802.3/10422/",
    "Schneider Electric, Things to consider in sizing a UPS and load - headroom and runtime guidance: https://www.se.com/us/en/faqs/FAQ000268376/",
]
y = 50 * mm
for ref in references:
    para = p(ref, "tiny")
    _, h = para.wrap(PAGE_W - 32 * mm, 20 * mm)
    para.drawOn(c, 16 * mm, y - h)
    y -= h + 3 * mm

c.setFillColor(HexColor("#FFF4E5"))
c.setStrokeColor(ORANGE)
c.roundRect(15 * mm, 17 * mm, PAGE_W - 30 * mm, 15 * mm, 3 * mm, fill=1, stroke=1)
c.setFillColor(TEXT)
c.setFont("DejaVu-Bold", 7.5)
c.drawString(20 * mm, 26 * mm, "Status:")
c.setFont("DejaVu", 7.5)
c.drawString(36 * mm, 26 * mm, "Concept design only. Final cable routing, fire-stopping, electrical protection, equipment selection and load calculations require an on-site survey and approval by the responsible low-current/electrical engineer.")
c.showPage()

c.save()
print(OUTPUT)
