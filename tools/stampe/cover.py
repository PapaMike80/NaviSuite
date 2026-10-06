"""Cover iPhone 15 M1/T1/T2, Maderno e Desenzano - orario invernale dal 05/10/2026 (O.d.S. 39/2026).
Coordinate in mm rispetto all'angolo alto-sinistro della cover (71.6 x 147.6)."""
import math, sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color, black
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm

import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"
BLUE = Color(0.039216, 0.203922, 0.462745)
W, H = A4
CX0, CY0 = 196.1575, 217.4174          # angolo cover sulla pagina (pt, dall'alto)
CW, CH = 71.6, 147.6                    # cover iPhone 15 (mm)

# Zone da lasciare libere (mm), misurate sulla foto della cover
CAM = (0, 0, 43.0, 41.0)                # foro fotocamera + margine
RING_C, RING_R_IN, RING_R_OUT = (35.8, 71.0), 21.3, 30.0   # anello MagSafe + margine
PILL = (30.8, 89.0, 40.8, 114.0)        # linguetta di allineamento + margine
EDGE = 3.0
RING_GAP = 22.0                         # apertura in basso dell'anello (gradi per lato, con margine)

boxes = []                              # (x0, y0, x1, y1) in mm di ogni testo, per il controllo


def P(xmm, ymm):
    return CX0 + xmm * mm, H - (CY0 + ymm * mm)


def txt(c, x, y, s, font, size, color=BLUE, align="l"):
    """y = linea di base in mm."""
    w = pdfmetrics.stringWidth(s, font, size) / mm
    x0 = {"l": x, "r": x - w, "c": x - w / 2}[align]
    c.setFont(font, size)
    c.setFillColor(color)
    px, py = P(x0, y)
    c.drawString(px, py, s)
    boxes.append((s, x0, y - 0.74 * size / mm, x0 + w, y + 0.2 * size / mm))
    return w


def check():
    bad = []
    for s, x0, y0, x1, y1 in boxes:
        pts = [(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * j / 2) for i in range(9) for j in range(3)]
        for x, y in pts:
            r = math.hypot(x - RING_C[0], y - RING_C[1])
            ang = math.degrees(math.atan2(abs(x - RING_C[0]), y - RING_C[1]))  # 0 = verso il basso
            if (RING_R_IN < r < RING_R_OUT and not (y > RING_C[1] and ang < RING_GAP)
                    or (x < CAM[2] and y < CAM[3])
                    or (PILL[0] < x < PILL[2] and PILL[1] < y < PILL[3])
                    or x < EDGE or x > CW - EDGE or y < EDGE or y > CH - EDGE):
                bad.append((s, round(x, 1), round(y, 1)))
                break
    return bad


def frame(c, code, sub, title_size=30, title_y=20.0, sub_y=27.5):
    c.setFont("DVB", 15); c.setFillColor(BLUE)
    c.drawCentredString(W / 2, H - 56.7, f"{code} - iPhone 15")
    c.setFont("DV", 8); c.setFillColor(black)
    c.drawCentredString(W / 2, H - 76.0, "Orario dal 5 ottobre 2026 (O.d.S. 39/2026) - stampa al 100% / dimensioni effettive")
    c.setStrokeColor(black); c.setLineWidth(0.35)
    c.roundRect(CX0, H - CY0 - CH * mm, CW * mm, CH * mm, 12 * mm, stroke=1, fill=0)
    # titolo nella zona accanto alla fotocamera
    txt(c, 56.5, title_y, code, "DVB", title_size, align="c")
    for i, s in enumerate(sub):
        txt(c, 56.5, sub_y + i * 3.4, s, "DV", 5.6, align="c")
    # quadrato di controllo + istruzioni
    c.setStrokeColor(black); c.setLineWidth(0.35)
    c.rect(56.6929, H - 785.1969, 50 * mm, 50 * mm, stroke=1, fill=0)
    c.setFont("DV", 7); c.setFillColor(black)
    c.drawCentredString(127.55, H - 717.0, "CONTROLLO SCALA 50 x 50 mm")
    c.setFont("DV", 6)
    for i, s in enumerate(["1. Il quadrato deve misurare esattamente 5 cm.",
                           "2. Ritaglia il bordo esterno sulla linea nera.",
                           "3. Usa il foro della cover come dima per la fotocamera.",
                           "4. Nessun orario finisce sotto l'anello MagSafe."]):
        c.drawString(221.1, H - 683.0 - i * 11.35, s)


