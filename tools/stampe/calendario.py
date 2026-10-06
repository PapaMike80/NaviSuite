"""Calendario ormeggi serali Desenzano (dagli allegati TURNO NAVI degli O.d.S.), A4 bianco/nero.
Uso: python3 calendario.py ormeggi.json out.pdf"""
import sys, re, json, calendar, datetime as dt
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.units import mm

import fonts  # noqa: F401  registra DejaVu Sans come "DV" / "DVB"
GREY = Color(0.30, 0.30, 0.30)
LIGHT = Color(0.92, 0.92, 0.92)
W, H = A4
GROUPS = ["D1", "D2", "D3", "D4", "BIS", "S.S."]
MESI = ["", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto",
        "Settembre", "Ottobre", "Novembre", "Dicembre"]
GIORNI = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"]


def fit(c, s, font, size, width):
    while s and pdfmetrics.stringWidth(s, font, size) > width:
        s = s[:-1]
    return s


def month_page(c, year, month, data, first, last, ods_list):
    L, R = 12 * mm, W - 12 * mm
    c.setFillColor(black); c.setFont("DVB", 22)
    c.drawString(L, H - 20 * mm, f"DESENZANO - ormeggi serali · {MESI[month]} {year}")
    c.setFont("DV", 8.5); c.setFillColor(GREY)
    c.drawString(L, H - 26.5 * mm, "Nave in servizio e pontile di ormeggio della sera, dagli allegati "
                                    "\"Turno navi\" degli O.d.S. " + ods_list + ".")
    c.drawString(L, H - 31 * mm, "Il numero a destra è il pontile.   R = rifornimento in giornata.   "
                                 "– = nessun pontile indicato.")
    weeks = calendar.Calendar(firstweekday=0).monthdatescalendar(year, month)
    top = H - 36 * mm
    cw = (R - L) / 7
    head_h = 6 * mm
    ch = (top - head_h - 12 * mm) / len(weeks)
    c.setFillColor(black)
    c.rect(L, top - head_h, R - L, head_h, stroke=0, fill=1)
    c.setFillColor(white); c.setFont("DVB", 9)
    for i, g in enumerate(GIORNI):
        c.drawCentredString(L + cw * (i + 0.5), top - head_h + 1.9 * mm, g)
    for wi, week in enumerate(weeks):
        for di, day in enumerate(week):
            x = L + di * cw
            y = top - head_h - (wi + 1) * ch
            if day.month != month:
                continue
            if di >= 5:
                c.setFillColor(LIGHT); c.rect(x, y, cw, ch, stroke=0, fill=1)
            c.setStrokeColor(black); c.setLineWidth(0.5); c.rect(x, y, cw, ch, stroke=1, fill=0)
            c.setFillColor(black); c.setFont("DVB", 12)
            c.drawString(x + 1.8 * mm, y + ch - 5.2 * mm, str(day.day))
            rows = data.get(day.isoformat())
            if not rows:
                if first <= day <= last:
                    c.setFont("DV", 6.2); c.setFillColor(GREY)
                    c.drawCentredString(x + cw / 2, y + ch / 2 - 1 * mm, "turno navi")
                    c.drawCentredString(x + cw / 2, y + ch / 2 - 4 * mm, "non disponibile")
                continue
            ly = y + ch - 9.6 * mm
            for g in GROUPS:
                v = rows.get(g)
                if not v or (g == "S.S." and not v["ormeggio"]):
                    continue
                num = v["ormeggio"].replace("pont.", "").replace("Pont.", "").strip() or "–"
                c.setFillColor(black); c.setFont("DVB", 6.6)
                c.drawString(x + 1.4 * mm, ly, g)
                c.setFont("DVB", 10)
                c.drawRightString(x + cw - 1.4 * mm, ly - 0.4 * mm, num)
                right = cw - 1.4 * mm - pdfmetrics.stringWidth(num, "DVB", 10) - 0.8 * mm
                if v["rif"]:
                    c.setFont("DVB", 5.6)
                    c.drawRightString(x + right, ly, "R")
                    right -= pdfmetrics.stringWidth("R", "DVB", 5.6) + 0.8 * mm
                name = re.sub(r"\s*(\([A-Z]\)|©)", "", v["nave"]).replace(" + ", "+").strip()
                avail = right - 7.4 * mm
                size = 6.4
                while size > 4.8 and pdfmetrics.stringWidth(name, "DV", size) > avail:
                    size -= 0.2
                c.setFont("DV", size)
                c.drawString(x + 7.4 * mm, ly, fit(c, name, "DV", size, avail))
                ly -= 4.3 * mm


def main(data, out):
    days = sorted(data)
    first, last = dt.date.fromisoformat(days[0]), dt.date.fromisoformat(days[-1])
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Desenzano - calendario ormeggi serali")
    m = dt.date(first.year, first.month, 1)
    while m <= last:
        ods = sorted({v["ods"] for k, x in data.items() if k[:7] == m.isoformat()[:7] for v in x.values()})
        ods_list = ", ".join(map(str, ods))
        month_page(c, m.year, m.month, data, first, last, ods_list)
        c.showPage()
        m = dt.date(m.year + (m.month == 12), m.month % 12 + 1, 1)
    c.save()


if __name__ == "__main__":
    main(json.load(open(sys.argv[1])), sys.argv[2])
