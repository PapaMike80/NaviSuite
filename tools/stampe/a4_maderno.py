"""Foglio A4 Maderno - servizio di terra, orario dal 05/10/2026 (O.d.S. 39/2026, pag. 15-19):
navi di linea in ordine di orario e, a parte, i passaggi del traghetto Torri per T1 e T2."""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm

import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"
# colori di NaviSuite, come il foglio di Desenzano (a4_desenzano_colori.py)
from a4_desenzano_colori import NOTTE, NOTTE2, TEAL, TEAL_SCURO, AZZURRO, INCHIOSTRO, GRIGIO, RIGA, BORDO, ARANCIO, chip, etichetta
BLUE = INCHIOSTRO
AMBER = HexColor("#b7791f")
STRIPE = RIGA
GREY = GRIGIO
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
KIND = {"P": ("PARTENZA", TEAL_SCURO), "A": ("ARRIVO", AZZURRO), "S": ("SCALO", AMBER)}
VALIDITA = "Dal 5 ottobre all'1 novembre 2026 e dal 13 al 25 marzo 2027  ·  O.d.S. n. 39/2026"


def main(out):
    rows = sorted([(t, k, code, run, where, True) for t, k, code, run, where in LINE] +
                  [(t, k, code, run, "per Torri" if k == "P" else "da Torri", False)
                   for t, k, code, run in FERRY],
                  key=lambda r: (float(r[0]), not r[5]))
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Maderno - servizio di terra - orario dal 5 ottobre 2026")
    L, R = 15 * mm, W - 15 * mm

    # intestazione blu notte con la striscia verde acqua di NaviSuite
    band = 29 * mm
    c.setFillColor(NOTTE); c.rect(0, H - band, W, band, stroke=0, fill=1)
    c.setFillColor(TEAL); c.rect(0, H - band - 1.6 * mm, W, 1.6 * mm, stroke=0, fill=1)
    c.setFillColor(TEAL); c.setFont("DVB", 8.5)
    c.drawString(L, H - 8.5 * mm, "N A V I S U I T E   ·   S E R V I Z I   A   T E R R A")
    c.setFillColor(white); c.setFont("DVB", 27)
    c.drawString(L, H - 18.5 * mm, "MADERNO")
    c.setFont("DV", 11.5)
    c.drawString(L + pdfmetrics.stringWidth("MADERNO", "DVB", 27) + 5 * mm, H - 18.5 * mm, "AgM e AgT")
    c.setFillColor(HexColor("#9bc8d5")); c.setFont("DV", 8.8)
    c.drawString(L, H - 24.8 * mm, VALIDITA)

    box_top, box_h = H - band - 5 * mm, 19 * mm
    bw = (R - L - 6 * mm) / 2
    for i, (code, a, b, note) in enumerate((
            ("AgM", "9.00 – 11.50", "12.50 – 19.30", "compresa assistenza alle c. 16-17 · coadiuva AgT"),
            ("AgT", "7.50 – 13.00", "14.00 – 18.20", "9 ore 30'"))):
        x = L + i * (bw + 6 * mm)
        c.setFillColor(RIGA); c.setStrokeColor(BORDO); c.setLineWidth(0.8)
        c.roundRect(x, box_top - box_h, bw, box_h, 3 * mm, stroke=1, fill=1)
        c.setFillColor(TEAL_SCURO); c.roundRect(x, box_top - box_h, 2.2 * mm, box_h, 1.1 * mm, stroke=0, fill=1)
        c.setFillColor(NOTTE); c.setFont("DVB", 17)
        c.drawString(x + 6 * mm, box_top - 9 * mm, code)
        c.setFont("DVB", 12.5)
        c.drawRightString(x + bw - 5 * mm, box_top - 7.5 * mm, a)
        c.drawRightString(x + bw - 5 * mm, box_top - 13.5 * mm, b)
        c.setFont("DV", 7.5); c.setFillColor(GREY)
        c.drawString(x + 6 * mm, box_top - 16.6 * mm, note)

    # ---- navi di linea: una riga per passaggio, in ordine di orario ----
    y = box_top - box_h - 10 * mm
    c.setFillColor(BLUE); c.setFont("DVB", 12)
    c.drawString(L, y, "NAVI DI LINEA")
    c.setFont("DV", 8.5); c.setFillColor(GREY)
    c.drawString(L + pdfmetrics.stringWidth("NAVI DI LINEA", "DVB", 12) + 4 * mm, y,
                 "SCALO = nave in transito a Maderno  ·  * corsa SR solo fino all'11 ottobre 2026")
    cols = [("ORA", L + 3 * mm), ("", L + 26 * mm), ("TURNO", L + 52 * mm),
            ("CORSA", L + 72 * mm), ("DA / PER", L + 92 * mm)]
    y -= 8 * mm
    c.setFillColor(NOTTE2)
    c.roundRect(L, y - 2.4 * mm, R - L, 7.5 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 9)
    for label, x in cols:
        c.drawString(x, y, label)
    row_h = 6.6 * mm
    for i, (t, k, code, run, where) in enumerate(LINE):
        y -= row_h
        if i % 2 == 0:
            c.setFillColor(STRIPE); c.rect(L, y - 2.2 * mm, R - L, row_h, stroke=0, fill=1)
        if t == "14.00":  # stacco tra mattina e pomeriggio
            c.setStrokeColor(TEAL_SCURO); c.setLineWidth(1.2)
            c.line(L, y + row_h - 2.2 * mm, R, y + row_h - 2.2 * mm)
        label, color = KIND[k]
        c.setFillColor(BLUE); c.setFont("DVB", 15)
        c.drawRightString(L + 20 * mm, y, t)
        c.setFillColor(color); c.setFont("DVB", 10)
        c.drawString(cols[1][1], y + 0.4 * mm, label)
        chip(c, cols[2][1], y, code, size=10.5, w=15 * mm)
        c.setFillColor(INCHIOSTRO); c.setFont("DV", 12)
        c.drawString(cols[3][1], y, run)
        c.drawString(cols[4][1], y, where)
        if run in BOLGETTE:
            lw = etichetta(c, R - 1 * mm, y, BOLGETTE[run], ARANCIO, NOTTE, size=8.6)
            assert cols[4][1] + pdfmetrics.stringWidth(where, "DV", 12) + 2 * mm < R - lw - 1 * mm, where

    # ---- traghetto: per T1 e T2 ogni riga e' un passaggio a Maderno ----
    y -= 12 * mm
    c.setFillColor(BLUE); c.setFont("DVB", 12)
    c.drawString(L, y, "TRAGHETTO MADERNO – TORRI")
    c.setFont("DV", 8.5); c.setFillColor(GREY)
    c.drawString(L + pdfmetrics.stringWidth("TRAGHETTO MADERNO – TORRI", "DVB", 12) + 4 * mm, y,
                 "arrivo da Torri, sosta a Maderno, partenza per Torri")
    cw = (R - L - 8 * mm) / 2
    AX, SX, DX = 23 * mm, 45.5 * mm, 66 * mm  # centri delle colonne arrivo / sosta / partenza
    top = y - 7.5 * mm
    lowest = top
    for ci, code in enumerate(("T1", "T2")):
        x = L + ci * (cw + 8 * mm)
        yy = top
        c.setFillColor(NOTTE2)
        c.roundRect(x, yy - 2.6 * mm, cw, 8 * mm, 2 * mm, stroke=0, fill=1)
        chip(c, x + 2 * mm, yy, code, size=10, w=11 * mm)
        c.setFillColor(white); c.setFont("DVB", 8.4)
        c.drawCentredString(x + AX, yy, "ARRIVO")
        c.drawCentredString(x + SX, yy, "SOSTA")
        c.drawCentredString(x + DX, yy, "PARTENZA")
        for i, (arr, dep, kind) in enumerate(ferry_rows(code)):
            yy -= 7.4 * mm
            if kind == "pausa-torri":
                c.setFillColor(GREY); c.setFont("DVB", 8.2)
                c.drawCentredString(x + cw / 2, yy + 0.4 * mm, f"pausa a Torri {arr} – {dep}")
                c.setStrokeColor(TEAL_SCURO); c.setLineWidth(0.4); c.setDash(1.2, 1.2)
                c.line(x, yy + 3.8 * mm, x + cw, yy + 3.8 * mm); c.line(x, yy - 2.4 * mm, x + cw, yy - 2.4 * mm)
                c.setDash()
                continue
            if i % 2 == 0:
                c.setFillColor(STRIPE); c.rect(x, yy - 2.6 * mm, cw, 7.4 * mm, stroke=0, fill=1)
            for t, xc in ((arr, x + AX), (dep, x + DX)):
                if t:
                    c.setFillColor(BLUE); c.setFont("DVB", 14)
                    c.drawCentredString(xc, yy, t[0])
                    c.setFont("DV", 7); c.setFillColor(GREY)
                    c.drawString(xc + pdfmetrics.stringWidth(t[0], "DVB", 14) / 2 + 1.2 * mm, yy, t[1])
            c.setFillColor(GREY); c.setFont("DV", 8.6)
            if kind == "prima":
                c.drawCentredString(x + AX, yy + 0.3 * mm, "1ª partenza")
            elif kind == "ultima":
                c.drawCentredString(x + DX, yy + 0.3 * mm, "fine servizio")
            if arr and dep:
                sosta = minutes(dep[0]) - minutes(arr[0])
                c.setFillColor(TEAL_SCURO)
                if sosta >= 45:  # pausa pranzo a Maderno
                    c.setFont("DV", 7); c.drawCentredString(x + SX, yy + 2.0 * mm, "pausa")
                    c.setFont("DVB", 11); c.drawCentredString(x + SX, yy - 1.6 * mm, f"{sosta}'")
                else:
                    c.setFont("DV", 11); c.drawCentredString(x + SX, yy, f"{sosta}'")
        c.setStrokeColor(BORDO); c.setLineWidth(0.6)
        c.rect(x, yy - 2.4 * mm, cw, top - yy + 8 * mm - 0.2 * mm + 0.2 * mm, stroke=1, fill=0)
        lowest = min(lowest, yy)

    # note
    y = lowest - 10 * mm
    c.setFillColor(GREY); c.setFont("DV", 8.5)
    c.setFillColor(INCHIOSTRO); c.setFont("DVB", 9)
    c.drawString(L, y, "Bolgette: partono con la R1 corsa 7 delle 11.03 e rientrano con la R1 corsa 8 delle 16.58.")
    y -= 5.5 * mm
    c.setFillColor(GREY); c.setFont("DV", 8.5)
    for s in ("T1 non effettuato il 25 dicembre 2026. T2 e navi di linea: fino all'1 novembre 2026 e dal 13 marzo 2027.",
              "Dal 2 novembre 2026 al 12 marzo 2027 solo traghetto T1 - AgT 7.55 – 12.15 / 13.15 – 18.50 (9 ore 55')."):
        assert pdfmetrics.stringWidth(s, "DV", 8.5) <= R - L, s
        c.drawString(L, y, s)
        y -= 4.8 * mm
    assert y > 10 * mm, y / mm
    c.showPage()
    c.save()
    return y