# ---------------- M1 ----------------
M1 = {
    "91": [("MADERNO", "9.15", ""), ("GARDONE", "9.30", ""), ("SALÒ", "9.45", ""),
           ("PORTESE", "9.55", ""), ("GARDA", "10.40", ""), ("BARDOLINO", "10.55", ""),
           ("LAZISE", "11.12", ""), ("SIRMIONE", "11.53", ""), ("DESENZANO", "12.15", "")],
    "92": [("DESENZANO", "13.15", "60m"), ("SIRMIONE", "13.37", ""), ("LAZISE", "14.19", ""),
           ("BARDOLINO", "14.35", ""), ("GARDA", "14.54", ""), ("PORTESE", "15.42", ""),
           ("SALÒ", "15.55", ""), ("GARDONE", "16.10", "")],
    "93": [("SALÒ", "16.25", ""), ("GARDA", "17.15", "")],
    "94": [("GARDA", "18.00", "45m"), ("PORTESE", "18.45", ""), ("SALÒ", "18.55", ""),
           ("GARDONE", "19.10", ""), ("MADERNO", "19.25", "")],
}


def trip_block(c, x, right, y, num, stops, step=3.55, head=4.6, nsz=6.4, center=False):
    if center:
        txt(c, (x + right) / 2, y + 2.6, num, "DVB", 10.5, align="c")
    else:
        txt(c, x, y + 2.6, num, "DVB", 10.5)
    note = next((n for _, _, n in stops if n), "")
    if note:
        txt(c, right, y + 2.6, f"sosta {note}", "DV", 5.6, align="r")
    y += head
    for name, t, _ in stops:
        y += step
        txt(c, x, y, name, "DVB", nsz)
        txt(c, right, y, t, "DV", 6.4, align="r")
    return y + 1.6


def m1_page(c):
    frame(c, "M1", ["dal 5/10 all'1/11/2026", "e dal 13 al 25/3/2027"])
    # dentro l'anello: corsa 91
    trip_block(c, 24.0, 47.6, 50.6, "91", M1["91"], step=3.3, head=3.4, nsz=6.0, center=True)
    # in basso a sinistra: 92 ; in basso a destra: 93 + 94
    trip_block(c, 4.5, 30.0, 101.5, "92", M1["92"])
    y = trip_block(c, 42.0, 67.5, 101.5, "93", M1["93"])
    trip_block(c, 42.0, 67.5, y, "94", M1["94"])


# ---------------- T1 / T2 ----------------
def shuttle_page(c, code, out, back, pause, sub):
    """out: corse Maderno>Torri, back: Torri>Maderno, liste (n, partenza, arrivo).
    pause = (righe prima della pausa, testo)."""
    frame(c, code, sub)
    cols = [(4.5, 30.0, "MADERNO › TORRI", out), (41.8, 67.3, "TORRI › MADERNO", back)]
    n_before, label = pause
    for x, right, head, trips in cols:
        y = 104.0
        txt(c, (x + right) / 2, y, head, "DVB", 5.6, align="c")
        y += 1.4
        for i, (n, dep, arr) in enumerate(trips):
            if i == n_before:
                y += 4.0
            y += 4.15
            txt(c, x, y, n, "DVB", 8.6)
            txt(c, right, y, f"{dep} – {arr}", "DV", 7.6, align="r")
    y_p = 105.4 + n_before * 4.15 + 3.3
    txt(c, CW / 2, y_p, label, "DVB", 5.6, align="c")
    c.setStrokeColor(BLUE); c.setLineWidth(0.3); c.setDash(1.2, 1.2)
    w = pdfmetrics.stringWidth(label, "DVB", 5.6) / mm
    for a, b in ((4.5, CW / 2 - w / 2 - 1.5), (CW / 2 + w / 2 + 1.5, 67.3)):
        c.line(*P(a, y_p - 0.7), *P(b, y_p - 0.7))
    c.setDash()


T1_OUT = [("201", "8.10", "8.40"), ("203", "9.25", "9.55"), ("205", "10.50", "11.20"),
          ("207", "12.10", "12.40"), ("209", "14.20", "14.50"), ("211", "15.50", "16.20"),
          ("213", "17.20", "17.50")]
