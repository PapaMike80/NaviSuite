"""Fogli per i passeggeri di uno scalo, in italiano, inglese e tedesco (bianco/nero):
- navi di linea (2 pagine): partenze dallo scalo con l'orario di arrivo nelle localita', e ritorno
  allo scalo (da dove e a che ora si parte, quando si arriva);
- "Prossima partenza per ...": una riga per localita' con le partenze;
- tascabile: A4 orizzontale con le localita' al centro, partenze a sinistra e ritorni a destra;
- traghetto (solo se lo scalo ne ha uno): foglio a parte.
Le coincidenze dell'O.d.S. (cambio di nave) sono segnate con la sigla dello scalo di cambio; i ritorni
compaiono solo se raggiungibili partendo dallo scalo.

I dati di ogni scalo stanno in un modulo (a4_passeggeri_maderno.py, a4_passeggeri_desenzano.py) con:
  NOME, NOME_TITOLO           "MADERNO", "Maderno"
  PARTENZE, RITORNI           righe (orario allo scalo, nota, corsa, [(localita', orario[, cambio])])
  BLOCCHI_PARTENZE/RITORNI    tabelle della pagina: (titolo, sottotitolo, localita' nell'ordine)
  ORDINATI                    True se in ogni riga gli orari diretti crescono lungo le colonne
  PRIMA_CORSA                 ritorni con cambio: {(localita', partenza): corsa su cui si sale}
  ORDINE                      localita' nell'ordine dell'orario ufficiale (Desenzano - Riva)
  PER_RIGA (facoltativo)      partenze per riga nelle liste (6; oltre si va a capo)
  TRAGHETTO                   None oppure dict(nome, etichetta, sotto, andata, ritorno)"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import Color, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm
import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"

GREY = Color(0.25, 0.25, 0.25)
STRIPE = Color(0.93, 0.93, 0.93)
W, H = A4
# sigla dello scalo dove si cambia nave, accanto all'orario raggiungibile con il cambio
SIGLA = {"Garda": "Ga", "Sirmione": "Si", "Salò": "Sa", "Malcesine": "Ma", "Riva": "Ri"}
# corse SR (servizio rapido con supplemento)
SR_CORSE = {"102", "103", "104", "105", "106", "107", "111", "112", "113", "114"}
KEY_W = 34 * mm


def cambio(scalo, arrivo, partenza, corsa):
    """Coincidenza: si scende a `scalo` alle `arrivo` e si riparte alle `partenza` con la `corsa`."""
    return (scalo, arrivo, partenza, corsa)


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


def header(c, L, R, nome, langs, ritorno=False):
    """Nome dello scalo in grande e il titolo in tre lingue; nei ritorni invertiti (scalo a destra, all'arrivo)."""
    c.setFillColor(black); c.setFont("DVB", 40)
    (c.drawRightString if ritorno else c.drawString)(R if ritorno else L, H - 28 * mm, nome)
    c.setFont("DVB", 15)
    for k, s in enumerate(langs):
        (c.drawString if ritorno else c.drawRightString)(L if ritorno else R, H - 18 * mm - k * 6 * mm, s)


def blocco(rows, places):
    """Righe della tabella di un blocco: solo le localita' del blocco, via le righe rimaste vuote."""
    out = []
    for key, note, run, stops in rows:
        ok = [st for st in stops if st[0] in places]
        if ok:
            out.append((key, note, run, ok))
    return out


def matrix(c, L, R, y, rows, places, ritorno, tsize, hsize, ordinati=True, riga=11.5, prima=None):
    """Tabella a colonne. Andata: partenza dallo scalo a sinistra e orario di arrivo in ogni localita'.
    Ritorno: orario di partenza da ogni localita' e arrivo allo scalo a destra. '–' = non ferma;
    sigla dello scalo (Ga, Si...) = orario raggiungibile cambiando nave in quello scalo; sotto la tabella
    una riga per scalo con le corse in coincidenza."""
    changes = {}  # scalo -> {(ripartenza, corsa, corsa SR presa prima del cambio o '')}
    for _, _, _, stops in rows:
        for st in stops:
            assert st[0] in places, st
            if len(st) == 3:
                assert st[2][0] in SIGLA, st
                first = (prima or {}).get((st[0], st[1]), "") if ritorno else ""
                changes.setdefault(st[2][0], set()).add((st[2][2], st[2][3], first if first in SR_CORSE else ""))
        if ordinati:  # senza cambi gli orari crescono da sinistra a destra
            direct = [minutes(t) for p in places for s in stops if s[0] == p and len(s) == 2 for t in [s[1]]]
            assert direct == sorted(direct), stops
    key_w = KEY_W
    cw = (R - L - key_w) / len(places)
    x_places = L if ritorno else L + key_w
    x_key = R - key_w if ritorno else L
    head = 11 * mm
    c.setFillColor(STRIPE); c.rect(L, y - head, R - L, head, stroke=0, fill=1)
    c.setFillColor(black)
    size, scale = hsize
    for i, p in enumerate(places):
        w = pdfmetrics.stringWidth(p, "DVB", size) * scale / 100
        t = c.beginText(x_places + cw * (i + 0.5) - w / 2, y - 6.8 * mm)
        t.setFont("DVB", size); t.setHorizScale(scale); t.textOut(p)
        t.setHorizScale(100)  # la compressione resta attiva nel PDF finche' non si azzera
        c.drawText(t)
    c.setFillColor(GREY); c.setFont("DV", 7.4)
    labels = (("Arrivo · corsa", "Arrival · trip", "Ankunft · Fahrt") if ritorno
              else ("Partenza · corsa", "Departure · trip", "Abfahrt · Fahrt"))
    for k, s in enumerate(labels):
        c.drawString(x_key + 2 * mm, y - 3.4 * mm - k * 2.9 * mm, s)
    y -= head
    rh = riga * mm
    for r, (key, note, run, stops) in enumerate(rows):
        if r % 2:
            c.setFillColor(STRIPE); c.rect(L, y - rh, R - L, rh, stroke=0, fill=1)
        kx = x_key + 26 * mm
        c.setFillColor(black); c.setFont("DVB", 21)
        assert pdfmetrics.stringWidth(key, "DVB", 21) < 25 * mm, key
        ky = y - rh / 2 - 2.45 * mm                      # 8.2 mm con la riga da 11.5
        c.drawRightString(kx, ky, key)
        if note:
            c.setFont("DVB", 9); c.drawString(kx + 1 * mm, ky + 3.4 * mm, note)
        c.setFont("DV", 8.5); c.setFillColor(GREY)
        c.drawString(kx + 1 * mm, ky, run)
        times = {s[0]: s for s in stops}
        for i, p in enumerate(places):
            cx = x_places + cw * (i + 0.5)
            st = times.get(p)
            ty = y - rh / 2 - 1.85 * mm                  # 7.6 mm con la riga da 11.5
            if not st:
                c.setFont("DV", tsize); c.setFillColor(GREY)
                c.drawCentredString(cx, ty, "–")
                continue
            c.setFillColor(black); c.setFont("DV", tsize)
            if len(st) == 3:  # stessa misura degli altri orari, sigla del cambio in apice
                ssize = round(tsize * 0.6, 1)
                tw = pdfmetrics.stringWidth(st[1], "DV", tsize)
                sw = pdfmetrics.stringWidth(SIGLA[st[2][0]], "DVB", ssize)
                c.drawCentredString(cx - sw / 2, ty, st[1])
                c.setFont("DVB", ssize); c.drawString(cx - sw / 2 + tw / 2 + 0.2 * mm, ty + tsize * 0.13 * mm, SIGLA[st[2][0]])
            else:
                c.drawCentredString(cx, ty, st[1])
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
        for n, (scalo, conns) in enumerate(sorted(changes.items(), key=lambda kv: min(minutes(d) for d, _, _ in kv[1]))):
            x = L
            yy = y - 4.6 * mm * (n + 1)
            c.setFillColor(black); c.setFont("DVB", 9.5); c.drawString(x, yy, SIGLA[scalo])
            c.drawString(x + 6.5 * mm, yy, scalo)
            xx = x + 6.5 * mm + pdfmetrics.stringWidth(scalo + "  ", "DVB", 9.5)
            for k, (dep, run, sr_prima) in enumerate(sorted(conns, key=lambda dr: (minutes(dr[0]), dr[2]))):
                piece = ("  ·  " if k else "") + dep
                c.setFillColor(black); c.setFont("DV", 9.5); c.drawString(xx, yy, piece)
                xx += pdfmetrics.stringWidth(piece + " ", "DV", 9.5)
                # SR (solo fino all'11/10): la corsa del cambio, o quella presa prima nei ritorni
                corsa = (f"corsa {sr_prima} SR › {run}" if sr_prima else f"corsa {run}") + (" SR" if run in SR_CORSE else "")
                c.setFillColor(GREY); c.setFont("DV", 7.8); c.drawString(xx, yy, corsa)
                xx += pdfmetrics.stringWidth(corsa, "DV", 7.8)
            assert xx < x + col_w, (scalo, conns)
        y -= 4.6 * mm * len(changes)
    return y


def uniform_sizes(tables, L, R):
    """Un'unica misura per tutti gli orari e una per tutti i nomi delle localita', la piu' grande che
    sta in ogni colonna di tutte le tabelle (orari con sigla del cambio compresi)."""
    tsize, hsize, hscale = 14.0, 9.5, 100.0
    for rows, places in tables:
        cw = (R - L - KEY_W) / len(places)
        widest = max(pdfmetrics.stringWidth(p, "DVB", hsize) for p in places)
        hscale = min(hscale, 100.0 * (cw - 1.6 * mm) / widest)  # nomi lunghi compressi in larghezza
        cells = [s for _, _, _, stops in rows for s in stops]
        def width(st, size):
            w = pdfmetrics.stringWidth(st[1], "DV", size)
            return w + (pdfmetrics.stringWidth(SIGLA[st[2][0]], "DVB", round(size * 0.6, 1)) + 0.2 * mm if len(st) == 3 else 0)
        while max(width(st, tsize) for st in cells) > cw - 1.2 * mm:
            tsize -= 0.1
    return round(tsize, 1), (hsize, int(hscale))


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


# ---------------------------------------------------------------- dati per localita'

def per_destinazione(S):
    """{localita': [(partenza dallo scalo, arrivo, scalo di cambio o '', SR, corsa)]} ordinato per partenza."""
    out = {}
    for dep, note, run, stops in S.PARTENZE:
        for st in stops:
            via = st[2] if len(st) == 3 else None
            sr = note == "SR" or (via is not None and via[3] in SR_CORSE)
            out.setdefault(st[0], []).append((dep, st[1], via[0] if via else "", sr, run))
    if S.TRAGHETTO:
        out[S.TRAGHETTO["nome"]] = [(t, hhmm(minutes(t) + 30), "", False, run) for t, run in S.TRAGHETTO["andata"]]
    return {p: sorted(v, key=lambda e: minutes(e[0])) for p, v in out.items()}


def primo_arrivo(S):
    """{localita': minuti del primo arrivo possibile partendo dallo scalo (anche con cambio)}."""
    return {p: min(minutes(e[1]) for e in v) for p, v in per_destinazione(S).items()}


def possibile(S, place, dep):
    """Un ritorno da `place` alle `dep` ha senso solo se dallo scalo ci si arriva prima."""
    primo = primo_arrivo(S)
    return place in primo and minutes(dep) > primo[place]


def ritorni_possibili(S, rows):
    """Ritorni senza le partenze irraggiungibili dallo scalo; via le righe rimaste vuote."""
    out = []
    for arr, note, run, stops in rows:
        ok = [st for st in stops if possibile(S, st[0], st[1])]
        if ok:
            out.append((arr, note, run, ok))
    return out


def per_origine(S):
    """{localita': [(partenza da li', arrivo allo scalo, scalo di cambio o '', SR, corsa su cui si sale)]}."""
    out = {}
    for arr, note, run, stops in ritorni_possibili(S, S.RITORNI):
        for st in stops:
            first = S.PRIMA_CORSA[(st[0], st[1])] if len(st) == 3 else run
            sr = note == "SR" or first in SR_CORSE
            out.setdefault(st[0], []).append((st[1], arr, st[2][0] if len(st) == 3 else "", sr, first))
    if S.TRAGHETTO:
        nome = S.TRAGHETTO["nome"]
        out[nome] = [(t, hhmm(minutes(t) + 30), "", False, run) for t, run in S.TRAGHETTO["ritorno"]
                     if possibile(S, nome, t)]
    return {p: sorted(v, key=lambda e: (minutes(e[0]), minutes(e[1]))) for p, v in out.items()}


# ---------------------------------------------------------------- fogli

def main(S, out):
    """Navi di linea: pagina 1 partenze, pagina 2 ritorni."""
    nome, Nome = S.NOME, S.NOME_TITOLO
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(f"{Nome} - partenze e ritorni / departures and return / Abfahrten und Rückfahrt")
    L, R = 10 * mm, W - 10 * mm
    andata = [(t, s, blocco(S.PARTENZE, p), p) for t, s, p in S.BLOCCHI_PARTENZE]
    ritorno = [(t, s, blocco(ritorni_possibili(S, S.RITORNI), p), p) for t, s, p in S.BLOCCHI_RITORNI]
    tsize, hsize = uniform_sizes([(rows, p) for _, _, rows, p in andata + ritorno], L, R)

    for pagina, blocchi, langs in ((0, andata, ("Partenze", "Departures", "Abfahrten")),
                                   (1, ritorno, (f"Ritorno a {Nome}", f"Return to {Nome}", f"Rückfahrt nach {Nome}"))):
        header(c, L, R, nome, langs, ritorno=pagina == 1)
        y = H - 40 * mm
        for i, (titolo, sotto, rows, places) in enumerate(blocchi):
            y = bar(c, L, R, y, titolo, sotto)
            y = matrix(c, L, R, y, rows, places, pagina == 1, tsize, hsize, S.ORDINATI,
                       getattr(S, "RIGA_MM", 11.5), S.PRIMA_CORSA) - (
                9 * mm if i == len(blocchi) - 1 else 12 * mm)
        y = note_sr(c, L, R, y)
        assert y > 5 * mm, (f"pagina {pagina + 1}", y / mm)
        c.showPage()
    c.save()
    return tsize, hsize


def ferry_block(c, L, R, y, rows):
    """Partenze del traghetto in due colonne (mattina | pomeriggio): partenza, arrivo, corsa."""
    cols = [[r for r in rows if minutes(r[0]) < 13 * 60 + 30], [r for r in rows if minutes(r[0]) >= 13 * 60 + 30]]
    cw = (R - L) / 2
    rh = 12 * mm
    for k, col in enumerate(cols):
        x = L + k * cw
        for i, (t, run) in enumerate(col):
            yy = y - 9 * mm - i * rh
            if i % 2 == 1:
                c.setFillColor(STRIPE); c.rect(x, yy - 3.8 * mm, cw, rh, stroke=0, fill=1)
            c.setFillColor(black); c.setFont("DVB", 26)
            c.drawRightString(x + 36 * mm, yy, t)
            c.setFont("DV", 15)
            c.drawString(x + 40 * mm, yy, f"›  {hhmm(minutes(t) + 30)}")
            c.setFont("DV", 9.5); c.setFillColor(GREY)
            c.drawString(x + 66 * mm, yy, run)
    c.setStrokeColor(black); c.setLineWidth(0.3)
    c.line(L + cw, y - 3 * mm, L + cw, y - 5 * mm - rh * max(map(len, cols)))
    return y - 5 * mm - rh * max(map(len, cols))


def main_traghetto(S, out):
    """Foglio a parte per il traghetto (andata e ritorno)."""
    T = S.TRAGHETTO
    altro = T["etichetta"]
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle(f"Traghetto {S.NOME_TITOLO} - {T['nome']} / Ferry / Fähre")
    L, R = 12 * mm, W - 12 * mm
    c.setFillColor(black); c.setFont("DVB", 34)
    c.drawString(L, H - 25 * mm, f"{S.NOME} ⇄ {altro}")
    c.setFont("DVB", 15)
    c.drawString(L, H - 34 * mm, "Traghetto  ·  Ferry  ·  Fähre")
    c.setFont("DV", 11); c.setFillColor(GREY)
    c.drawString(L, H - 41 * mm, "partenza › arrivo  ·  departure › arrival  ·  Abfahrt › Ankunft   (30')")
    y = H - 52 * mm
    y = bar(c, L, R, y, f"{S.NOME}  ›  {T['nome'].upper()}")
    y = ferry_block(c, L, R, y, T["andata"]) - 12 * mm
    y = bar(c, L, R, y, f"{T['nome'].upper()}  ›  {S.NOME}")
    y = ferry_block(c, L, R, y, [r for r in T["ritorno"] if possibile(S, T["nome"], r[0])])
    assert y > 10 * mm, y / mm
    c.showPage()
    c.save()
