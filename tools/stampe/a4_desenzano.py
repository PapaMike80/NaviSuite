"""Foglio A4 Desenzano - pontile e AgB, orario dal 05/10/2026 (O.d.S. 39/2026, pag. 15-19).

Dati (ROWS, BOLGETTE, settimana) usati da a4_desenzano_colori.py, che genera la stampa a colori e il
tascabile; main() e' la vecchia versione in bianco e nero, non piu' generata da genera.py."""
import sys, re, json, datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm

import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"
BLUE = Color(0, 0, 0)
TEAL = Color(0, 0, 0)
STRIPE = Color(0.93, 0.93, 0.93)
GREY = Color(0.20, 0.20, 0.20)
W, H = A4

# (ora, P/A, turno, corsa, da/per)
ROWS = [
    ("8.30", "P", "BIS", "", "per Garda (a disposizione)"),
    ("8.50", "P", "D2", "20", "per Lazise (via Garda)"),
    ("9.15", "P", "D1", "14", "per Sirmione"),
    ("9.55", "A", "D1", "15", "da Sirmione"),
    ("10.05", "P", "D1", "16", "per Maderno"),
    ("10.30", "A", "P2", "31", "da Lazise"),
    ("10.40", "P", "P2", "32", "per Sirmione"),
    ("11.20", "A", "P2", "33", "da Sirmione"),
    ("11.25", "P", "P2", "34", "per Garda"),
    ("12.15", "A", "M1", "91", "da Maderno"),
    ("13.15", "P", "M1", "92", "per Gardone"),
    ("13.30", "A", "R1", "7", "da Riva"),
    ("14.30", "P", "R1", "8", "per Riva"),
    ("15.25", "A", "P2", "35", "da Garda"),
    ("15.35", "P", "P2", "36", "per Sirmione"),
    ("16.15", "A", "P2", "37", "da Sirmione"),
    ("16.20", "P", "P2", "38", "per Garda"),
    ("16.55", "A", "D1", "17", "da Maderno"),
    ("17.05", "P", "D1", "18", "per Garda"),
    ("18.40", "A", "BIS", "", "da Garda"),
    ("19.00", "A", "D2", "27", "da Lazise"),
    ("19.40", "A", "D1", "19", "da Garda"),
]