T1_BACK = [("202", "8.45", "9.15"), ("204", "10.10", "10.40"), ("206", "11.30", "12.00"),
           ("208", "12.50", "13.20"), ("210", "15.05", "15.35"), ("212", "16.40", "17.10"),
           ("214", "18.00", "18.30")]
T2_OUT = [("231", "8.45", "9.15"), ("233", "10.10", "10.40"), ("235", "11.30", "12.00"),
          ("237", "12.50", "13.20"), ("239", "15.05", "15.35"), ("241", "16.40", "17.10"),
          ("243", "18.00", "18.30")]
T2_BACK = [("232", "9.25", "9.55"), ("234", "10.50", "11.20"), ("236", "12.10", "12.40"),
           ("238", "14.20", "14.50"), ("240", "15.50", "16.20"), ("242", "17.20", "17.50"),
           ("244", "18.40", "19.10")]


def ring_note(c, lines):
    y = 64.0
    for i, (s, f, sz) in enumerate(lines):
        txt(c, RING_C[0], y, s, f, sz, align="c")
        y += sz * 0.55


def t1_page(c):
    shuttle_page(c, "T1", T1_OUT, T1_BACK, (4, "PAUSA 13.20 – 14.20"),
                 ["dal 5 ottobre 2026", "al 25 marzo 2027"])
    ring_note(c, [("MADERNO", "DVB", 8.5), ("⇄", "DVB", 9), ("TORRI", "DVB", 8.5),
                  ("8.10 – 18.30", "DV", 7), ("non effettuato il 25/12", "DV", 5)])


def t2_page(c):
    shuttle_page(c, "T2", T2_OUT, T2_BACK, (4, "PAUSA 13.20 – 14.20"),
                 ["dal 5/10 all'1/11/2026", "e dal 13 al 25/3/2027"])
    ring_note(c, [("MADERNO", "DVB", 8.5), ("⇄", "DVB", 9), ("TORRI", "DVB", 8.5),
                  ("8.45 – 19.10", "DV", 7), ("sospeso dal 2/11 al 12/3", "DV", 5)])


# ---------------- MADERNO - servizio di terra ----------------
# Navi di linea a Maderno (O.d.S. 39/2026 pag. 15-16): (ora, turno, corsa, nota)
# nota: "arr" = termina a Maderno, "part" = parte da Maderno, "*" = SR solo fino all'11/10
LINE_NORD = [("10.41", "SR1", "102", "*"), ("11.31", "P1", "2", ""), ("13.00", "D1", "16", "arr"),
             ("16.58", "R1", "8", ""), ("17.24", "SR2", "114", "*"), ("19.25", "M1", "94", "arr")]
LINE_SUD = [("9.15", "M1", "91", "part"), ("10.09", "SR2", "111", "*"), ("11.03", "R1", "7", ""),
            ("14.00", "D1", "17", "part"), ("16.30", "SR1", "107", "*"), ("17.08", "P1", "3", "")]
# Traghetto (pag. 17): partenze da Maderno e arrivi da Torri, (ora, turno)
FERRY_PART = [("8.10", "T1"), ("8.45", "T2"), ("9.25", "T1"), ("10.10", "T2"), ("10.50", "T1"),
              ("11.30", "T2"), ("12.10", "T1"), ("12.50", "T2"),
              ("14.20", "T1"), ("15.05", "T2"), ("15.50", "T1"), ("16.40", "T2"), ("17.20", "T1"),
              ("18.00", "T2")]
FERRY_ARR = [("9.15", "T1"), ("9.55", "T2"), ("10.40", "T1"), ("11.20", "T2"), ("12.00", "T1"),
             ("12.40", "T2"), ("13.20", "T1"),
             ("14.50", "T2"), ("15.35", "T1"), ("16.20", "T2"), ("17.10", "T1"), ("17.50", "T2"),
             ("18.30", "T1"), ("19.10", "T2")]


