"""Foglio A4 Maderno - servizio di terra, orario dal 05/10/2026 (O.d.S. 39/2026, pag. 15-19)."""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm

import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"
BLUE = Color(0, 0, 0)
TEAL = Color(0, 0, 0)
AMBER = Color(0, 0, 0)
STRIPE = Color(0.93, 0.93, 0.93)
LINE_BG = Color(0.80, 0.80, 0.80)
GREY = Color(0.20, 0.20, 0.20)
W, H = A4

# Navi di linea (pag. 15-16): (ora, movimento, turno, corsa, percorso)
# P = parte da Maderno, A = termina a Maderno, S = scalo in transito; * = SR solo fino all'11/10
LINE = [
    ("9.15", "P", "M1", "91", "per Desenzano"),
    ("10.09", "S", "SR2", "111", "Riva › Peschiera *"),
    ("10.41", "S", "SR1", "102", "Peschiera › Riva *"),
    ("11.03", "S", "R1", "7", "Riva › Desenzano"),
    ("11.31", "S", "P1", "2", "Peschiera › Riva"),
    ("13.00", "A", "D1", "16", "da Desenzano"),
    ("14.00", "P", "D1", "17", "per Desenzano"),
    ("16.30", "S", "SR1", "107", "Riva › Peschiera *"),
    ("16.58", "S", "R1", "8", "Desenzano › Riva"),
    ("17.08", "S", "P1", "3", "Riva › Peschiera"),
    ("17.24", "S", "SR2", "114", "Peschiera › Riva *"),
    ("19.25", "A", "M1", "94", "da Garda"),
]
# Traghetto (pag. 17)
FERRY = [
    ("8.10", "P", "T1", "201"), ("8.45", "P", "T2", "231"), ("9.15", "A", "T1", "202"),
    ("9.25", "P", "T1", "203"), ("9.55", "A", "T2", "232"), ("10.10", "P", "T2", "233"),
    ("10.40", "A", "T1", "204"), ("10.50", "P", "T1", "205"), ("11.20", "A", "T2", "234"),
    ("11.30", "P", "T2", "235"), ("12.00", "A", "T1", "206"), ("12.10", "P", "T1", "207"),
    ("12.40", "A", "T2", "236"), ("12.50", "P", "T2", "237"), ("13.20", "A", "T1", "208"),
    ("14.20", "P", "T1", "209"), ("14.50", "A", "T2", "238"), ("15.05", "P", "T2", "239"),
    ("15.35", "A", "T1", "210"), ("15.50", "P", "T1", "211"), ("16.20", "A", "T2", "240"),
    ("16.40", "P", "T2", "241"), ("17.10", "A", "T1", "212"), ("17.20", "P", "T1", "213"),
    ("17.50", "A", "T2", "242"), ("18.00", "P", "T2", "243"), ("18.30", "A", "T1", "214"),
    ("19.10", "A", "T2", "244"),
]
KIND = {"P": ("PARTENZA", BLUE), "A": ("ARRIVO", TEAL), "S": ("SCALO", AMBER)}


