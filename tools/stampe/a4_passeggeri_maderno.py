"""A4 per i passeggeri di Maderno, in italiano, inglese e tedesco (2 pagine):
1. partenze da Maderno e orario di arrivo nelle localita';
2. ritorno a Maderno: da dove e a che ora si parte, e quando si arriva.
Con le coincidenze dell'O.d.S. (cambio di nave): l'orario raggiungibile cambiando e' segnato con
una lettera che rimanda alla nota del cambio.
Orario invernale 2026/27, O.d.S. n. 39/2026 (orari pag. 15-17, coincidenze "ai fini tariffari")."""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm
import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"

GREY = Color(0.25, 0.25, 0.25)
STRIPE = Color(0.93, 0.93, 0.93)
W, H = A4


def cambio(scalo, arrivo, partenza, corsa):
    """Coincidenza: si scende a `scalo` alle `arrivo` e si riparte alle `partenza` con la `corsa`."""
    return (scalo, arrivo, partenza, corsa)


# ---- partenze da Maderno: (partenza, nota, corsa, [(localita', arrivo[, cambio])]) ----
PARTENZE_NORD = [
    ("10.41", "SR", "102", [("Gargnano", "10.59"), ("Malcesine", "11.32"), ("Limone", "11.47"), ("Riva", "12.10"),
                            ("Torbole", "13.10", cambio("Malcesine", "11.32", "12.20", "56"))]),
    ("11.31", "", "2", [("Gargnano", "12.01"), ("Brenzone", "12.29"), ("Malcesine", "12.54"), ("Limone", "13.14"),
                        ("Riva", "13.50"), ("Torbole", "14.40", cambio("Riva", "13.50", "14.25", "57"))]),
    ("16.58", "", "8", [("Gargnano", "17.28"), ("Brenzone", "17.56"), ("Malcesine", "18.20"), ("Limone", "18.40"),
                        ("Torbole", "19.10"), ("Riva", "19.25")]),
    ("17.24", "SR", "114", [("Malcesine", "18.05"), ("Limone", "18.18"), ("Torbole", "18.38"), ("Riva", "18.55")]),
]
PARTENZE_SUD = [
    ("9.15", "", "91", [("Gardone", "9.30"), ("Salò", "9.45"), ("Portese", "9.55"), ("Garda", "10.40"),
                        ("Bardolino", "10.55"), ("Lazise", "11.12"), ("Sirmione", "11.53"), ("Desenzano", "12.15")]),
    ("10.09", "SR", "111", [("Gardone", "10.19"), ("Salò", "10.32"), ("Garda", "11.02"), ("Sirmione", "11.30"),
                            ("Peschiera", "11.55"),
                            ("Portese", "11.40", cambio("Salò", "10.32", "11.29", "7")),
                            ("Bardolino", "12.45", cambio("Garda", "11.02", "12.30", "23")),
                            ("Lazise", "13.02", cambio("Garda", "11.02", "12.30", "23")),
                            ("Desenzano", "12.15", cambio("Sirmione", "11.30", "11.53", "91"))]),
    ("11.03", "", "7", [("Gardone", "11.16"), ("Salò", "11.29"), ("Portese", "11.40"), ("Garda", "12.23"),
                        ("Sirmione", "13.09"), ("Desenzano", "13.30"),
                        ("Bardolino", "12.45", cambio("Garda", "12.23", "12.30", "23")),
                        ("Lazise", "13.02", cambio("Garda", "12.23", "12.30", "23")),
                        ("Peschiera", "13.30", cambio("Garda", "12.23", "12.30", "23"))]),
    ("14.00", "", "17", [("Gardone", "14.14"), ("Salò", "14.28"), ("Portese", "14.40"), ("Garda", "15.23"),
                         ("Bardolino", "15.38"), ("Lazise", "15.55"), ("Sirmione", "16.35"), ("Desenzano", "16.55")]),
    ("16.30", "SR", "107", [("Gardone", "16.41"), ("Salò", "16.54"), ("Garda", "17.22"), ("Sirmione", "17.51"),
                            ("Peschiera", "18.30"),
                            ("Portese", "17.46", cambio("Salò", "16.54", "17.35", "3")),
                            ("Bardolino", "17.50", cambio("Garda", "17.22", "17.35", "39")),
                            ("Lazise", "18.07", cambio("Garda", "17.22", "17.35", "39")),
                            ("Desenzano", "19.00", cambio("Sirmione", "17.51", "18.40", "27"))]),
    ("17.08", "", "3", [("Gardone", "17.21"), ("Salò", "17.35"), ("Portese", "17.46"), ("Garda", "18.30"),
                        ("Bardolino", "18.45"), ("Lazise", "19.02"), ("Peschiera", "19.30"),
                        ("Sirmione", "19.20", cambio("Garda", "18.30", "18.35", "19")),
                        ("Desenzano", "19.40", cambio("Garda", "18.30", "18.35", "19"))]),
]
# ---- ritorno a Maderno: (arrivo a Maderno, nota, corsa, [(localita', partenza[, cambio])]) ----
RITORNI_NORD = [
    ("10.09", "SR", "111", [("Riva", "8.40"), ("Torbole", "8.55"), ("Limone", "9.15"), ("Malcesine", "9.28"),
                            ("Gargnano", "9.52")]),
    ("11.03", "", "7", [("Riva", "8.45"), ("Limone", "9.20"), ("Malcesine", "9.40"), ("Brenzone", "10.04"),
                        ("Gargnano", "10.32"), ("Torbole", "8.25", cambio("Malcesine", "9.15", "9.40", "7"))]),
    ("16.30", "SR", "107", [("Riva", "15.20"), ("Limone", "15.41"), ("Malcesine", "15.55"),
                            ("Torbole", "15.00", cambio("Riva", "15.15", "15.20", "107"))]),
    ("17.08", "", "3", [("Riva", "14.50"), ("Limone", "15.25"), ("Malcesine", "15.46"), ("Brenzone", "16.10"),
                        ("Gargnano", "16.37"), ("Torbole", "14.40", cambio("Malcesine", "15.30", "15.46", "3"))]),
]
RITORNI_SUD = [
    ("10.41", "SR", "102", [("Peschiera", "9.00"), ("Sirmione", "9.26"), ("Garda", "9.49"), ("Salò", "10.18"),
                            ("Gardone", "10.29"),
                            ("Desenzano", "8.50", cambio("Sirmione", "9.10", "9.26", "102")),
                            ("Lazise", "8.53", cambio("Garda", "9.25", "9.49", "102")),
                            ("Bardolino", "9.10", cambio("Garda", "9.25", "9.49", "102"))]),
    ("11.31", "", "2", [("Peschiera", "9.10"), ("Lazise", "9.38"), ("Bardolino", "9.55"), ("Garda", "10.10"),
                        ("Portese", "10.53"), ("Salò", "11.04"), ("Gardone", "11.18"),
                        ("Desenzano", "8.50", cambio("Garda", "9.55", "10.10", "2")),
                        ("Sirmione", "9.10", cambio("Garda", "9.55", "10.10", "2"))]),
    ("13.00", "", "16", [("Desenzano", "10.05"), ("Sirmione", "10.25"), ("Lazise", "11.04"), ("Bardolino", "11.21"),
                         ("Garda", "11.36"), ("Portese", "12.19"), ("Salò", "12.31"), ("Gardone", "12.44")]),
    ("16.58", "", "8", [("Desenzano", "14.30"), ("Sirmione", "14.51"), ("Garda", "15.37"), ("Portese", "16.20"),
                        ("Salò", "16.32"), ("Gardone", "16.45"),
                        ("Peschiera", "14.30", cambio("Garda", "15.30", "15.37", "8")),
                        ("Lazise", "14.58", cambio("Garda", "15.30", "15.37", "8")),
                        ("Bardolino", "15.15", cambio("Garda", "15.30", "15.37", "8"))]),
    ("17.24", "SR", "114", [("Peschiera", "15.35"), ("Sirmione", "16.03"), ("Bardolino", "16.24"), ("Garda", "16.35"),
                            ("Salò", "17.02"), ("Gardone", "17.13"),
                            ("Desenzano", "15.35", cambio("Sirmione", "15.55", "16.03", "114"))]),
    ("19.25", "", "94", [("Garda", "18.00"), ("Portese", "18.45"), ("Salò", "18.55"), ("Gardone", "19.10")]),
]
# sigla dello scalo dove si cambia nave, accanto all'orario raggiungibile con il cambio
SIGLA = {"Garda": "Ga", "Sirmione": "Si", "Salò": "Sa", "Malcesine": "Ma", "Riva": "Ri"}
# localita' nell'ordine in cui le tocca la nave
NORD = ["Gargnano", "Brenzone", "Malcesine", "Limone", "Torbole", "Riva"]
SUD = ["Gardone", "Salò", "Portese", "Garda", "Bardolino", "Lazise", "Sirmione", "Peschiera", "Desenzano"]
SUD_RITORNO = ["Desenzano", "Peschiera", "Sirmione", "Lazise", "Bardolino", "Garda", "Portese", "Salò", "Gardone"]
# Traghetto Torri del Benaco - Maderno (30'): (partenza, corsa) - pag. 17
TRAGHETTO_ANDATA = [("8.10", "201"), ("8.45", "231"), ("9.25", "203"), ("10.10", "233"), ("10.50", "205"),
                    ("11.30", "235"), ("12.10", "207"), ("12.50", "237"), ("14.20", "209"), ("15.05", "239"),
                    ("15.50", "211"), ("16.40", "241"), ("17.20", "213"), ("18.00", "243")]