def maderno_page(c):
    frame(c, "MADERNO", [], title_size=11, title_y=11.0)
    txt(c, 56.5, 15.2, "dal 5/10 all'1/11/2026", "DV", 5.2, align="c")
    txt(c, 56.5, 18.4, "e dal 13 al 25/3/2027", "DV", 5.2, align="c")
    y = 24.0
    for code, a, b in (("AgM", "9.00 – 11.50", "12.50 – 19.30"),
                       ("AgT1", "7.50 – 13.00", "14.00 – 18.20")):
        txt(c, 56.5, y, code, "DVB", 7, align="c")
        txt(c, 56.5, y + 3.4, a, "DV", 6.2, align="c")
        txt(c, 56.5, y + 6.6, b, "DV", 6.2, align="c")
        y += 11.0

    # navi di linea dentro l'anello MagSafe
    # in ordine di orario, mattina a sinistra e pomeriggio a destra;
    # la freccia indica la direzione (▲ verso Riva, ▼ verso Desenzano)
    txt(c, RING_C[0], 56.0, "NAVI DI LINEA", "DVB", 5.6, align="c")
    rows = sorted([r + ("▲",) for r in LINE_NORD] + [r + ("▼",) for r in LINE_SUD],
                  key=lambda r: float(r[0]))
    half = (len(rows) + 1) // 2
    for x0, col in ((17.6, rows[:half]), (37.0, rows[half:])):
        y = 57.4
        for t, code, _, note, arrow in col:
            y += 3.75
            txt(c, x0 + 5.6, y, t, "DV", 6.4, align="r")
            txt(c, x0 + 6.0, y - 0.2, arrow, "DVB", 4.6)
            w = txt(c, x0 + 8.1, y, code, "DVB", 6.4)
            if note:
                txt(c, x0 + 8.1 + w + 0.4, y - 0.3, note, "DV", 4.2)
    txt(c, RING_C[0], 84.0, "▲ verso Riva   ▼ verso Desenzano", "DV", 4.6, align="c")
    txt(c, RING_C[0], 86.4, "* solo fino all'11/10", "DV", 4.6, align="c")

    # traghetto in basso, ai lati della linguetta
    # partenze (P) e arrivi (A) insieme, in ordine di orario:
    # mattina a sinistra della linguetta, pomeriggio a destra
    ferry = sorted([(t, "P", code) for t, code in FERRY_PART] + [(t, "A", code) for t, code in FERRY_ARR],
                   key=lambda r: float(r[0]))
    for x0, head, rows in ((4.5, "TRAGHETTO MATTINA", [r for r in ferry if float(r[0]) < 13.5]),
                           (41.8, "TRAGHETTO POMERIGGIO", [r for r in ferry if float(r[0]) >= 13.5])):
        txt(c, x0 + 12.75, 103.4, head, "DVB", 5.0, align="c")
        for i, (t, kind, code) in enumerate(rows):
            sx = x0 + (13.4 if i >= 8 else 0)
            y = 107.4 + (i % 8) * 3.85
            txt(c, sx + 6.9, y, t, "DV", 6.6, align="r")
            txt(c, sx + 7.5, y, kind, "DVB", 5.4)
            txt(c, sx + 9.4, y, code, "DV", 4.6)
    txt(c, CW / 2, 138.0, "P partenza per Torri   A arrivo da Torri", "DV", 4.6, align="c")
    txt(c, CW / 2, 141.0, "Dal 2/11 al 12/3 solo traghetto T1 - AgT 7.55 – 12.15 / 13.15 – 18.50",
        "DV", 4.4, align="c")


# ---------------- DESENZANO - pontile e AgB ----------------
# Navi a Desenzano (O.d.S. 39/2026 pag. 15-16 e BIS pag. 18): (ora, P/A, turno, corsa)
DESENZANO = [
    ("8.30", "P", "BIS", ""), ("8.50", "P", "D2", "20"), ("9.15", "P", "D1", "14"),
    ("9.55", "A", "D1", "15"), ("10.05", "P", "D1", "16"), ("10.30", "A", "P2", "31"),
    ("10.40", "P", "P2", "32"), ("11.20", "A", "P2", "33"), ("11.25", "P", "P2", "34"),
    ("12.15", "A", "M1", "91"), ("13.15", "P", "M1", "92"), ("13.30", "A", "R1", "7"),
    ("14.30", "P", "R1", "8"), ("15.25", "A", "P2", "35"), ("15.35", "P", "P2", "36"),
    ("16.15", "A", "P2", "37"), ("16.20", "P", "P2", "38"), ("16.55", "A", "D1", "17"),
    ("17.05", "P", "D1", "18"), ("18.40", "A", "BIS", ""), ("19.00", "A", "D2", "27"),
    ("19.40", "A", "D1", "19"),
]


