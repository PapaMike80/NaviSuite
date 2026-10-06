"""A4 per i passeggeri: partenze da Maderno e dove si arriva, in italiano, inglese e tedesco.
Orario invernale 2026/27 (O.d.S. n. 39/2026, pag. 15-17); le frasi trilingui delle note sono
quelle dell'orario ufficiale."""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color, black
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm
import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"

GREY = Color(0.25, 0.25, 0.25)
STRIPE = Color(0.93, 0.93, 0.93)
W, H = A4

# (partenza, nota, [(scalo, arrivo)]) - nota "SR" = servizio rapido, solo fino all'11/10
NORD = [
    ("10.41", "SR", [("Gargnano", "10.59"), ("Malcesine", "11.32"), ("Limone", "11.47"), ("Riva", "12.10")]),
    ("11.31", "", [("Gargnano", "12.01"), ("Brenzone", "12.29"), ("Malcesine", "12.54"), ("Limone", "13.14"),
                   ("Riva", "13.50")]),
    ("16.58", "", [("Gargnano", "17.28"), ("Brenzone", "17.56"), ("Malcesine", "18.20"), ("Limone", "18.40"),
                   ("Torbole", "19.10"), ("Riva", "19.25")]),
    ("17.24", "SR", [("Malcesine", "18.05"), ("Limone", "18.18"), ("Torbole", "18.38"), ("Riva", "18.55")]),
]
SUD = [
    ("9.15", "", [("Gardone", "9.30"), ("Salò", "9.45"), ("Portese", "9.55"), ("Garda", "10.40"),
                  ("Bardolino", "10.55"), ("Lazise", "11.12"), ("Sirmione", "11.53"), ("Desenzano", "12.15")]),
    ("10.09", "SR", [("Gardone", "10.19"), ("Salò", "10.32"), ("Garda", "11.02"), ("Sirmione", "11.30"),
                     ("Peschiera", "11.55")]),
    ("11.03", "", [("Gardone", "11.16"), ("Salò", "11.29"), ("Portese", "11.40"), ("Garda", "12.23"),
                   ("Sirmione", "13.09"), ("Desenzano", "13.30")]),
    ("14.00", "", [("Gardone", "14.14"), ("Salò", "14.28"), ("Portese", "14.40"), ("Garda", "15.23"),
                   ("Bardolino", "15.38"), ("Lazise", "15.55"), ("Sirmione", "16.35"), ("Desenzano", "16.55")]),
    ("16.30", "SR", [("Gardone", "16.41"), ("Salò", "16.54"), ("Garda", "17.22"), ("Sirmione", "17.51"),
                     ("Peschiera", "18.30")]),
    ("17.08", "", [("Gardone", "17.21"), ("Salò", "17.35"), ("Portese", "17.46"), ("Garda", "18.30"),
                   ("Bardolino", "18.45"), ("Lazise", "19.02"), ("Peschiera", "19.30")]),
]
# numero di corsa per ora di partenza da Maderno (O.d.S. 39/2026 pag. 15-16)
CORSA = {"10.41": "102", "11.31": "2", "16.58": "8", "17.24": "114",
         "9.15": "91", "10.09": "111", "11.03": "7", "14.00": "17", "16.30": "107", "17.08": "3"}
# Traghetto per Torri del Benaco (30'): (partenza, corsa) - pag. 17
TRAGHETTO = [("8.10", "201"), ("8.45", "231"), ("9.25", "203"), ("10.10", "233"), ("10.50", "205"),
             ("11.30", "235"), ("12.10", "207"), ("12.50", "237"), ("14.20", "209"), ("15.05", "239"),
             ("15.50", "211"), ("16.40", "241"), ("17.20", "213"), ("18.00", "243")]


def bar(c, L, R, y, left, right=""):
    c.setFillColor(black)
    c.rect(L, y - 3 * mm, R - L, 10 * mm, stroke=0, fill=1)
    c.setFillColor(Color(1, 1, 1)); c.setFont("DVB", 15)
    c.drawString(L + 3 * mm, y, left)
    c.setFont("DV", 10)
    c.drawRightString(R - 3 * mm, y + 0.4 * mm, right)
    return y - 3 * mm


# localita' nell'ordine in cui le tocca la nave
ORDINE_NORD = ["Gargnano", "Brenzone", "Malcesine", "Limone", "Torbole", "Riva"]
ORDINE_SUD = ["Gardone", "Salò", "Portese", "Garda", "Bardolino", "Lazise", "Sirmione", "Peschiera", "Desenzano"]


