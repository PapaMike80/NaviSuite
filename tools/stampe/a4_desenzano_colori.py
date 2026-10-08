"""Desenzano - pontile e AgB nei colori di NaviSuite: A4 a colori e tascabile per il pontilista.

Stessi dati del foglio in bianco e nero (a4_desenzano.py: navi in ordine di orario, ormeggi serali
della settimana con i rifornimenti, regole e bolgette), con i colori dell'app:
- colori(out, ormeggi, lunedi): A4 da appendere, intestazione blu notte, turni nei loro colori,
  PARTENZA verde acqua e ARRIVO azzurro, bolgette in arancio, R del rifornimento in giallo;
- tascabile(out, ormeggi, lunedi): A4 da tagliare in 4 cartoncini A6 (10,5 x 14,8 cm), da stampare
  fronte/retro sul lato lungo: davanti le navi in ordine di orario, dietro servizi a terra, ormeggi
  serali della settimana e note. I 4 cartoncini sono uguali, quindi fronte e retro coincidono sempre.
"""
import datetime
import re
import sys
import json

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"
from a4_desenzano import ROWS, BOLGETTE, settimana

W, H = A4
# Colori di NaviSuite, scuriti quanto serve per la carta bianca
NOTTE = HexColor("#0b2530")     # intestazioni (fondo dell'app)
NOTTE2 = HexColor("#123a47")
TEAL = HexColor("#2dd4bf")      # accento dell'app
TEAL_SCURO = HexColor("#0f8f80")
AZZURRO = HexColor("#1f7fbf")
INCHIOSTRO = HexColor("#102a33")
GRIGIO = HexColor("#5a7680")
RIGA = HexColor("#eef7f7")      # righe alternate
BORDO = HexColor("#c9e3e6")
ARANCIO = HexColor("#f59e0b")
GIALLO = HexColor("#facc15")
TURNI = {"D1": "#3b6fe0", "R1": "#3b6fe0", "P1": "#3b6fe0", "T1": "#3b6fe0",
         "D2": "#1f9d63", "R2": "#1f9d63", "P2": "#1f9d63", "T2": "#1f9d63",
         "M1": "#e07b2a", "R3": "#e07b2a", "D3": "#e07b2a", "D4": "#c25bbd",
         "BIS": "#0e9fb3", "SR1": "#7c5ce0", "SR2": "#7c5ce0"}
GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"]
SERVIZI = (("AgB", "8.00 – 11.50", "12.50 – 17.30", "8 ore 30' (Lun/Giov 8 ore 45', rifornimento D2)"),
           ("PonD", "9.30 – 13.35", "15.00 – 19.50", "8 ore 55'"))
ANTICIPO = {"AgB": "7.45 Lun/Giov"}   # inizio anticipato per il rifornimento D2
VALIDITA = "Dal 5 ottobre all'1 novembre 2026 e dal 13 al 25 marzo 2027  ·  O.d.S. n. 39/2026"
REGOLE_R = ("D1 martedì e venerdì  ·  D2 lunedì e giovedì (eventuale rabbocco il mercoledì avvisando la Direzione)",
            "D1 e D2: motorista mezz'ora prima del normale orario  ·  BIS tutti i giorni, liberato il pontile 5 o 3")
NOTE_BOLGETTE = ("Bolgette Maderno e Riva: arrivano con la R1 c. 7 alle 13.30, ripartono con la R1 c. 8 alle 14.30.",
                 "Bolgetta Cantiere Peschiera: arriva con le c. 30 e 31 alle 10.30, riparte con le c. 38 e 39 alle 16.20.")
NOTE = ("BIS: pronti a muovere alle 8.30 verso Garda, a disposizione dell'Ufficio Movimento, rientro alle 18.40.",
        "Dal 2 novembre 2026 al 12 marzo 2027 nessuna corsa di linea a Desenzano.")


def colore(code):
    return HexColor(TURNI.get(code, "#64748b"))