def main(out, ormeggi, lunedi):
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Desenzano - pontile e AgB - orario dal 5 ottobre 2026")
    L, R = 18 * mm, W - 18 * mm

    # intestazione
    c.setFillColor(BLUE)
    c.setFont("DVB", 26)
    c.drawString(L, H - 24 * mm, "DESENZANO")
    c.setFont("DV", 12)
    c.drawString(L, H - 30.5 * mm, "Pontile e AgB - navi in ordine di orario e ormeggi serali")
    c.setFont("DV", 9.5)
    c.setFillColor(GREY)
    c.drawString(L, H - 36 * mm, "Dal 5 ottobre all'1 novembre 2026 e dal 13 al 25 marzo 2027  ·  O.d.S. n. 39/2026")

    # servizi a terra
    box_top = H - 40 * mm
    box_h = 20 * mm
    bw = (R - L - 6 * mm) / 2
    for i, (code, a, b, note) in enumerate((
            ("AgB", "8.00 – 11.50", "12.50 – 17.30", "dalle 7.45 con rifornimento D2  ·  assistenza alla c. 8"),
            ("PonD", "9.30 – 13.35", "15.00 – 19.50", "8 ore 55'"))):
        x = L + i * (bw + 6 * mm)
        c.setStrokeColor(BLUE); c.setLineWidth(1)
        c.roundRect(x, box_top - box_h, bw, box_h, 3 * mm, stroke=1, fill=0)
        c.setFillColor(BLUE)
        c.setFont("DVB", 16)
        c.drawString(x + 5 * mm, box_top - 9 * mm, code)
        c.setFont("DV", 13)
        c.drawRightString(x + bw - 5 * mm, box_top - 8 * mm, a)
        c.drawRightString(x + bw - 5 * mm, box_top - 14 * mm, b)
        c.setFont("DV", 7.5); c.setFillColor(GREY)
        c.drawString(x + 5 * mm, box_top - 17.5 * mm, note)

    # tabella navi
    cols = [("ORA", L + 3 * mm), ("", L + 26 * mm), ("TURNO", L + 58 * mm),
            ("CORSA", L + 80 * mm), ("DA / PER", L + 102 * mm)]
    y = box_top - box_h - 9 * mm
    c.setFillColor(BLUE)
    c.rect(L, y - 2.6 * mm, R - L, 8 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 9)
    for label, x in cols:
        c.drawString(x, y, label)
    row_h = 6.4 * mm
    for i, (t, kind, code, run, where) in enumerate(ROWS):
        y -= row_h
        if i % 2 == 0:
            c.setFillColor(STRIPE)
            c.rect(L, y - 2.1 * mm, R - L, row_h, stroke=0, fill=1)
        if t == "14.30":  # stacco tra mattina e pomeriggio
            c.setStrokeColor(BLUE); c.setLineWidth(1.2)
            c.line(L, y + row_h - 2.1 * mm, R, y + row_h - 2.1 * mm)
        col = BLUE if kind == "P" else TEAL
        c.setFillColor(BLUE); c.setFont("DVB", 15)
        c.drawRightString(L + 20 * mm, y, t)
        c.setFillColor(col); c.setFont("DVB", 10.5)
        c.drawString(cols[1][1], y + 0.4 * mm, "PARTENZA" if kind == "P" else "ARRIVO")
        c.setFillColor(BLUE); c.setFont("DVB", 15)
        c.drawString(cols[2][1], y, code)
        c.setFont("DV", 12)
        c.drawString(cols[3][1], y, run or "–")
        c.drawString(cols[4][1], y, where)
        if run in BOLGETTE:  # etichetta in negativo, visibile anche in bianco e nero
            label = BOLGETTE[run]
            lw = pdfmetrics.stringWidth(label, "DVB", 9) + 5 * mm
            c.setFillColor(BLUE); c.roundRect(R - lw - 1 * mm, y - 1.6 * mm, lw, 5.4 * mm, 1.5 * mm, stroke=0, fill=1)
            c.setFillColor(white); c.setFont("DVB", 9); c.drawCentredString(R - 1 * mm - lw / 2, y, label)
            assert cols[4][1] + pdfmetrics.stringWidth(where, "DV", 12) + 2 * mm < R - lw - 1 * mm, where

    # ormeggi serali della settimana (lun-dom) dagli allegati "Turno navi" degli O.d.S.;
    # R accanto al pontile = rifornimento quella mattina, prima delle corse
    days = [lunedi + datetime.timedelta(days=i) for i in range(7)]
    known = [d.isoformat() for d in days if d.isoformat() in ormeggi]
    y -= 10 * mm
    c.setFillColor(BLUE); c.setFont("DVB", 12)
    title = f"ORMEGGI SERALI  {days[0].day}/{days[0].month} – {days[-1].day}/{days[-1].month}"
    c.drawString(L, y, title)
    ods = sorted({v["ods"] for d in known for v in ormeggi[d].values()})
    c.setFont("DV", 8.5); c.setFillColor(GREY)
    c.drawString(L + pdfmetrics.stringWidth(title, "DVB", 12) + 4 * mm, y,
                 "nave e pontile della sera  ·  R = rifornimento  ·  turno navi O.d.S. " + (", ".join(map(str, ods)) or "–"))
    groups = [g for g in ("D1", "D2", "D3", "D4", "BIS")
              if any(g in ormeggi[d] and ormeggi[d][g]["ormeggio"] for d in known)] or ["D1", "D2", "BIS"]
    lab_w = 12 * mm
    dw = (R - L - lab_w) / 7
    rh = 8.6 * mm
    y -= 8 * mm
    c.setFillColor(BLUE)
    c.rect(L, y - 2.3 * mm, R - L, 7 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 9)
    gg = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]
    for i, d in enumerate(days):
        c.drawCentredString(L + lab_w + dw * (i + 0.5), y, f"{gg[i]} {d.day}/{d.month}")
    table_top = y - 2.3 * mm
    for gi, g in enumerate(groups):
        y -= rh
        if gi % 2 == 0:
            c.setFillColor(STRIPE); c.rect(L, y - 3.4 * mm, R - L, rh, stroke=0, fill=1)
        c.setFillColor(BLUE); c.setFont("DVB", 12)
        c.drawString(L + 1.5 * mm, y - 0.4 * mm, g)
        for i, d in enumerate(days):
            x0 = L + lab_w + dw * i
            cx = x0 + dw / 2
            if d.isoformat() not in ormeggi:
                if gi == 0:
                    c.setFont("DV", 6.5); c.setFillColor(GREY)
                    c.drawCentredString(cx, y + 1.2 * mm, "nel prossimo")
                    c.drawCentredString(cx, y - 1.8 * mm, "O.d.S.")
                    c.setFillColor(BLUE)
                continue
            v = ormeggi[d.isoformat()].get(g)
            if not v:
                c.setFont("DV", 10); c.drawCentredString(cx, y, "–")
                continue
            # riga 1: pontile grande (+ R); riga 2: nome nave
            num = v["ormeggio"].replace("pont.", "").replace("Pont.", "").strip() or "–"
            c.setFont("DVB", 14)
            nw = pdfmetrics.stringWidth(num, "DVB", 14)
            if v["rif"]:
                rw = pdfmetrics.stringWidth("R", "DVB", 9) + 1.2 * mm
                c.drawString(cx - (nw + rw) / 2, y + 0.6 * mm, num)
                c.setFont("DVB", 9); c.drawString(cx - (nw + rw) / 2 + nw + 1.2 * mm, y + 0.9 * mm, "R")
            else:
                c.drawCentredString(cx, y + 0.6 * mm, num)
            name = re.sub(r"\s*(\([A-Z]\)|©)", "", v["nave"]).replace(" + ", "+")
            size = 7.4
            while size > 5.4 and pdfmetrics.stringWidth(name, "DV", size) > dw - 2 * mm:
                size -= 0.2
            c.setFont("DV", size); c.drawCentredString(cx, y - 2.6 * mm, name)
    c.setStrokeColor(BLUE); c.setLineWidth(0.4)
    for i in range(1, 7):
        x0 = L + lab_w + dw * i
        c.line(x0, y - 3.4 * mm, x0, table_top)

    # regole rifornimenti (O.d.S. 39, "Rifornimenti") e note
    y -= 8 * mm
    c.setFillColor(BLUE); c.setFont("DVB", 8.6)
    c.drawString(L, y, "R = rifornimento a Desenzano prima dell'inizio delle corse, per quanto possibile a cura di AgB o PonD:")
    c.setFont("DV", 8.4)
    for s in ("D1 martedì e venerdì  ·  D2 lunedì e giovedì (eventuale rabbocco il mercoledì avvisando la Direzione)",
              "D1 e D2: motorista mezz'ora prima del normale orario  ·  BIS tutti i giorni, liberato il pontile 5 o 3"):
        y -= 4.3 * mm
        assert pdfmetrics.stringWidth(s, "DV", 8.4) <= R - L, s
        c.drawString(L, y, s)
    y -= 5.6 * mm
    c.setFillColor(BLUE); c.setFont("DVB", 8.6)
    for s in ("Bolgette Maderno e Riva: arrivano con la R1 c. 7 alle 13.30, ripartono con la R1 c. 8 alle 14.30.",
              "Bolgetta Cantiere Peschiera: arriva con le c. 30 e 31 alle 10.30, riparte con le c. 38 e 39 alle 16.20."):
        assert pdfmetrics.stringWidth(s, "DVB", 8.6) <= R - L, s
        c.drawString(L, y, s)
        y -= 4.3 * mm
    y += 4.3 * mm
    c.setFillColor(GREY); c.setFont("DV", 8.2)
    y -= 0.6 * mm
    for s in ("BIS: pronti a muovere alle 8.30 verso Garda, a disposizione dell'Ufficio Movimento, rientro alle 18.40.",
              "Dal 2 novembre 2026 al 12 marzo 2027 nessuna corsa di linea a Desenzano."):
        y -= 4.3 * mm
        assert pdfmetrics.stringWidth(s, "DV", 8.2) <= R - L, s
        c.drawString(L, y, s)
    assert y > 7 * mm, y / mm
    c.showPage()
    c.save()
    return y


