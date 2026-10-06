"""Estrae dagli O.d.S. la tabella TURNO NAVI: per ogni giorno, nave e ormeggio serale dei gruppi di Desenzano.
Uso: python3 ormeggi.py <cartella ods> > ormeggi.json"""
import sys, re, json, glob, datetime, pdfplumber

GROUPS = ["D1", "D2", "D3", "D4", "BIS", "S.S."]
MONTHS = {"MAGGIO": 5, "GIUGNO": 6, "LUGLIO": 7, "AGOSTO": 8, "SETTEMBRE": 9, "OTTOBRE": 10}
ALL_GROUPS = {"D1", "D2", "D3", "D4", "BIS", "T1", "T2", "M1", "R1", "R2", "R3", "R4", "P1", "P2", "P3",
              "CAP", "SR1", "SR2", "S.S.", "CAR/SR2", "CAR", "SR", "SRI", "CAR1"}


def ods_num(path):
    return int(re.search(r"n\. (\d+)", path).group(1))


def parse(path):
    pdf = pdfplumber.open(path)
    for page in pdf.pages:
        text = page.extract_text() or ""
        m = re.search(r"TURNO NAVI DAL?L?'?\s*(\d+)\s*([A-Z]*)\s*AL?L?'?\s*(\d+)\s+([A-Z]+)\s+(\d{4})", text)
        if not m:
            continue
        d1, m1, d2, m2, year = m.groups()
        end_month, year = MONTHS[m2], int(year)
        start_month = MONTHS[m1] if m1 in MONTHS else end_month
        start = datetime.date(year, start_month, int(d1))
        ws = page.extract_words(keep_blank_chars=False, x_tolerance=1.5)
        corse = [w for w in ws if w["text"] == "Corse"][0]
        days = sorted([w for w in ws if abs(w["top"] - corse["top"]) < 4 and w["text"].isdigit()],
                      key=lambda w: w["x0"])
        cols = []
        for i, w in enumerate(days):
            cols.append(((w["x0"] + w["x1"]) / 2, start + datetime.timedelta(days=i)))
        assert int(days[0]["text"]) == start.day, (path, days[0]["text"], start)
        labels = [w for w in ws if w["x0"] < cols[0][0] - 40 and w["text"] in ALL_GROUPS and w["top"] > corse["top"]]
        labels.sort(key=lambda w: w["top"])
        bound = (cols[1][0] - cols[0][0]) / 2
        out = {}
        for li, lab in enumerate(labels):
            if lab["text"] not in GROUPS:
                continue
            nxt = labels[li + 1]["top"] if li + 1 < len(labels) else lab["top"] + 30

            def cells(top_lo, top_hi):
                res = {}
                for w in ws:
                    if top_lo <= w["top"] < top_hi and w["x0"] > lab["x1"] + 2:
                        xc = (w["x0"] + w["x1"]) / 2
                        cx, day = min(cols, key=lambda c: abs(c[0] - xc))
                        if abs(cx - xc) < bound * 1.3:
                            res.setdefault(day, []).append(w)
                return {d: " ".join(x["text"] for x in sorted(v, key=lambda w: w["x0"])) for d, v in res.items()}

            names = cells(lab["top"] - 3, lab["top"] + 5)
            moor = cells(lab["top"] + 5, min(nxt - 9, lab["top"] + 22))
            rif = cells(lab["top"] - 14, lab["top"] - 3)
            for day, name in names.items():
                name = name.replace("Rifornimento", "").strip()
                if not name:
                    continue
                mm = re.search(r"[Pp]ont\. ?\d+|[Pp]ont\. ?Gallegg\.?|porto \w+|pontile \w+", moor.get(day, ""))
                out[(day.isoformat(), lab["text"])] = {"nave": name, "ormeggio": mm.group(0) if mm else "",
                                                     "rif": "Rifornimento" in rif.get(day, "")}
        return start, out
    return None, {}


def estrai(folder):
    """{giorno ISO: {gruppo: {nave, ormeggio, rif, ods}}} dagli O.d.S. della cartella."""
    data = {}
    for path in sorted(glob.glob(folder + "/*.pdf"), key=ods_num):
        start, rows = parse(path)
        if start is None:
            continue
        for (day, group), v in rows.items():  # l'O.d.S. piu' recente vince sui giorni in comune
            data.setdefault(day, {})[group] = dict(v, ods=ods_num(path))
    return data


if __name__ == "__main__":
    json.dump(estrai(sys.argv[1]), sys.stdout, indent=1, ensure_ascii=False, sort_keys=True)