TRAGHETTO_RITORNO = [("8.45", "202"), ("9.25", "232"), ("10.10", "204"), ("10.50", "234"), ("11.30", "206"),
                     ("12.10", "236"), ("12.50", "208"), ("14.20", "238"), ("15.05", "210"), ("15.50", "240"),
                     ("16.40", "212"), ("17.20", "242"), ("18.00", "214"), ("18.40", "244")]


def minutes(t):
    h, m = t.split(".")
    return int(h) * 60 + int(m)


def hhmm(n):
    return f"{n // 60}.{n % 60:02d}"


def bar(c, L, R, y, left, right=""):
    c.setFillColor(black)
    c.rect(L, y - 3 * mm, R - L, 10 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 15)
    c.drawString(L + 3 * mm, y, left)
    c.setFont("DV", 10)
    c.drawRightString(R - 3 * mm, y + 0.4 * mm, right)
    return y - 3 * mm


def header(c, L, R, langs):
    c.setFillColor(black); c.setFont("DVB", 40)
    c.drawString(L, H - 28 * mm, "MADERNO")
    c.setFont("DVB", 15)
    for k, s in enumerate(langs):
        c.drawRightString(R, H - 18 * mm - k * 6 * mm, s)


def matrix(c, L, R, y, rows, places, ritorno):
    """Tabella a colonne. Andata: partenza da Maderno a sinistra e orario di arrivo in ogni localita'.
    Ritorno: orario di partenza da ogni localita' e arrivo a Maderno a destra. '–' = non ferma;
    sigla dello scalo (Ga, Si...) = orario raggiungibile cambiando nave in quello scalo; sotto la tabella
    una riga per scalo con le corse in coincidenza."""
    changes = {}  # scalo -> {(ripartenza, corsa)}
    for _, _, _, stops in rows:
        for st in stops:
            assert st[0] in places, st
            if len(st) == 3:
                assert st[2][0] in SIGLA, st
                changes.setdefault(st[2][0], set()).add((st[2][2], st[2][3]))
        direct = [minutes(t) for p in places for s in stops if s[0] == p and len(s) == 2 for t in [s[1]]]
        assert direct == sorted(direct), stops  # senza cambi gli orari crescono da sinistra a destra
    key_w = 34 * mm
    cw = (R - L - key_w) / len(places)
    x_places = L if ritorno else L + key_w
    x_key = R - key_w if ritorno else L
    head = 11 * mm
    c.setFillColor(STRIPE); c.rect(L, y - head, R - L, head, stroke=0, fill=1)
    c.setFillColor(black)
    for i, p in enumerate(places):
        size = 10
        while pdfmetrics.stringWidth(p, "DVB", size) > cw - 1.5 * mm:
            size -= 0.2
        c.setFont("DVB", size)
        c.drawCentredString(x_places + cw * (i + 0.5), y - 6.8 * mm, p)
    c.setFillColor(GREY); c.setFont("DV", 7.4)
    labels = (("Arrivo · corsa", "Arrival · trip", "Ankunft · Fahrt") if ritorno
              else ("Partenza · corsa", "Departure · trip", "Abfahrt · Fahrt"))
    for k, s in enumerate(labels):
        c.drawString(x_key + 2 * mm, y - 3.4 * mm - k * 2.9 * mm, s)
    y -= head
    rh = 10.5 * mm
    for r, (key, note, run, stops) in enumerate(rows):
        if r % 2:
            c.setFillColor(STRIPE); c.rect(L, y - rh, R - L, rh, stroke=0, fill=1)
        kx = x_key + 26 * mm
        c.setFillColor(black); c.setFont("DVB", 21)
        assert pdfmetrics.stringWidth(key, "DVB", 21) < 25 * mm, key
        c.drawRightString(kx, y - 7.8 * mm, key)
        if note:
            c.setFont("DVB", 9); c.drawString(kx + 1 * mm, y - 4.4 * mm, note)
        c.setFont("DV", 8.5); c.setFillColor(GREY)
        c.drawString(kx + 1 * mm, y - 7.8 * mm, run)
        times = {s[0]: s for s in stops}
        for i, p in enumerate(places):
            cx = x_places + cw * (i + 0.5)
            st = times.get(p)
            if not st:
                c.setFont("DV", 11); c.setFillColor(GREY)
                c.drawCentredString(cx, y - 7.2 * mm, "–")
                continue
            c.setFillColor(black)
            if len(st) == 3:
                tw = pdfmetrics.stringWidth(st[1], "DV", 11)
                sw = pdfmetrics.stringWidth(SIGLA[st[2][0]], "DVB", 7.2)
                c.setFont("DV", 11); c.drawCentredString(cx - sw / 2 - 0.2 * mm, y - 7.2 * mm, st[1])
                c.setFont("DVB", 7.2); c.drawString(cx - sw / 2 + tw / 2, y - 5.3 * mm, SIGLA[st[2][0]])
                assert tw + sw + 0.2 * mm < cw - 0.6 * mm, (st, cw / mm)
            else:
                c.setFont("DV", 13); c.drawCentredString(cx, y - 7.2 * mm, st[1])
        y -= rh
    c.setStrokeColor(black); c.setLineWidth(0.3)
    for i in range(len(places) + 1):
        x = x_places + cw * i
        c.line(x, y, x, y + rh * len(rows) + head)
    # coincidenze raggruppate per scalo di cambio: sigla, scalo e corse in partenza da li'
    if changes:
        y -= 5 * mm
        c.setFont("DV", 8.6); c.setFillColor(GREY)
        c.drawString(L, y, "cambio nave  ·  change ship  ·  Umsteigen")
        col_w = R - L
        for n, (scalo, conns) in enumerate(sorted(changes.items(), key=lambda kv: min(minutes(d) for d, _ in kv[1]))):
            x = L
            yy = y - 4.6 * mm * (n + 1)
            c.setFillColor(black); c.setFont("DVB", 9.5); c.drawString(x, yy, SIGLA[scalo])
            c.drawString(x + 6.5 * mm, yy, scalo)
            xx = x + 6.5 * mm + pdfmetrics.stringWidth(scalo + "  ", "DVB", 9.5)
            for k, (dep, run) in enumerate(sorted(conns, key=lambda dr: minutes(dr[0]))):
                piece = ("  ·  " if k else "") + dep
                c.setFillColor(black); c.setFont("DV", 9.5); c.drawString(xx, yy, piece)
                xx += pdfmetrics.stringWidth(piece + " ", "DV", 9.5)
                c.setFillColor(GREY); c.setFont("DV", 7.8); c.drawString(xx, yy, f"corsa {run}")
                xx += pdfmetrics.stringWidth(f"corsa {run}", "DV", 7.8)
            assert xx < x + col_w, (scalo, conns)
        y -= 4.6 * mm * len(changes)
    return y


