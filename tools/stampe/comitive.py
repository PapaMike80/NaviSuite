"""Comitive dall'allegato «Comitive O.d.S.» di un O.d.S.
Uso: python3 comitive.py "../../ods/O.d.S. n. 41-2026.pdf" 41/2026 > ../../assets/js/comitive-ods.js"""
import json
import re
import sys

import pdfplumber

MESI = {m: i + 1 for i, m in enumerate("gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre".split())}
CITTA = ["Castelnuovo del Garda", "San Felice del Benaco", "Desenzano del Garda", "Costermano sul Garda", "Riva del Garda", "Gauting/München",
         "Fürstenfeldbruck", "Nagykanizsa", "Krzeszowice", "Hrubieszów", "Allersberg", "Gersthofen", "Blackrock", "Sandefjord", "Malcesine",
         "Bardolino", "Borgomaro", "Salzgitter", "Szczecin", "Bielsko", "Overath", "Kungälv", "Rapallo", "Belluno", "Ehingen", "Trento",
         "Varese", "Zurich", "Lazise", "Greve", "Linz", "Rosà", "Roma", "Asti", "Affi", "===", "---"]
RIGA = re.compile(r"^(.*?)\s+(I|NO|CH|D|DK|A|PL|HU|EI|S|-|==)\s+(\S+)\s+(voucher|diretto)\s+(\S+)$")


def estrai(pdf_path):
    testo = "\n".join(p.extract_text() or "" for p in pdfplumber.open(pdf_path).pages)
    testo = testo[testo.index("Comitive O.d.S."):testo.index("TURNO NAVI")]
    out, data = [], ""
    for riga in testo.splitlines():
        riga = riga.strip()
        g = re.match(r"^\w+[ì']?\s+(\d{1,2})\s+(\w+)\s+(\d{4})$", riga)
        if g and g.group(2) in MESI:
            data = f"{g.group(3)}-{MESI[g.group(2)]:02d}-{int(g.group(1)):02d}"
            continue
        m = RIGA.match(riga)
        if not m or not data:
            continue
        resto, naz, pax, pagamento, corse = m.groups()
        citta = next((c for c in CITTA if resto.endswith(" " + c)), "")
        resto = resto[: len(resto) - len(citta)].strip() if citta else resto
        if " + " in resto.split(" Ag.")[0]:
            percorso, cliente = re.match(r"^(.+?\+\s*\S+)\s+(.*)$", resto).groups()
        else:
            p = re.match(r"^(\S+?)(Ag\..*|\s+.*)$", resto)
            percorso, cliente = p.group(1), p.group(2).strip()
        out.append({"data": data, "percorso": percorso, "cliente": cliente, "citta": citta if citta not in ("===", "---") else "",
                    "naz": naz if naz not in ("-", "==") else "", "pax": pax, "pagamento": pagamento, "corse": corse})
    return out


if __name__ == "__main__":
    dati = estrai(sys.argv[1])
    print(f"""// Comitive dall'O.d.S. {sys.argv[2]}. Generato da tools/stampe/comitive.py: non modificare a mano.
(function (root) {{
  root.NaviComitiveOds = {{ ods: {json.dumps(sys.argv[2])}, comitive: {json.dumps(dati, ensure_ascii=False, indent=1)} }};
}})(typeof window !== 'undefined' ? window : globalThis);""")
