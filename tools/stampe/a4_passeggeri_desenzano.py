"""Dati di Desenzano per i fogli dei passeggeri (vedi passeggeri.py): navi di linea e coincidenze.
Orario invernale 2026/27, O.d.S. n. 39/2026 (orari pag. 15-16, coincidenze "ai fini tariffari": si usano
quelle che l'O.d.S. indica per i viaggiatori in partenza da Desenzano o diretti a Desenzano)."""
import sys
import passeggeri
from passeggeri import cambio

NOME, NOME_TITOLO = "DESENZANO", "Desenzano"

# ---- partenze da Desenzano: (partenza, nota, corsa, [(localita', arrivo[, cambio])]) ----
PARTENZE = [
    # la 20 fa il giro Sirmione - Garda - Bardolino - Lazise; a Garda coincide con la 2 per l'alto lago
    ("8.50", "", "20", [("Sirmione", "9.10"), ("Garda", "9.55"), ("Bardolino", "10.15"), ("Lazise", "10.32"),
                        ("Brenzone", "12.29", cambio("Garda", "9.55", "10.10", "2")),
                        ("Malcesine", "12.54", cambio("Garda", "9.55", "10.10", "2")),
                        ("Limone", "13.14", cambio("Garda", "9.55", "10.10", "2")),
                        ("Riva", "13.50", cambio("Garda", "9.55", "10.10", "2"))]),
    ("9.15", "", "14", [("Sirmione", "9.35")]),
    ("10.05", "", "16", [("Sirmione", "10.25"), ("Lazise", "11.04"), ("Bardolino", "11.21"), ("Garda", "11.36"),
                         ("Portese", "12.19"), ("Salò", "12.31"), ("Gardone", "12.44"), ("Maderno", "13.00")]),
    ("10.40", "", "32", [("Sirmione", "11.00")]),
    ("11.25", "", "34", [("Sirmione", "11.45"), ("Lazise", "12.23"), ("Bardolino", "12.40"), ("Garda", "12.55")]),
    ("13.15", "", "92", [("Sirmione", "13.37"), ("Lazise", "14.19"), ("Bardolino", "14.35"), ("Garda", "14.54"),
                         ("Portese", "15.42"), ("Salò", "15.55"), ("Gardone", "16.10")]),
    ("14.30", "", "8", [("Sirmione", "14.51"), ("Garda", "15.37"), ("Portese", "16.20"), ("Salò", "16.32"),
                        ("Gardone", "16.45"), ("Maderno", "16.58"), ("Gargnano", "17.28"), ("Brenzone", "17.56"),
                        ("Malcesine", "18.20"), ("Limone", "18.40"), ("Torbole", "19.10"), ("Riva", "19.25")]),
    # a Sirmione coincide con la 114 SR (solo fino all'11/10) per l'alto lago
    ("15.35", "", "36", [("Sirmione", "15.55"),
                         ("Malcesine", "18.05", cambio("Sirmione", "15.55", "16.03", "114")),
                         ("Limone", "18.18", cambio("Sirmione", "15.55", "16.03", "114")),
                         ("Torbole", "18.38", cambio("Sirmione", "15.55", "16.03", "114")),
                         ("Riva", "18.55", cambio("Sirmione", "15.55", "16.03", "114"))]),
    ("16.20", "", "38", [("Sirmione", "16.40"), ("Bardolino", "17.20"), ("Garda", "17.35")]),
    ("17.05", "", "18", [("Sirmione", "17.25"), ("Lazise", "18.03"), ("Bardolino", "18.20"), ("Garda", "18.35")]),
]
# ---- ritorno a Desenzano: (arrivo a Desenzano, nota, corsa, [(localita', partenza[, cambio])]) ----
RITORNI = [
    ("9.55", "", "15", [("Sirmione", "9.35")]),
    ("10.30", "", "31", [("Lazise", "8.53"), ("Bardolino", "9.10"), ("Garda", "9.25"), ("Sirmione", "10.10")]),
    ("11.20", "", "33", [("Sirmione", "11.00")]),
    ("12.15", "", "91", [("Maderno", "9.15"), ("Gardone", "9.30"), ("Salò", "9.45"), ("Portese", "9.55"),
                         ("Garda", "10.40"), ("Bardolino", "10.55"), ("Lazise", "11.12"), ("Sirmione", "11.53"),
                         ("Riva", "8.40", cambio("Sirmione", "11.30", "11.53", "91")),
                         ("Torbole", "8.55", cambio("Sirmione", "11.30", "11.53", "91")),
                         ("Limone", "9.15", cambio("Sirmione", "11.30", "11.53", "91")),
                         ("Malcesine", "9.28", cambio("Sirmione", "11.30", "11.53", "91"))]),
    ("13.30", "", "7", [("Riva", "8.45"), ("Limone", "9.20"), ("Malcesine", "9.40"), ("Brenzone", "10.04"),
                        ("Gargnano", "10.32"), ("Maderno", "11.03"), ("Gardone", "11.16"), ("Salò", "11.29"),
                        ("Portese", "11.40"), ("Garda", "12.23"), ("Sirmione", "13.09")]),
    ("15.25", "", "35", [("Garda", "13.55"), ("Bardolino", "14.10"), ("Lazise", "14.27"), ("Sirmione", "15.05")]),
    ("16.15", "", "37", [("Sirmione", "15.55")]),
    ("16.55", "", "17", [("Maderno", "14.00"), ("Gardone", "14.14"), ("Salò", "14.28"), ("Portese", "14.40"),
                         ("Garda", "15.23"), ("Bardolino", "15.38"), ("Lazise", "15.55"), ("Sirmione", "16.35")]),
    ("19.00", "", "27", [("Lazise", "17.23"), ("Bardolino", "17.40"), ("Garda", "17.55"), ("Sirmione", "18.40"),
                         ("Riva", "15.20", cambio("Sirmione", "17.51", "18.40", "27")),
                         ("Limone", "15.41", cambio("Sirmione", "17.51", "18.40", "27")),
                         ("Malcesine", "15.55", cambio("Sirmione", "17.51", "18.40", "27"))]),
    ("19.40", "", "19", [("Garda", "18.35"), ("Sirmione", "19.20"),
                         ("Riva", "14.50", cambio("Garda", "18.30", "18.35", "19")),
                         ("Limone", "15.25", cambio("Garda", "18.30", "18.35", "19")),
                         ("Malcesine", "15.46", cambio("Garda", "18.30", "18.35", "19")),
                         ("Brenzone", "16.10", cambio("Garda", "18.30", "18.35", "19"))]),
]
# Ritorni con cambio: corsa su cui si sale nello scalo di partenza
PRIMA_CORSA = {("Riva", "8.40"): "111", ("Torbole", "8.55"): "111", ("Limone", "9.15"): "111",
               ("Malcesine", "9.28"): "111", ("Riva", "15.20"): "107", ("Limone", "15.41"): "107",
               ("Malcesine", "15.55"): "107", ("Riva", "14.50"): "3", ("Limone", "15.25"): "3",
               ("Malcesine", "15.46"): "3", ("Brenzone", "16.10"): "3"}

