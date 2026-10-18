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
# Con --tutti anche gli scali minori dell'orario estivo (pagina Orari)
MINORI = [("PADENGHE", "Padenghe"), ("MONIGA", "Moniga"), ("MANERBA", "Manerba"), ("CISANO", "Cisano"),
          ("SAN FELICE", "San Felice"), ("BOGLIACO", "Bogliaco"), ("TIGNALE", "Tignale"), ("ASSENZA", "Assenza"),
          ("CASSONE", "Cassone"), ("CASTELLETTO", "Castelletto"), ("CAMPIONE", "Campione"), ("PUNTA SAN VIGILIO", "Punta San Vigilio"), ("PUNTA S. VIGILIO", "Punta San Vigilio")]
TUTTI = "--tutti" in sys.argv


def stazione(testo):
    nome = testo.upper().replace("’", "").replace("'", "")
    elenco = STAZIONI + (MINORI if TUTTI else [])
    return next((bello for chiave, bello in sorted(elenco, key=lambda c: -len(c[0])) if nome.startswith(chiave)), None)


def estrai(pdf_path, pagine):
    pdf = pdfplumber.open(pdf_path)
    corse = {}
    for numero in pagine:
        parole = pdf.pages[numero - 1].extract_words(keep_blank_chars=False, x_tolerance=1.5)
        righe = {}
        for parola in parole:
            righe.setdefault(round(parola["top"] / 3), []).append(parola)
        colonne, attesa = None, False
        for chiave, riga in sorted(righe.items()):
            riga.sort(key=lambda p: p["x0"])
            testo = " ".join(p["text"] for p in riga)
            numeri = [(int(p["text"]), (p["x0"] + p["x1"]) / 2) for p in riga if re.fullmatch(r"\d{1,3}", p["text"])]
            if testo.startswith("N.") and "Corsa" in testo:
                colonne = numeri or None
                attesa = not numeri  # numeri delle corse nella riga sotto (orario estivo)
                continue
            if colonne is None and attesa and len(numeri) >= 5:
                colonne, attesa = numeri, False
                continue
            nome = stazione(riga[0]["text"]) if riga else None
            orari = riga[1:] if nome else riga
            if not nome and TUTTI:
                # orari stampati un filo sopra o sotto il nome dello scalo: si prende lo scalo della riga vicina
                vicine = [k for k in righe if abs(k - chiave) <= 2 and k != chiave and righe[k] and stazione(min(righe[k], key=lambda p: p["x0"])["text"])]
                if vicine:
                    k = min(vicine, key=lambda k: abs(k - chiave))
                    nome = stazione(min(righe[k], key=lambda p: p["x0"])["text"])
            if not colonne or not nome:
                continue
            for parola in orari:
                if not re.fullmatch(r"\d{1,2}\.\d{2}", parola["text"]):
                    continue
                centro = (parola["x0"] + parola["x1"]) / 2
                corsa, x = min(colonne, key=lambda c: abs(c[1] - centro))
                assert abs(x - centro) < 14, (numero, nome, parola["text"], corsa)
                corse.setdefault(str(corsa), []).append([nome, parola["text"]])
    minuti = lambda t: tuple(map(int, t.split(".")))
    for numero_corsa, scali in corse.items():
        scali.sort(key=lambda s: minuti(s[1]))
        # stesso scalo due volte di fila (es. Limone centro e multipiano): resta il primo
        corse[numero_corsa] = [s for i, s in enumerate(scali) if i == 0 or s[0] != scali[i - 1][0]]
    return dict(sorted(corse.items(), key=lambda kv: int(kv[0])))


if __name__ == "__main__":
    argomenti = [a for a in sys.argv[1:] if a != "--tutti"]
    origine, pagine = argomenti[0], [int(p) for p in argomenti[1:]]
    corse = estrai(origine, pagine)
    nome = origine.replace("\\", "/").split("/")[-1]
    print(f"""// Orario di ogni corsa: {{numero: [[scalo, ora], ...]}} in ordine di orario.
// Generato da tools/stampe/orario_corse.py da "{nome}" (pagine {', '.join(map(str, pagine))}): non modificare a mano.
(function (root) {{
  root.NaviOrarioCorse = {json.dumps(corse, ensure_ascii=False)};
}})(typeof window !== 'undefined' ? window : globalThis);""")
