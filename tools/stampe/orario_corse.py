"""Orario di ogni corsa (scali e orari) dalle pagine dell'orario di un O.d.S., per la pagina
"Il mio turno" dell'app: scrive assets/js/orario-corse.js.

Le tabelle dell'orario hanno una colonna per corsa: ogni orario viene assegnato alla colonna del
numero di corsa piu' vicina (per posizione orizzontale). Il traghetto Maderno - Torri non e' nelle
tabelle: lo aggiunge la pagina dagli orari di Maderno (traversata di 30').

Uso: python3 orario_corse.py "../../ods/O.d.S. n. 39-2026 INVERNO.pdf" 15 16 > ../../assets/js/orario-corse.js
     (pagine dell'orario Desenzano - Riva e Riva - Desenzano, numerate da 1)"""
import json
import re
import sys

import pdfplumber

STAZIONI = [("DESENZANO", "Desenzano"), ("PESCHIERA", "Peschiera"), ("SIRMIONE", "Sirmione"), ("LAZISE", "Lazise"),
            ("BARDOLINO", "Bardolino"), ("GARDONE", "Gardone"), ("GARDA", "Garda"), ("TORRI", "Torri"),
            ("PORTESE", "Portese"), ("SALO", "Salò"), ("MADERNO", "Maderno"), ("GARGNANO", "Gargnano"),
            ("BRENZONE", "Brenzone"), ("MALCESINE", "Malcesine"), ("LIMONE", "Limone"), ("TORBOLE", "Torbole"),
            ("RIVA", "Riva")]


def stazione(testo):
    nome = testo.upper().replace("’", "").replace("'", "")
    return next((bello for chiave, bello in STAZIONI if nome.startswith(chiave)), None)


def estrai(pdf_path, pagine):
    pdf = pdfplumber.open(pdf_path)
    corse = {}
    for numero in pagine:
        parole = pdf.pages[numero - 1].extract_words(keep_blank_chars=False, x_tolerance=1.5)
        righe = {}
        for parola in parole:
            righe.setdefault(round(parola["top"] / 3), []).append(parola)
        colonne = None
        for _, riga in sorted(righe.items()):
            riga.sort(key=lambda p: p["x0"])
            testo = " ".join(p["text"] for p in riga)
            if testo.startswith("N.") and "Corsa" in testo:
                colonne = [(int(p["text"]), (p["x0"] + p["x1"]) / 2) for p in riga if re.fullmatch(r"\d{1,3}", p["text"])]
                continue
            nome = stazione(riga[0]["text"]) if riga else None
            if not colonne or not nome:
                continue
            for parola in riga[1:]:
                if not re.fullmatch(r"\d{1,2}\.\d{2}", parola["text"]):
                    continue
                centro = (parola["x0"] + parola["x1"]) / 2
                corsa, x = min(colonne, key=lambda c: abs(c[1] - centro))
                assert abs(x - centro) < 14, (numero, nome, parola["text"], corsa)
                corse.setdefault(str(corsa), []).append([nome, parola["text"]])
    minuti = lambda t: tuple(map(int, t.split(".")))
    for scali in corse.values():
        scali.sort(key=lambda s: minuti(s[1]))
    return dict(sorted(corse.items(), key=lambda kv: int(kv[0])))


if __name__ == "__main__":
    origine, pagine = sys.argv[1], [int(p) for p in sys.argv[2:]]
    corse = estrai(origine, pagine)
    nome = origine.replace("\\", "/").split("/")[-1]
    print(f"""// Orario di ogni corsa: {{numero: [[scalo, ora], ...]}} in ordine di orario.
// Generato da tools/stampe/orario_corse.py da "{nome}" (pagine {', '.join(map(str, pagine))}): non modificare a mano.
(function (root) {{
  root.NaviOrarioCorse = {json.dumps(corse, ensure_ascii=False)};
}})(typeof window !== 'undefined' ? window : globalThis);""")