def desenzano_page(c):
    frame(c, "DESENZANO", [], title_size=9.6, title_y=11.0)
    txt(c, 56.5, 15.2, "dal 5/10 all'1/11/2026", "DV", 5.2, align="c")
    txt(c, 56.5, 18.4, "e dal 13 al 25/3/2027", "DV", 5.2, align="c")
    txt(c, 56.5, 22.8, "AgB", "DVB", 7, align="c")
    txt(c, 56.5, 26.0, "8.00 – 11.50", "DV", 6.2, align="c")
    txt(c, 56.5, 29.0, "12.50 – 17.30", "DV", 6.2, align="c")
    txt(c, 56.5, 31.6, "7.45 con rifornimento D2", "DV", 4.2, align="c")
    txt(c, 56.5, 35.6, "PonD", "DVB", 7, align="c")
    txt(c, 56.5, 38.8, "9.30 – 13.35", "DV", 6.2, align="c")
    txt(c, 56.5, 41.8, "15.00 – 19.50", "DV", 6.2, align="c")

    def entry(x0, y, t, kind, code, size=6.4):
        txt(c, x0 + 5.6, y, t, "DV", size, align="r")
        txt(c, x0 + 6.3, y, kind, "DVB", size - 1.2)
        txt(c, x0 + 8.4, y, code, "DVB", size)

    # mattina dentro l'anello MagSafe, in ordine di orario
    morning = [r for r in DESENZANO if float(r[0]) < 14]
    rest = [r for r in DESENZANO if float(r[0]) >= 14]
    txt(c, RING_C[0], 56.0, "MATTINA", "DVB", 5.6, align="c")
    half = (len(morning) + 1) // 2
    for x0, col in ((19.0, morning[:half]), (37.4, morning[half:])):
        y = 57.4
        for t, kind, code, _ in col:
            y += 3.75
            entry(x0, y, t, kind, code)
    txt(c, RING_C[0], 84.0, "P partenza   A arrivo", "DV", 4.6, align="c")

    # pomeriggio e sera in basso, ai lati della linguetta
    afternoon = [r for r in rest if float(r[0]) < 16.5]
    evening = [r for r in rest if float(r[0]) >= 16.5]
    for x0, head, col in ((6.0, "POMERIGGIO", afternoon), (43.3, "SERA", evening)):
        txt(c, x0 + 10.0, 103.4, head, "DVB", 5.6, align="c")
        y = 104.0
        for t, kind, code, _ in col:
            y += 5.0
            txt(c, x0 + 7.6, y, t, "DV", 8.0, align="r")
            txt(c, x0 + 8.4, y, kind, "DVB", 6.6)
            txt(c, x0 + 11.0, y, code, "DVB", 8.0)
    txt(c, CW / 2, 138.0, "BIS: pronti a muovere 8.30 verso Garda, rientro 18.40", "DV", 4.4, align="c")
    txt(c, CW / 2, 141.0, "Dal 2/11 al 12/3 nessuna corsa di linea a Desenzano", "DV", 4.4, align="c")


def build(path, title, pages):
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle(title)
    ok = True
    for name, fn in pages:
        boxes.clear()
        fn(c)
        bad = check()
        print(name, "OK" if not bad else bad)
        ok &= not bad
        c.showPage()
    c.save()
    return ok


def genera(out):
    """Scrive le cover (orario invernale) nella cartella out; False se un testo finisce sotto MagSafe/fotocamera."""
    ok = build(f"{out}/Cover_M1_T1_T2_Maderno_inverno_iPhone_15_A4.pdf",
               "Cover M1 T1 T2 Maderno - orario dal 5 ottobre 2026",
               (("M1", m1_page), ("T1", t1_page), ("T2", t2_page), ("MADERNO", maderno_page)))
    ok &= build(f"{out}/Cover_Desenzano_inverno_iPhone_15_A4.pdf",
                "Cover Desenzano - orario dal 5 ottobre 2026", (("DESENZANO", desenzano_page),))
    return ok


if __name__ == "__main__":
    sys.exit(0 if genera(sys.argv[1]) else 1)