def main(out):
    rows = sorted([(t, k, code, run, where, True) for t, k, code, run, where in LINE] +
                  [(t, k, code, run, "per Torri" if k == "P" else "da Torri", False)
                   for t, k, code, run in FERRY],
                  key=lambda r: (float(r[0]), not r[5]))
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Maderno - servizio di terra - orario dal 5 ottobre 2026")
    L, R = 15 * mm, W - 15 * mm

    c.setFillColor(BLUE)
    c.setFont("DVB", 26)
    c.drawString(L, H - 27 * mm, "MADERNO")
    c.setFont("DV", 12)
    c.drawString(L, H - 34 * mm, "Servizio di terra - navi di linea e traghetto Torri in ordine di orario")
    c.setFont("DV", 9.5); c.setFillColor(GREY)
    c.drawString(L, H - 40 * mm, "Dal 5 ottobre all'1 novembre 2026 e dal 13 al 25 marzo 2027  ·  O.d.S. n. 39/2026")

    box_top, box_h = H - 45 * mm, 20 * mm
    bw = (R - L - 6 * mm) / 2
    for i, (code, a, b, note) in enumerate((
            ("AgM", "9.00 – 11.50", "12.50 – 19.30", "compresa assistenza alle c. 16-17 · coadiuva AgT"),
            ("AgT1", "7.50 – 13.00", "14.00 – 18.20", "9 ore 30'"))):
        x = L + i * (bw + 6 * mm)
        c.setStrokeColor(BLUE); c.setLineWidth(1)
        c.roundRect(x, box_top - box_h, bw, box_h, 3 * mm, stroke=1, fill=0)
        c.setFillColor(BLUE); c.setFont("DVB", 16)
        c.drawString(x + 5 * mm, box_top - 9 * mm, code)
        c.setFont("DV", 13)
        c.drawRightString(x + bw - 5 * mm, box_top - 7.5 * mm, a)
        c.drawRightString(x + bw - 5 * mm, box_top - 13.5 * mm, b)
        c.setFont("DV", 7.5); c.setFillColor(GREY)
        c.drawString(x + 5 * mm, box_top - 17.5 * mm, note)

    cw = (R - L - 6 * mm) / 2
    row_h = 8.0 * mm
    top = box_top - box_h - 9 * mm
    lowest = top
    for ci, (head, col) in enumerate((("MATTINA", [r for r in rows if float(r[0]) < 14]),
                                      ("POMERIGGIO", [r for r in rows if float(r[0]) >= 14]))):
        x = L + ci * (cw + 6 * mm)
        y = top
        c.setFillColor(BLUE)
        c.rect(x, y - 2.4 * mm, cw, 7.5 * mm, stroke=0, fill=1)
        c.setFillColor(white); c.setFont("DVB", 9)
        c.drawString(x + 2.5 * mm, y, head)
        c.drawString(x + 32 * mm, y, "TURNO")
        c.drawString(x + 46 * mm, y, "CORSA · DA / PER")
        for i, (t, k, code, run, where, line) in enumerate(col):
            y -= row_h
            if line or i % 2 == 0:
                c.setFillColor(LINE_BG if line else STRIPE)
                c.rect(x, y - 2.7 * mm, cw, row_h, stroke=0, fill=1)
            label, color = KIND[k]
            c.setFillColor(BLUE); c.setFont("DVB", 12)
            c.drawRightString(x + 15.5 * mm, y, t)
            c.setFillColor(color); c.setFont("DVB", 6.6)
            c.drawString(x + 17 * mm, y + 0.5 * mm, label)
            c.setFillColor(BLUE); c.setFont("DVB", 12)
            c.drawString(x + 32 * mm, y, code)
            c.setFont("DV", 7.4); c.setFillColor(GREY)
            c.drawString(x + 46 * mm, y + 0.3 * mm, run)
            c.setFillColor(BLUE); c.setFont("DVB" if line else "DV", 8.6)
            c.drawString(x + 53 * mm, y, where)
            assert pdfmetrics.stringWidth(label, "DVB", 6.6) < 14.5 * mm and pdfmetrics.stringWidth(t, "DVB", 12) < 15 * mm
            assert x + 53 * mm + pdfmetrics.stringWidth(where, "DVB", 8.6) < x + cw, where
        lowest = min(lowest, y)

    # legenda e note
    y = lowest - 10 * mm
    c.setFillColor(LINE_BG); c.rect(L, y - 1.2 * mm, 5 * mm, 4 * mm, stroke=0, fill=1)
    c.setFillColor(GREY); c.setFont("DV", 8.5)
    c.drawString(L + 7 * mm, y, "nave di linea   ·   SCALO = nave in transito a Maderno   ·   "
                                "* corsa SR solo fino all'11 ottobre 2026")
    for s in ("T1 non effettuato il 25 dicembre 2026. T2 e navi di linea: fino all'1 novembre 2026 e dal 13 marzo 2027.",
              "Dal 2 novembre 2026 al 12 marzo 2027 solo traghetto T1 - AgT 7.55 – 12.15 / 13.15 – 18.50 (9 ore 55').",
              "Gli orari potranno subire variazioni in relazione alle condizioni di traffico agli scali."):
        y -= 5 * mm
        assert pdfmetrics.stringWidth(s, "DV", 8.5) <= R - L, s
        c.drawString(L, y, s)
    c.showPage()
    c.save()
    return y


if __name__ == "__main__":
    print("ultima riga a", round(main(sys.argv[1]) / mm, 1), "mm dal basso")