def chip(c, x, y, code, size=11, h=5.6 * mm, w=None):
    """Turno in una pastiglia colorata (testo bianco), x a sinistra, y linea di base del testo."""
    w = w or pdfmetrics.stringWidth(code, "DVB", size) + 4 * mm
    c.setFillColor(colore(code))
    c.roundRect(x, y - h * 0.32, w, h, h / 2, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", size)
    c.drawCentredString(x + w / 2, y, code)
    return w


def etichetta(c, x_destra, y, testo, fondo, inchiostro, size=8.6, h=5.2 * mm):
    """Etichetta arrotondata allineata a destra (bolgette, R)."""
    w = pdfmetrics.stringWidth(testo, "DVB", size) + 4 * mm
    c.setFillColor(fondo)
    c.roundRect(x_destra - w, y - h * 0.32, w, h, 1.6 * mm, stroke=0, fill=1)
    c.setFillColor(inchiostro); c.setFont("DVB", size)
    c.drawCentredString(x_destra - w / 2, y, testo)
    return w


def gruppi_settimana(ormeggi, days):
    known = [d.isoformat() for d in days if d.isoformat() in ormeggi]
    gruppi = [g for g in ("D1", "D2", "D3", "D4", "BIS")
              if any(g in ormeggi[d] and ormeggi[d][g]["ormeggio"] for d in known)] or ["D1", "D2", "BIS"]
    ods = sorted({v["ods"] for d in known for v in ormeggi[d].values()})
    return gruppi, ods


def pontile(v):
    return v["ormeggio"].replace("pont.", "").replace("Pont.", "").strip() or "–"


def nome_nave(v):
    return re.sub(r"\s*(\([A-Z]\)|©)", "", v["nave"]).replace(" + ", "+")


# ------------------------------------------------------------------ agenti di servizio
FIREBASE_KEY = "AIzaSyBfJZWHjr3AIANDBj2p8uQ0_hbcHdmnSiE"   # chiave pubblica dell'app (come assets/js/admin-firebase-rest.js)
FIREBASE_DB = "https://navisuite-f116f-default-rtdb.europe-west1.firebasedatabase.app"
SIGLE_TERRA = {"AGB": "AgB", "POND": "PonD"}


def sigla_terra(turno):
    m = re.match(r"^C?(AGB|POND)C?$", re.sub(r"[^A-Z]", "", str(turno or "").upper()))
    return SIGLE_TERRA[m.group(1)] if m else ""


def turni_firebase():
    """Turni come li vede l'app: orario pubblicato, turni importati da Aggiornamenti e variazioni
    (O.d.S. e manuali). Accesso anonimo come l'app."""
    import urllib.request

    def get(url, data=None):
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    tok = get(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_KEY}", b'{"returnSecureToken":true}')["idToken"]
    lista = lambda v: [x for x in (v if isinstance(v, list) else list((v or {}).values())) if x]
    priv = lambda k: lista(get(f"{FIREBASE_DB}/private/adminUpdates/{k}.json?auth={tok}"))
    return {"schedule": get(f"{FIREBASE_DB}/public/schedule.json"), "imports": priv("scheduleImports"),
            "variazioni": priv("odsVariations") + priv("manualVariations")}


def agenti_settimana(days, dati=None):
    """{giorno ISO: {"AgB": [nomi], "PonD": [nomi]}} per Desenzano; vuoto senza rete o senza turni."""
    if dati is None:
        try:
            dati = turni_firebase()
        except Exception as e:  # senza rete: righe da compilare a mano
            print("Agenti di servizio non disponibili:", e)
            return {}
    giorni = {d.isoformat() for d in days}
    turno = {}   # (giorno, chiave agente) -> turno ; nomi[chiave] = (nome, residenza)
    nomi = {}
    # chiave: il cognome e l'iniziale senza punti/spazi (gli id cambiano fra orario, import e variazioni)
    norm = lambda n: re.sub(r"[^A-Z]", "", str(n or "").upper())

    def chiave(n):
        k = norm(n)
        return next((x for x in nomi if x.startswith(k)), k) if k and k not in nomi else k
    for res, agenti in ((dati.get("schedule") or {}).get("residenze") or {}).items():
        for a in agenti or []:
            k = norm(a.get("agente"))
            nomi[k] = (a.get("agente", ""), res.upper())
            for g, t in (a.get("turni") or {}).items():
                if g in giorni:
                    turno[(g, k)] = t
    for imp in sorted((i for i in dati.get("imports") or [] if i.get("attiva") is not False), key=lambda i: str(i.get("importedAt", ""))):
        date = imp.get("dates") or []
        for r in imp.get("rows") or []:
            k = norm(r.get("agente"))
            nomi[k] = (r.get("agente") or nomi.get(k, ("", ""))[0], str(r.get("residenza") or nomi.get(k, ("", ""))[1]).upper())
            for g, t in zip(date, r.get("turni") or []):
                if g in giorni:
                    turno[(g, k)] = t
    for v in sorted((v for v in dati.get("variazioni") or [] if v.get("attiva", True) is not False), key=lambda v: str(v.get("inserita_il", ""))):
        if v.get("data") in giorni and v.get("turno_nuovo"):
            k = chiave(v.get("agente"))
            nomi.setdefault(k, (v.get("agente", ""), ""))
            turno[(v["data"], k)] = v["turno_nuovo"]
    out = {g: {"AgB": [], "PonD": []} for g in giorni}
    for (g, k), t in sorted(turno.items()):
        sigla = sigla_terra(t)
        nome, res = nomi.get(k, ("", ""))
        if sigla and nome:  # AgB e PonD sono servizi di Desenzano (la residenza negli import non sempre e' aggiornata)
            out[g][sigla].append(re.sub(r"\s+", " ", nome).strip() + ("*" if "*" in str(t) else ""))
    return out


# Orari di servizio di AgB e PonD: barre tipo evidenziatore accanto alle corse che cadono nel loro
# orario (interrotte nella pausa pranzo).
SERV_COL = {"AgB": HexColor("#ec4899"), "PonD": HexColor("#f97316")}


def evidenzia(c, x0, bw, gap, righe):
    """righe: [(ora, y alto, y basso)] delle corse; per ogni servizio una barra per fascia oraria
    (mattina e pomeriggio), sulle corse che cadono nella fascia."""
    for k, (code, a, b, _) in enumerate(SERVIZI):
        bx = x0 + k * (bw + gap)
        for fascia in (a, b):
            da, al = (tm(v) for v in fascia.split(" – "))
            dentro = [r for r in righe if da <= tm(r[0]) <= al]
            if not dentro:
                continue
            c.saveState(); c.setFillColor(SERV_COL[code]); c.setFillAlpha(0.6)
            c.roundRect(bx, dentro[-1][2] + 0.4 * mm, bw, dentro[0][1] - dentro[-1][2] - 0.8 * mm, bw / 2, stroke=0, fill=1)
            c.restoreState()


def legenda_servizi(c, x, y, size=6.6):
    for code, a, b, _ in SERVIZI:
        testo = f"{code} {a}  ·  {b}"
        c.saveState(); c.setFillColor(SERV_COL[code]); c.setFillAlpha(0.6)
        c.roundRect(x, y - 0.6 * mm, 4 * mm, 3 * mm, 0.8 * mm, stroke=0, fill=1); c.restoreState()
        c.setFillColor(INCHIOSTRO); c.setFont("DVB", size); c.drawString(x + 5.2 * mm, y, testo)
        x += 5.2 * mm + pdfmetrics.stringWidth(testo, "DVB", size) + 5 * mm


# ------------------------------------------------------------------ A4 a colori
def colori(out, ormeggi, lunedi):
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Desenzano - pontile e AgB - a colori - orario dal 5 ottobre 2026")
    L, R = 16 * mm, W - 16 * mm

    # intestazione blu notte con la striscia verde acqua di NaviSuite
    band = 29 * mm
    c.setFillColor(NOTTE); c.rect(0, H - band, W, band, stroke=0, fill=1)
    c.setFillColor(TEAL); c.rect(0, H - band - 1.6 * mm, W, 1.6 * mm, stroke=0, fill=1)
    c.setFillColor(TEAL); c.setFont("DVB", 8.5)
    c.drawString(L, H - 8.5 * mm, "N A V I S U I T E   ·   S E R V I Z I   A   T E R R A")
    c.setFillColor(white); c.setFont("DVB", 27)
    c.drawString(L, H - 18.5 * mm, "DESENZANO")
    c.setFont("DV", 11.5)
    c.drawString(L + pdfmetrics.stringWidth("DESENZANO", "DVB", 27) + 5 * mm, H - 18.5 * mm, "pontile e AgB")
    c.setFillColor(HexColor("#9bc8d5")); c.setFont("DV", 8.8)
    c.drawString(L, H - 24.8 * mm, VALIDITA)

    # servizi a terra: riquadri tinti
    box_top = H - band - 5 * mm
    box_h = 19 * mm
    bw = (R - L - 6 * mm) / 2
    for i, (code, a, b, note) in enumerate(SERVIZI):
        x = L + i * (bw + 6 * mm)
        c.setFillColor(RIGA); c.setStrokeColor(BORDO); c.setLineWidth(0.8)
        c.roundRect(x, box_top - box_h, bw, box_h, 3 * mm, stroke=1, fill=1)
        c.setFillColor(TEAL_SCURO); c.roundRect(x, box_top - box_h, 2.2 * mm, box_h, 1.1 * mm, stroke=0, fill=1)
        c.setFillColor(NOTTE); c.setFont("DVB", 17)
        c.drawString(x + 6 * mm, box_top - 9 * mm, code)
        c.setFont("DVB", 12.5)
        c.drawRightString(x + bw - 5 * mm, box_top - 7.5 * mm, a)
        c.drawRightString(x + bw - 5 * mm, box_top - 13 * mm, b)
        if code in ANTICIPO:  # AgB: 7.45 il lunedi' e il giovedi' (rifornimento D2)
            c.setFont("DVB", 8.6); c.setFillColor(TEAL_SCURO)
            c.drawRightString(x + bw - 7 * mm - pdfmetrics.stringWidth(a, "DVB", 12.5), box_top - 7.5 * mm, ANTICIPO[code])
        c.setFont("DV", 7.4); c.setFillColor(GRIGIO)
        # nota su due righe se serve: la prima sotto la sigla, accanto agli orari
        righe = note.split("\n")
        for k, riga in enumerate(righe):
            c.drawString(x + 6 * mm, box_top - (16.6 - 3.4 * (len(righe) - 1 - k)) * mm, riga)

    # navi in ordine di orario
    cols = [("ORA", L + 3 * mm), ("", L + 25 * mm), ("TURNO", L + 55 * mm), ("CORSA", L + 77 * mm), ("DA / PER", L + 97 * mm)]
    y = box_top - box_h - 9 * mm
    c.setFillColor(NOTTE2); c.roundRect(L, y - 2.6 * mm, R - L, 8 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 8.8)
    for label, x in cols:
        c.drawString(x, y, label)
    row_h = 6.4 * mm
    righe = []
    for i, (t, kind, code, run, where) in enumerate(ROWS):
        y -= row_h
        righe.append((t, y - 2.1 * mm + row_h, y - 2.1 * mm))
        if i % 2 == 0:
            c.setFillColor(RIGA); c.rect(L, y - 2.1 * mm, R - L, row_h, stroke=0, fill=1)
        if t == "14.30":  # stacco tra mattina e pomeriggio
            c.setStrokeColor(TEAL_SCURO); c.setLineWidth(1.2)
            c.line(L, y + row_h - 2.1 * mm, R, y + row_h - 2.1 * mm)
        c.setFillColor(INCHIOSTRO); c.setFont("DVB", 15)
        c.drawRightString(L + 20 * mm, y, t)
        c.setFillColor(TEAL_SCURO if kind == "P" else AZZURRO); c.setFont("DVB", 9.6)
        c.drawString(cols[1][1], y + 0.4 * mm, "PARTENZA" if kind == "P" else "ARRIVO")
        chip(c, cols[2][1], y, code, size=10.5, w=15 * mm)
        c.setFillColor(INCHIOSTRO); c.setFont("DV", 11.5)
        c.drawString(cols[3][1], y, run or "–")
        c.drawString(cols[4][1], y, where)
        if run in BOLGETTE:
            etichetta(c, R - 1 * mm, y, BOLGETTE[run], ARANCIO, NOTTE, size=8.6)
    # orari di servizio di AgB e PonD, a destra della tabella (legenda sopra la tabella)
    evidenzia(c, R + 2 * mm, 2.6 * mm, 1.4 * mm, righe)
    legenda_servizi(c, L + 1 * mm, righe[0][1] + 2.1 * mm + 6.2 * mm, size=7)

    # ormeggi serali della settimana (nave e pontile della sera; R = rifornimento la mattina)
    days = [lunedi + datetime.timedelta(days=i) for i in range(7)]
    gruppi, ods = gruppi_settimana(ormeggi, days)
    y -= 10 * mm
    c.setFillColor(NOTTE); c.setFont("DVB", 12)
    title = f"ORMEGGI SERALI  {days[0].day}/{days[0].month} – {days[-1].day}/{days[-1].month}"
    c.drawString(L, y, title)
    c.setFont("DV", 8.2); c.setFillColor(GRIGIO)
    c.drawString(L + pdfmetrics.stringWidth(title, "DVB", 12) + 4 * mm, y,
                 "nave e pontile della sera  ·  R = rifornimento  ·  turno navi O.d.S. " + (", ".join(map(str, ods)) or "–"))
    lab_w = 15 * mm
    dw = (R - L - lab_w) / 7
    rh = 8.6 * mm
    y -= 8 * mm
    c.setFillColor(NOTTE2); c.roundRect(L, y - 2.3 * mm, R - L, 7 * mm, 2 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 8.8)
    for i, d in enumerate(days):
        c.drawCentredString(L + lab_w + dw * (i + 0.5), y, f"{GIORNI[i]} {d.day}/{d.month}")
    table_top = y - 2.3 * mm
    for gi, g in enumerate(gruppi):
        y -= rh
        if gi % 2 == 0:
            c.setFillColor(RIGA); c.rect(L, y - 3.4 * mm, R - L, rh, stroke=0, fill=1)
        chip(c, L + 1 * mm, y - 0.4 * mm, g, size=9.5, h=5.2 * mm, w=12 * mm)
        for i, d in enumerate(days):
            cx = L + lab_w + dw * (i + 0.5)
            if d.isoformat() not in ormeggi:
                if gi == 0:
                    c.setFont("DV", 6.4); c.setFillColor(GRIGIO)
                    c.drawCentredString(cx, y + 1.2 * mm, "nel prossimo")
                    c.drawCentredString(cx, y - 1.8 * mm, "O.d.S.")
                continue
            v = ormeggi[d.isoformat()].get(g)
            c.setFillColor(INCHIOSTRO)
            if not v:
                c.setFont("DV", 10); c.drawCentredString(cx, y, "–")
                continue
            num = pontile(v)
            c.setFont("DVB", 14)
            nw = pdfmetrics.stringWidth(num, "DVB", 14)
            if v["rif"]:
                rw = 4.2 * mm
                x0 = cx - (nw + rw + 1 * mm) / 2
                c.drawString(x0, y + 0.6 * mm, num)
                c.setFillColor(GIALLO); c.roundRect(x0 + nw + 1 * mm, y + 0.1 * mm, rw, 4.4 * mm, 1.2 * mm, stroke=0, fill=1)
                c.setFillColor(NOTTE); c.setFont("DVB", 8.5); c.drawCentredString(x0 + nw + 1 * mm + rw / 2, y + 1.1 * mm, "R")
            else:
                c.drawCentredString(cx, y + 0.6 * mm, num)
            name = nome_nave(v)
            size = 7.2
            while size > 5.4 and pdfmetrics.stringWidth(name, "DV", size) > dw - 2 * mm:
                size -= 0.2
            c.setFillColor(GRIGIO); c.setFont("DV", size); c.drawCentredString(cx, y - 2.6 * mm, name)
    c.setStrokeColor(BORDO); c.setLineWidth(0.5)
    for i in range(1, 7):
        x0 = L + lab_w + dw * i
        c.line(x0, y - 3.4 * mm, x0, table_top)

    # regole dei rifornimenti, bolgette e note
    y -= 8 * mm
    c.setFillColor(GIALLO); c.roundRect(L, y - 1.4 * mm, 4.2 * mm, 4.4 * mm, 1.2 * mm, stroke=0, fill=1)
    c.setFillColor(NOTTE); c.setFont("DVB", 8.5); c.drawCentredString(L + 2.1 * mm, y - 0.4 * mm, "R")
    c.setFont("DVB", 8.4)
    c.drawString(L + 6 * mm, y - 0.4 * mm, "rifornimento a Desenzano prima dell'inizio delle corse, per quanto possibile a cura di AgB o PonD:")
    c.setFont("DV", 8.2); c.setFillColor(INCHIOSTRO)
    for s in REGOLE_R:
        y -= 4.3 * mm
        assert pdfmetrics.stringWidth(s, "DV", 8.2) <= R - L, s
        c.drawString(L, y, s)
    y -= 5.8 * mm
    for s in NOTE_BOLGETTE:
        c.setFillColor(ARANCIO); c.roundRect(L, y - 1.4 * mm, 4.2 * mm, 4.4 * mm, 1.2 * mm, stroke=0, fill=1)
        c.setFillColor(NOTTE); c.setFont("DVB", 8.5); c.drawCentredString(L + 2.1 * mm, y - 0.4 * mm, "B")
        c.setFont("DVB", 8.2)
        assert L + 6 * mm + pdfmetrics.stringWidth(s, "DVB", 8.2) <= R, s
        c.drawString(L + 6 * mm, y - 0.4 * mm, s)
        y -= 5 * mm
    c.setFillColor(GRIGIO); c.setFont("DV", 8)
    for s in NOTE:
        assert pdfmetrics.stringWidth(s, "DV", 8) <= R - L, s
        c.drawString(L, y, s)
        y -= 4.2 * mm
    assert y > 6 * mm, y / mm
    c.showPage()
    c.save()
    return y


# ------------------------------------------------------------------ tascabile A6 (4 per A4)
CW, CH = 105 * mm, 148.5 * mm     # cartoncino: un quarto di A4


def segni_taglio(c):
    """Linee tratteggiate a meta' foglio: si taglia in 4."""
    c.setStrokeColor(HexColor("#9aa9ad")); c.setLineWidth(0.3); c.setDash(2, 2)
    c.line(W / 2, 0, W / 2, H)
    c.line(0, H / 2, W, H / 2)
    c.setDash()


def intestazione_carta(c, x, y, titolo, sotto):
    """Banda blu notte in cima al cartoncino (x, y = angolo in basso a sinistra del cartoncino)."""
    band = 13 * mm
    c.setFillColor(NOTTE); c.rect(x, y + CH - band, CW, band, stroke=0, fill=1)
    c.setFillColor(TEAL); c.rect(x, y + CH - band - 0.9 * mm, CW, 0.9 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 12.5)
    c.drawString(x + 5 * mm, y + CH - 6.6 * mm, titolo)
    c.setFillColor(HexColor("#9bc8d5")); c.setFont("DV", 6.6)
    c.drawString(x + 5 * mm, y + CH - 10.6 * mm, sotto)
    return y + CH - band - 0.9 * mm


def tm(t):
    h, m = t.split(".")
    return int(h) * 60 + int(m)


def fronte(c, x, y):
    """Navi in ordine di orario."""
    top = intestazione_carta(c, x, y, "DESENZANO · PONTILE", "Navi in ordine di orario  ·  O.d.S. n. 39/2026")
    L, R = x + 4 * mm, x + CW - 4 * mm
    row_h = 5.5 * mm
    yy = top - 4.6 * mm
    R -= 3 * mm   # a destra le barre degli orari di AgB e PonD
    righe = []
    for i, (t, kind, code, run, where) in enumerate(ROWS):
        righe.append((t, yy - 1.9 * mm + row_h, yy - 1.9 * mm))
        if i % 2 == 0:
            c.setFillColor(RIGA); c.rect(L - 1 * mm, yy - 1.9 * mm, R - L + 2 * mm, row_h, stroke=0, fill=1)
        if t == "14.30":
            c.setStrokeColor(TEAL_SCURO); c.setLineWidth(0.9)
            c.line(L - 1 * mm, yy + row_h - 1.9 * mm, R + 1 * mm, yy + row_h - 1.9 * mm)
        c.setFillColor(INCHIOSTRO); c.setFont("DVB", 10.5)
        c.drawRightString(L + 11 * mm, yy, t)
        c.setFillColor(TEAL_SCURO if kind == "P" else AZZURRO); c.setFont("DVB", 6.3)
        c.drawString(L + 12.5 * mm, yy + 0.3 * mm, "PART." if kind == "P" else "ARR.")
        chip(c, L + 22 * mm, yy, code, size=7.2, h=4.2 * mm, w=10 * mm)
        c.setFillColor(GRIGIO); c.setFont("DV", 6.6)
        c.drawString(L + 33.5 * mm, yy + 0.2 * mm, f"c. {run}" if run else "–")
        testo = where.replace(" (a disposizione)", " (a disp.)")
        c.setFillColor(INCHIOSTRO); c.setFont("DV", 8)
        limite = R - (6 * mm if run in BOLGETTE else 0)
        assert L + 42 * mm + pdfmetrics.stringWidth(testo, "DV", 8) <= limite, testo
        c.drawString(L + 42 * mm, yy, testo)
        if run in BOLGETTE:
            c.setFillColor(ARANCIO); c.circle(R - 2.2 * mm, yy + 1 * mm, 2.2 * mm, stroke=0, fill=1)
            c.setFillColor(NOTTE); c.setFont("DVB", 7); c.drawCentredString(R - 2.2 * mm, yy - 0.1 * mm, "B")
        yy -= row_h
    c.setFillColor(GRIGIO); c.setFont("DV", 6.2)
    c.drawString(L, y + 4 * mm, "B = bolgetta  ·  AgB 7.45 Lun/Giov (rifornimento D2)")
    evidenzia(c, R + 1.2 * mm, 1.5 * mm, 0.7 * mm, righe)
    legenda_servizi(c, L, y + 8.2 * mm, size=6.2)
    assert yy + row_h - 1.9 * mm > y + 11.5 * mm, (yy - y) / mm


RIF_FISSI = {"D1": (1, 4), "D2": (0, 3), "BIS": tuple(range(7))}   # giorni (0 = lunedi')


def retro(c, x, y, ormeggi, days, agenti=None, vuoto=False):
    """Servizi a terra, ormeggi serali della settimana con chi e' di servizio, note."""
    agenti = agenti or {}
    gruppi, ods = gruppi_settimana(ormeggi, days)
    if vuoto:  # versione pulita da compilare a mano: niente date, pontili, O.d.S. e agenti
        gruppi, ormeggi, agenti = ["D1", "D2", "BIS"], {}, {}
    top = intestazione_carta(c, x, y, "ORMEGGI SERALI  ___ / ___ – ___ / ___" if vuoto else f"ORMEGGI SERALI {days[0].day}/{days[0].month} – {days[-1].day}/{days[-1].month}",
                             "pontile della sera  ·  R = rifornimento  ·  da compilare" if vuoto else "pontile della sera  ·  R = rifornimento  ·  O.d.S. " + (", ".join(map(str, ods)) or "–"))
    L, R = x + 4 * mm, x + CW - 4 * mm
    # servizi a terra: orario e pausa pranzo
    yy = top - 3 * mm
    bw = (R - L - 3 * mm) / 2
    for i, (code, a, b, _) in enumerate(SERVIZI):
        bx = L + i * (bw + 3 * mm)
        c.setFillColor(RIGA); c.setStrokeColor(BORDO); c.setLineWidth(0.5)
        c.roundRect(bx, yy - 11 * mm, bw, 11 * mm, 2 * mm, stroke=1, fill=1)
        c.setFillColor(NOTTE); c.setFont("DVB", 10.5); c.drawString(bx + 2.5 * mm, yy - 6.8 * mm, code)
        c.setFont("DVB", 7.6)
        c.drawRightString(bx + bw - 2.2 * mm, yy - 4.4 * mm, a)
        c.drawRightString(bx + bw - 2.2 * mm, yy - 8.6 * mm, b)
    yy -= 15 * mm
    # ormeggi: una riga per giorno, una colonna per gruppo, poi chi e' di servizio AgB e PonD
    lab_w = 13 * mm
    ag_w = 36 * mm
    gw = (R - L - lab_w - ag_w) / len(gruppi)
    AX = R - ag_w + 1.5 * mm
    c.setFillColor(NOTTE2); c.roundRect(L, yy - 1.6 * mm, R - L, 5.6 * mm, 1.5 * mm, stroke=0, fill=1)
    for gi, g in enumerate(gruppi):
        chip(c, L + lab_w + gw * gi + (gw - 10 * mm) / 2, yy, g, size=7.2, h=4 * mm, w=min(10 * mm, gw - 1 * mm))
    c.setFillColor(white); c.setFont("DVB", 6.8); c.drawString(AX, yy + 0.1 * mm, "AgB  ·  PonD")
    rh = 8.6 * mm
    for i, d in enumerate(days):
        yy -= rh
        if i % 2 == 0:
            c.setFillColor(RIGA); c.rect(L, yy - 3.4 * mm, R - L, rh, stroke=0, fill=1)
        c.setFillColor(NOTTE); c.setFont("DVB", 8.2)
        c.drawString(L + 1 * mm, yy + 0.4 * mm, GIORNI[i])
        c.setFont("DV", 7); c.setFillColor(GRIGIO)
        c.drawString(L + 1 * mm, yy - 2.4 * mm, "__/__" if vuoto else f"{d.day}/{d.month}")
        # chi e' di servizio (dai turni); se non ancora noti, righe da compilare a mano
        chi = agenti.get(d.isoformat(), {})
        for k, (sigla, dy) in enumerate((("AgB", 1.2), ("PonD", -2.3))):
            nomi = ", ".join(chi.get(sigla, []))
            c.setFillColor(TEAL_SCURO); c.setFont("DVB", 5.6); c.drawString(AX, yy + dy * mm, sigla)
            if nomi:
                size = 6.6
                while size > 4.6 and pdfmetrics.stringWidth(nomi, "DV", size) > ag_w - 10 * mm:
                    size -= 0.2
                c.setFillColor(INCHIOSTRO); c.setFont("DV", size); c.drawString(AX + 7.5 * mm, yy + dy * mm, nomi)
            else:
                c.setStrokeColor(BORDO); c.setLineWidth(0.5); c.line(AX + 7.5 * mm, yy + (dy - 0.4) * mm, R - 1 * mm, yy + (dy - 0.4) * mm)
        for gi, g in enumerate(gruppi):
            cx = L + lab_w + gw * (gi + 0.5)
            if vuoto:
                c.setStrokeColor(BORDO); c.setLineWidth(0.6)
                c.roundRect(cx - 6 * mm, yy - 2.2 * mm, 8.5 * mm, 5.4 * mm, 1.2 * mm, stroke=1, fill=0)
                # rifornimenti fissi dell'O.d.S.: D1 mar e ven, D2 lun e gio, BIS ogni giorno
                if i in RIF_FISSI.get(g, ()):
                    c.setFillColor(GIALLO); c.roundRect(cx + 3.2 * mm, yy - 1.2 * mm, 3.6 * mm, 3.8 * mm, 1 * mm, stroke=0, fill=1)
                    c.setFillColor(NOTTE); c.setFont("DVB", 7); c.drawCentredString(cx + 5 * mm, yy - 0.3 * mm, "R")
                continue
            if d.isoformat() not in ormeggi:
                if gi == 0:
                    c.setFont("DV", 5.8); c.setFillColor(GRIGIO)
                    c.drawString(L + lab_w + 1 * mm, yy - 0.6 * mm, "nel prossimo O.d.S.")
                continue
            v = ormeggi[d.isoformat()].get(g)
            c.setFillColor(INCHIOSTRO)
            if not v:
                c.setFont("DV", 9); c.drawCentredString(cx, yy - 0.6 * mm, "–")
                continue
            num = pontile(v)
            c.setFont("DVB", 11.5)
            nw = pdfmetrics.stringWidth(num, "DVB", 11.5)
            if v["rif"]:
                # il numero resta in colonna (centrato), la R accanto
                rw = 3.6 * mm
                x0 = cx - nw / 2
                c.drawString(x0, yy - 0.8 * mm, num)
                c.setFillColor(GIALLO); c.roundRect(x0 + nw + 0.8 * mm, yy - 1.2 * mm, rw, 3.8 * mm, 1 * mm, stroke=0, fill=1)
                c.setFillColor(NOTTE); c.setFont("DVB", 7); c.drawCentredString(x0 + nw + 0.8 * mm + rw / 2, yy - 0.3 * mm, "R")
            else:
                c.drawCentredString(cx, yy - 0.8 * mm, num)
    # note
    yy -= 8 * mm
    righe = [("R", GIALLO, "D1 mar e ven · D2 lun e gio (rabbocco mer avvisando)"),
             ("R", GIALLO, "motorista mezz'ora prima · BIS ogni giorno (pont. 5 o 3)"),
             ("B", ARANCIO, "Maderno e Riva: R1 c. 7 alle 13.30 · c. 8 alle 14.30"),
             ("B", ARANCIO, "Cantiere Peschiera: c. 30-31 alle 10.30 · c. 38-39 alle 16.20")]
    for lettera, fondo, testo in righe:
        c.setFillColor(fondo); c.roundRect(L, yy - 1.2 * mm, 3.8 * mm, 3.8 * mm, 1 * mm, stroke=0, fill=1)
        c.setFillColor(NOTTE); c.setFont("DVB", 6.8); c.drawCentredString(L + 1.9 * mm, yy - 0.2 * mm, lettera)
        c.setFillColor(INCHIOSTRO); c.setFont("DV", 7)
        assert L + 5.5 * mm + pdfmetrics.stringWidth(testo, "DV", 7) <= R, testo
        c.drawString(L + 5.5 * mm, yy - 0.2 * mm, testo)
        yy -= 5 * mm
    c.setFillColor(GRIGIO); c.setFont("DV", 6.4)
    c.drawString(L, yy - 0.4 * mm, "BIS: pronti alle 8.30 verso Garda, rientro alle 18.40.")
    assert yy - 0.4 * mm > y + 3.5 * mm, (yy - y) / mm


def tascabile(out, ormeggi, lunedi, agenti=None, vuoto=False):
    days = [lunedi + datetime.timedelta(days=i) for i in range(7)]
    if agenti is None and not vuoto:
        agenti = agenti_settimana(days)
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Desenzano - pontile - tascabile (4 cartoncini A6, fronte/retro)")
    angoli = [(0, H / 2), (W / 2, H / 2), (0, 0), (W / 2, 0)]
    for x, y in angoli:
        fronte(c, x, y)
    segni_taglio(c)
    c.showPage()
    for x, y in angoli:
        retro(c, x, y, ormeggi, days, agenti, vuoto)
    segni_taglio(c)
    c.showPage()
    c.save()


if __name__ == "__main__":
    # uso: a4_desenzano_colori.py colori.pdf tascabile.pdf ormeggi.json [AAAA-MM-GG oggi]
    oggi = sys.argv[4] if len(sys.argv) > 4 else datetime.date.today().isoformat()
    dati = json.load(open(sys.argv[3]))
    print("A4 a colori: ultima riga a", round(colori(sys.argv[1], dati, settimana(oggi)) / mm, 1), "mm dal basso")
    tascabile(sys.argv[2], dati, settimana(oggi))
