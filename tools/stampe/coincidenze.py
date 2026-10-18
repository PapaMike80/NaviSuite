"""Coincidenze ai fini tariffari dagli O.d.S. (sezione «COINCIDENZE AI FINI TARIFFARI»): sono le sole valide.
Dentro Alto lago e Basso lago non ci sono coincidenze; valgono solo i cambi elencati dall'O.d.S.

Scrive assets/js/coincidenze-ufficiali.js:
  {stagione: [{da, scalo, arriva, provenienti: [...], a, parte, per: [...], periodo, catena}]}
  da / a: numeri di corsa (anche "41/42"), arriva / parte "9.55", periodo "A" | "B" | "" (note dell'O.d.S.),
  catena: true se e' un "+ coincidenza a ..." dopo la prima (passeggeri gia' in coincidenza).

Uso: python3 coincidenze.py > ../../assets/js/coincidenze-ufficiali.js"""
import json
import re

import pdfplumber

FONTI = {
    "inverno": ("../../ods/O.d.S. n. 39-2026 INVERNO.pdf", "O.d.S. 39/2026"),
    "estate": ("../../ods/O.d.S. n. 16-2026 ESTATE.pdf", "O.d.S. 16/2026"),
}
ORA = r"(\d{1,2}[.:]\d{2})"


def testo_sezione(pdf_path):
    pdf = pdfplumber.open(pdf_path)
    tutto = "\n".join(p.extract_text() or "" for p in pdf.pages)
    inizio = tutto.index("COINCIDENZE AI FINI TARIFFARI DELL")
    fine = tutto.find("= PERCORSI CIRCOLARI", inizio)
    if fine < 0:
        fine = re.search(r"\n\d{4}/\d[°º].*?=", tutto[inizio + 50:]).start() + inizio + 50
    sezione = tutto[inizio:fine]
    sezione = re.sub(r"\n\d{1,2}\n", "\n", sezione)  # numeri di pagina
    return re.sub(r"\s*\n\s*", " ", sezione)


def scali(lista):
    lista = re.sub(r"\(.*?\)", "", lista)
    parti = re.split(r",\s*|\s+e\s+", lista)
    return [p.strip(" .;").replace("’", "'") for p in parti if p.strip(" .;")]


def bello(nome):
    nome = nome.strip().replace("‘", "'").replace("’", "'")
    return " ".join(w.capitalize() for w in nome.lower().split()).replace("Salo'", "Salò")


def ora(t):
    return t.replace(":", ".")


def estrai(testo):
    out = []
    # blocchi per corsa: "Corsa 22:" / "C. 161 SR:" / "Corsa 41/42:"
    blocchi = re.split(r"(?=(?:Corsa|C\.)\s+\d+(?:/\d+)?(?:\s+SR)?\s*:)", testo)
    for blocco in blocchi:
        m = re.match(r"(?:Corsa|C\.)\s+(\d+(?:/\d+)?)(?:\s+SR)?\s*:\s*(.*)", blocco)
        if not m:
            continue
        da, corpo = m.group(1), m.group(2)
        corpo = re.split(r"CORSE GRUPPO", corpo)[0]
        # clausole "a SCALO (ore ..) coincide ..." separate da ';'
        for clausola in re.split(r";\s*", corpo):
            c = re.search(r"(?:\((A|B)\)\s*)?a\s+([A-ZÀ-Ü'’‘ .]+?)\s*\(ore\s*" + ORA + r"\)\s*coincide,?\s*per i viaggiatori provenienti\s*da\s*(.+?),?\s*con\s+corsa", clausola)
            if not c:
                continue
            periodo, scalo, arriva, provenienti = c.group(1) or "", bello(c.group(2)), ora(c.group(3)), scali(c.group(4))
            resto = clausola[c.end() - len("con corsa"):]
            # catena: prima parte (destinazioni dirette) poi "+ coincidenza a X con corsa ..."
            pezzi = re.split(r"\+\s*coincidenza\s+", resto)
            precedente = [da]
            for k, pezzo in enumerate(pezzi):
                if k == 0:
                    luogo, base = scalo, pezzo
                else:
                    lm = re.match(r"a\s+([A-Za-zÀ-ü'’ ]+?)\s+(con\s+corsa.*)", pezzo)
                    if not lm:
                        continue
                    luogo, base = bello(lm.group(1)), lm.group(2)
                arrivo = arriva if k == 0 else ""
                nuovi = []
                for t in re.finditer(r"con\s+corsa\s+(\d+(?:/\d+)?)(?:\s*SR)?\s*\((?:ore\s*)?" + ORA + r"\)\s*per\s+(.+?)(?=\s+(?:e\s+)?con\s+corsa|\s*\(coincidenza|\s*\+|$)", base):
                    for d in precedente:
                        out.append({"da": d, "scalo": luogo, "arriva": arrivo, "provenienti": provenienti, "a": t.group(1),
                                    "parte": ora(t.group(2)), "per": scali(t.group(3)), "periodo": periodo, "catena": k > 0})
                    nuovi.append(t.group(1))
                # le "+ coincidenza" partono dalle corse della prima coincidenza (es. 51 -> 111 a Malcesine,
                # poi dalla 111 a Salo' con la 7 e a Sirmione con la 34 e la 91)
                if k == 0 and nuovi:
                    precedente = nuovi
    return out


if __name__ == "__main__":
    dati, fonti = {}, {}
    for stagione, (pdf, ods) in FONTI.items():
        dati[stagione] = estrai(testo_sezione(pdf))
        fonti[stagione] = ods
    print(f"""// Coincidenze ai fini tariffari dagli O.d.S. ({', '.join(fonti.values())}): le sole valide.
// Dentro Alto lago e Basso lago non ci sono coincidenze. Generato da tools/stampe/coincidenze.py: non modificare a mano.
(function (root) {{
  root.NaviCoincidenzeUfficiali = {json.dumps(dati, ensure_ascii=False)};
}})(typeof window !== 'undefined' ? window : globalThis);""")