def ferry(c, L, R, y, rows, ritorno):
    """Partenze del traghetto; al ritorno anche l'arrivo a Maderno (traversata di 30')."""
    cols = 4 if ritorno else 5
    cw = (R - L) / cols
    for i, (t, run) in enumerate(rows):
        r, k = divmod(i, cols)
        x = L + k * cw
        yy = y - 8.6 * mm - r * 11.5 * mm
        if r % 2 == 1:
            c.setFillColor(STRIPE); c.rect(x, yy - 3.4 * mm, cw, 11.5 * mm, stroke=0, fill=1)
        extra = f"› {hhmm(minutes(t) + 30)}" if ritorno else ""
        tw = pdfmetrics.stringWidth(t, "DVB", 18)
        ew = pdfmetrics.stringWidth(extra + " ", "DV", 10.5) if extra else 0
        x0 = x + cw / 2 - (tw + 1 * mm + ew + pdfmetrics.stringWidth(run, "DV", 8.5)) / 2
        c.setFillColor(black); c.setFont("DVB", 18)
        c.drawString(x0, yy, t)
        if extra:
            c.setFont("DV", 10.5); c.drawString(x0 + tw + 1 * mm, yy, extra)
        c.setFont("DV", 8.5); c.setFillColor(GREY)
        c.drawString(x0 + tw + 1 * mm + ew, yy, run)
    return y - 8.6 * mm - 11.5 * mm * ((len(rows) - 1) // cols) - 6 * mm


def note_sr(c, L, R, y):
    c.setFillColor(black); c.setFont("DVB", 11); c.drawString(L, y, "SR")
    c.setFont("DV", 9.5)
    for k, s in enumerate(("servizio rapido con supplemento, fino all'11 ottobre 2026 (anche i cambi con SR)",
                           "fast service with extra charge, until 11 October 2026 (also changes with SR)",
                           "Schnelldienst mit Zuschlag, bis zum 11. Oktober 2026 (auch Umsteigen mit SR)")):
        c.setFillColor(black if k == 0 else GREY)
        assert pdfmetrics.stringWidth(s, "DV", 9.5) <= R - L - 10 * mm, s
        c.drawString(L + 10 * mm, y - k * 4.3 * mm, s)
    return y - 13 * mm


def main(out):
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Maderno - partenze e ritorni / departures and return / Abfahrten und Rückfahrt")
    L, R = 12 * mm, W - 12 * mm

    # pagina 1: partenze
    header(c, L, R, ("Partenze", "Departures", "Abfahrten"))
    y = H - 40 * mm
    y = bar(c, L, R, y, "▲  RIVA DEL GARDA", "nord  ·  north  ·  Norden")
    y = matrix(c, L, R, y, PARTENZE_NORD, NORD, ritorno=False) - 11 * mm
    y = bar(c, L, R, y, "▼  DESENZANO  ·  PESCHIERA", "sud  ·  south  ·  Süden")
    y = matrix(c, L, R, y, PARTENZE_SUD, SUD, ritorno=False) - 11 * mm
    y = bar(c, L, R, y, "⇄  TORRI DEL BENACO", "traghetto  ·  ferry  ·  Fähre   30'")
    y = ferry(c, L, R, y, TRAGHETTO_ANDATA, ritorno=False)
    y = note_sr(c, L, R, y)
    assert y > 5 * mm, ("pagina 1", y / mm)
    c.showPage()

    # pagina 2: ritorni
    header(c, L, R, ("Ritorno a Maderno", "Return to Maderno", "Rückfahrt nach Maderno"))
    y = H - 40 * mm
    y = bar(c, L, R, y, "▼  DA RIVA DEL GARDA", "da nord  ·  from north  ·  aus Norden")
    y = matrix(c, L, R, y, RITORNI_NORD, list(reversed(NORD)), ritorno=True) - 11 * mm
    y = bar(c, L, R, y, "▲  DA DESENZANO  ·  PESCHIERA", "da sud  ·  from south  ·  aus Süden")
    y = matrix(c, L, R, y, RITORNI_SUD, SUD_RITORNO, ritorno=True) - 11 * mm
    y = bar(c, L, R, y, "⇄  DA TORRI DEL BENACO", "partenza › arrivo  ·  departure › arrival   30'")
    y = ferry(c, L, R, y, TRAGHETTO_RITORNO, ritorno=True)
    y = note_sr(c, L, R, y)
    assert y > 5 * mm, ("pagina 2", y / mm)
    c.showPage()
    c.save()
    return y


if __name__ == "__main__":
    print("ultima riga a", round(main(sys.argv[1]) / mm, 1), "mm dal basso")