# localita' nell'ordine dell'orario: basso lago (Sirmione - Garda) e alto lago (Portese - Riva)
BASSO = ["Sirmione", "Lazise", "Bardolino", "Garda"]
ALTO = ["Portese", "Salò", "Gardone", "Maderno", "Gargnano", "Brenzone", "Malcesine", "Limone", "Torbole", "Riva"]
BLOCCHI_PARTENZE = [("▶  SIRMIONE  ·  GARDA", "basso lago  ·  lower lake  ·  unterer See", BASSO),
                    ("▶  SALÒ  ·  MADERNO  ·  RIVA", "alto lago  ·  upper lake  ·  oberer See", ALTO)]
BLOCCHI_RITORNI = [("◀  DA SIRMIONE  ·  GARDA", "basso lago  ·  lower lake  ·  unterer See", list(reversed(BASSO))),
                   ("◀  DA RIVA  ·  MADERNO  ·  SALÒ", "alto lago  ·  upper lake  ·  oberer See", list(reversed(ALTO)))]
# la 20, la 31 e la 27 fanno il giro di Garda, Bardolino e Lazise: orari non crescenti lungo le colonne
ORDINATI = False
RIGA_MM = 9.5   # righe piu' basse: da Desenzano partono 10 navi
PER_RIGA = 7    # Garda ha 7 partenze: tutte su una riga
ORDINE = ["Desenzano", "Peschiera", "Sirmione", "Lazise", "Bardolino", "Garda", "Torri del Benaco", "Portese",
          "Salò", "Gardone", "Maderno", "Gargnano", "Brenzone", "Malcesine", "Limone", "Torbole", "Riva"]
TRAGHETTO = None

S = sys.modules[__name__]


def main(out):
    return passeggeri.main(S, out)


if __name__ == "__main__":
    # uso: a4_passeggeri_desenzano.py navi.pdf
    print("misura orari / localita':", main(sys.argv[1]))