# bolgette: arrivano con la R1 della mattina e ripartono con la R1 del pomeriggio (corsa: etichetta)
# Maderno e Riva - Direzione: R1 all'andata e al ritorno (corse 7 e 8);
# Cantiere di Peschiera - Direzione: andata corse 30 e 31, ritorno corse 38 e 39
BOLGETTE = {"7": "BOLGETTA · ARRIVA", "8": "BOLGETTA · PARTE", "31": "BOLGETTA · ARRIVA", "38": "BOLGETTA · PARTE"}


def settimana(oggi):
    """Lunedi' della settimana da stampare: quella in corso, oppure la prossima da venerdi' in poi
    (l'O.d.S. esce il venerdi' e copre fino al venerdi' successivo)."""
    oggi = datetime.date.fromisoformat(oggi) if isinstance(oggi, str) else oggi
    lunedi = oggi - datetime.timedelta(days=oggi.weekday())
    return lunedi + datetime.timedelta(days=7) if oggi.weekday() >= 4 else lunedi


if __name__ == "__main__":
    # uso: a4_desenzano.py out.pdf ormeggi.json [AAAA-MM-GG oggi]
    oggi = sys.argv[3] if len(sys.argv) > 3 else datetime.date.today().isoformat()
    print("ultima riga a", round(main(sys.argv[1], json.load(open(sys.argv[2])), settimana(oggi)) / mm, 1),
          "mm dal basso")