# bolgetta Maderno - Direzione (Desenzano): R1 all'andata e al ritorno (corsa: etichetta)
BOLGETTE = {"7": "BOLGETTA · PARTE", "8": "BOLGETTA · RIENTRA"}


def minutes(t):
    h, m = t.split(".")
    return int(h) * 60 + int(m)


def hhmm(n):
    return f"{n // 60}.{n % 60:02d}"


def ferry_rows(code):
    """Passaggi a Maderno di un turno traghetto: [(arrivo, partenza, tipo)], con arrivo/partenza
    = (ora, corsa) o None. tipo: prima, ultima, pausa-torri (riga di sola nota) o ''."""
    ev = sorted(((minutes(t), k, run) for t, k, c_, run in FERRY if c_ == code))
    rows, i = [], 0
    while i < len(ev):
        t, k, run = ev[i]
        if k == "P":  # partenza senza arrivo prima: inizio servizio
            rows.append((None, (hhmm(t), run), "prima"))
            i += 1
        elif i + 1 < len(ev) and ev[i + 1][1] == "P":
            rows.append(((hhmm(t), run), (hhmm(ev[i + 1][0]), ev[i + 1][2]), ""))
            i += 2
        else:
            rows.append(((hhmm(t), run), None, "ultima" if i == len(ev) - 1 else ""))
            i += 1
        # partenza seguita da un arrivo molto dopo: la nave ha fatto pausa a Torri
        if rows[-1][1] and i < len(ev) and ev[i][1] == "A":
            dep = minutes(rows[-1][1][0])
            if (ev[i][0] - 30) - (dep + 30) >= 45:  # sosta a Torri da pausa (traversata di 30')
                rows.append((hhmm(dep + 30), hhmm(ev[i][0] - 30), "pausa-torri"))
    return rows


if __name__ == "__main__":
    print("ultima riga a", round(main(sys.argv[1]) / mm, 1), "mm dal basso")