def matrix(c, L, R, y, rows, places):
    """Tabella a colonne: partenza da Maderno e orario di arrivo in ogni localita' ('–' = non ferma)."""
    assert {n for _, _, st in rows for n, _ in st} <= set(places)
    for _, _, st in rows:  # in ogni riga gli orari devono crescere da sinistra a destra
        ts = [float(t) for t in sorted(st, key=lambda s_: places.index(s_[0])) for t in [t[1]]]
        assert ts == sorted(ts), st
    first = 31 * mm
    cw = (R - L - first) / len(places)
    head = 11 * mm
    c.setFillColor(STRIPE); c.rect(L, y - head, R - L, head, stroke=0, fill=1)
    c.setFillColor(GREY); c.setFont("DV", 7.4)
    for k, s in enumerate(("Partenza · corsa", "Departure · trip", "Abfahrt · Fahrt")):
        c.drawString(L + 2 * mm, y - 3.4 * mm - k * 2.9 * mm, s)
    c.setFillColor(black)
    for i, p in enumerate(places):
        size = 10
        while pdfmetrics.stringWidth(p, "DVB", size) > cw - 1.5 * mm:
            size -= 0.2
        c.setFont("DVB", size)
        c.drawCentredString(L + first + cw * (i + 0.5), y - 6.8 * mm, p)
    y -= head
    rh = 10.5 * mm
    for r, (dep, note, stops) in enumerate(rows):
        if r % 2:
            c.setFillColor(STRIPE); c.rect(L, y - rh, R - L, rh, stroke=0, fill=1)
        c.setFillColor(black); c.setFont("DVB", 22)
        c.drawRightString(L + 22 * mm, y - 7.8 * mm, dep)
        if note:
            c.setFont("DVB", 9); c.drawString(L + 23 * mm, y - 4.4 * mm, note)
        c.setFont("DV", 8.5); c.setFillColor(GREY)
        c.drawString(L + 23 * mm, y - 7.8 * mm, CORSA[dep])
        times = dict(stops)
        for i, p in enumerate(places):
            cx = L + first + cw * (i + 0.5)
            t = times.get(p)
            c.setFont("DV" if t else "DV", 13 if t else 11)
            c.setFillColor(black if t else GREY)
            c.drawCentredString(cx, y - 7.2 * mm, t or "–")
        y -= rh
    c.setStrokeColor(black); c.setLineWidth(0.3)
    for i in range(len(places) + 1):
        x = L + first + cw * i
        c.line(x, y, x, y + rh * len(rows) + head)
    return y


def main(out):
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Maderno - partenze / departures / Abfahrten")
    L, R = 12 * mm, W - 12 * mm

    c.setFillColor(black); c.setFont("DVB", 40)
    c.drawString(L, H - 28 * mm, "MADERNO")
    c.setFont("DVB", 15)
    c.drawRightString(R, H - 18 * mm, "Partenze")
    c.drawRightString(R, H - 24 * mm, "Departures")
    c.drawRightString(R, H - 30 * mm, "Abfahrten")

    y = H - 46 * mm
    y = bar(c, L, R, y, "▲  RIVA DEL GARDA", "nord  ·  north  ·  Norden")
    y = matrix(c, L, R, y, NORD, ORDINE_NORD)
    y -= 10 * mm
    y = bar(c, L, R, y, "▼  DESENZANO  ·  PESCHIERA", "sud  ·  south  ·  Süden")
    y = matrix(c, L, R, y, SUD, ORDINE_SUD)

    # traghetto
    y -= 10 * mm
    y = bar(c, L, R, y, "⇄  TORRI DEL BENACO", "traghetto  ·  ferry  ·  Fähre   30'")
    cols = 5
    cw = (R - L) / cols
    for i, (t, run) in enumerate(TRAGHETTO):
        r, k = divmod(i, cols)
        x = L + k * cw
        yy = y - 8.6 * mm - r * 11.5 * mm
        if r % 2 == 1:
            c.setFillColor(STRIPE); c.rect(x, yy - 3.4 * mm, cw, 11.5 * mm, stroke=0, fill=1)
        tw = pdfmetrics.stringWidth(t, "DVB", 18)
        x0 = x + cw / 2 - (tw + 1 * mm + pdfmetrics.stringWidth(run, "DV", 8.5)) / 2
        c.setFillColor(black); c.setFont("DVB", 18)
        c.drawString(x0, yy, t)
        c.setFont("DV", 8.5); c.setFillColor(GREY)
        c.drawString(x0 + tw + 1 * mm, yy, run)
    y = y - 8.6 * mm - 11.5 * mm * ((len(TRAGHETTO) - 1) // cols) - 12 * mm

    # note, una riga per lingua
    notes = [
        ("SR", ("servizio rapido con supplemento, fino all'11 ottobre 2026",
                "fast service with extra charge, until 11 October 2026",
                "Schnelldienst mit Zuschlag, bis zum 11. Oktober 2026")),
    ]
    for mark, texts in notes:
        c.setFillColor(black); c.setFont("DVB", 11); c.drawString(L, y, mark)
        c.setFont("DV", 9.5)
        for k, s in enumerate(texts):
            c.setFillColor(black if k == 0 else GREY)
            assert pdfmetrics.stringWidth(s, "DV", 9.5) <= R - L - 10 * mm, s
            c.drawString(L + 10 * mm, y - k * 4.3 * mm, s)
        y -= 15 * mm
    assert y > 8 * mm, y / mm
    c.showPage()
    c.save()
    return y


if __name__ == "__main__":
    print("ultima riga a", round(main(sys.argv[1]) / mm, 1), "mm dal basso")
