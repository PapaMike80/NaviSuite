"""Dati di Maderno per i fogli dei passeggeri (vedi passeggeri.py): navi di linea, coincidenze e
traghetto per Torri del Benaco. Orario invernale 2026/27, O.d.S. n. 39/2026 (orari pag. 15-17,
coincidenze "ai fini tariffari")."""
import sys
import passeggeri
from passeggeri import cambio

NOME, NOME_TITOLO = "MADERNO", "Maderno"

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
# localita' nell'ordine in cui le tocca la nave
NORD = ["Gargnano", "Brenzone", "Malcesine", "Limone", "Torbole", "Riva"]
SUD = ["Gardone", "Salò", "Portese", "Garda", "Bardolino", "Lazise", "Sirmione", "Peschiera", "Desenzano"]
# ordine degli scali dell'orario ufficiale (Desenzano - Riva)
ORDINE_ORARIO = ["Desenzano", "Peschiera", "Sirmione", "Lazise", "Bardolino", "Garda", "Torri del Benaco", "Portese",
                 "Salò", "Gardone", "Gargnano", "Brenzone", "Malcesine", "Limone", "Torbole", "Riva"]
SUD_RITORNO = ["Desenzano", "Peschiera", "Sirmione", "Lazise", "Bardolino", "Garda", "Portese", "Salò", "Gardone"]
# Traghetto Torri del Benaco - Maderno (30'): (partenza, corsa) - pag. 17
TRAGHETTO_ANDATA = [("8.10", "201"), ("8.45", "231"), ("9.25", "203"), ("10.10", "233"), ("10.50", "205"),
                    ("11.30", "235"), ("12.10", "207"), ("12.50", "237"), ("14.20", "209"), ("15.05", "239"),
                    ("15.50", "211"), ("16.40", "241"), ("17.20", "213"), ("18.00", "243")]
TRAGHETTO_RITORNO = [("8.45", "202"), ("9.25", "232"), ("10.10", "204"), ("10.50", "234"), ("11.30", "206"),
                     ("12.10", "236"), ("12.50", "208"), ("14.20", "238"), ("15.05", "210"), ("15.50", "240"),
                     ("16.40", "212"), ("17.20", "242"), ("18.00", "214"), ("18.40", "244")]
# Ritorni con cambio: corsa su cui si sale nello scalo di partenza (coincidenze O.d.S. 39/2026)
PRIMA_CORSA = {("Desenzano", "8.50"): "20", ("Sirmione", "9.10"): "20", ("Lazise", "8.53"): "30",
               ("Bardolino", "9.10"): "30", ("Peschiera", "14.30"): "24", ("Lazise", "14.58"): "24",
               ("Bardolino", "15.15"): "24", ("Desenzano", "15.35"): "36", ("Torbole", "8.25"): "51",
               ("Torbole", "15.00"): "64", ("Torbole", "14.40"): "57"}

PARTENZE = PARTENZE_NORD + PARTENZE_SUD
RITORNI = RITORNI_NORD + RITORNI_SUD
BLOCCHI_PARTENZE = [("▲  RIVA DEL GARDA", "nord  ·  north  ·  Norden", NORD),
                    ("▼  DESENZANO  ·  PESCHIERA", "sud  ·  south  ·  Süden", SUD)]
BLOCCHI_RITORNI = [("▼  DA RIVA DEL GARDA", "da nord  ·  from north  ·  aus Norden", list(reversed(NORD))),
                   ("▲  DA DESENZANO  ·  PESCHIERA", "da sud  ·  from south  ·  aus Süden", SUD_RITORNO)]
ORDINATI = True
ORDINE = ORDINE_ORARIO
TRAGHETTO = dict(nome="Torri del Benaco", etichetta="TORRI", sotto="del Benaco · traghetto",
                 andata=TRAGHETTO_ANDATA, ritorno=TRAGHETTO_RITORNO)

S = sys.modules[__name__]


def main(out):
    return passeggeri.main(S, out)


def main_traghetto(out):
    passeggeri.main_traghetto(S, out)


if __name__ == "__main__":
    # uso: a4_passeggeri_maderno.py navi.pdf traghetto.pdf
    print("misura orari / localita':", main(sys.argv[1]))
    main_traghetto(sys.argv[2])
