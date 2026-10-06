"""Rigenera tutte le stampe di NaviSuite dalla cartella ods/ (da lanciare a ogni nuovo O.d.S.).

    python3 tools/stampe/genera.py                  # settimana in corso (da venerdi': la prossima)
    python3 tools/stampe/genera.py --oggi 2026-10-09
    python3 tools/stampe/genera.py --out /tmp/prove

Scrive in stampe/:
  Desenzano_pontile_AgB_A4.pdf          navi in ordine di orario + ormeggi serali lun-dom con rifornimenti
  Maderno_servizio_terra_A4.pdf         navi di linea + traghetto Torri
  Maderno_passeggeri_A4.pdf             per il pubblico: navi di linea, partenze e ritorni con coincidenze
  Maderno_traghetto_Torri_A4.pdf        per il pubblico: traghetto Maderno - Torri, andata e ritorno
  Maderno_prossima_partenza_A4.pdf      per il pubblico: per ogni localita' le partenze da Maderno
  Maderno_tascabile_A4.pdf              tascabile: A4 orizzontale, scali al centro, partenze | ritorni
  Desenzano_calendario_ormeggi_serali.pdf  un mese per pagina, da tutti i "Turno navi" degli O.d.S.
  Cover_*.pdf                           cover iPhone 15 (orario invernale)
  ormeggi.json                          dati estratti dagli O.d.S.

Gli orari delle navi sono quelli dell'O.d.S. n. 39/2026 (inverno 2026/27) scritti negli script:
cambiano solo con un nuovo orario stagionale. Dagli O.d.S. settimanali arrivano invece navi,
ormeggi serali e rifornimenti (allegato "Turno navi").
"""
import argparse, datetime, json, os, sys

QUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, QUI)
RADICE = os.path.dirname(os.path.dirname(QUI))

import ormeggi, a4_desenzano, a4_maderno, a4_passeggeri_maderno, calendario, cover  # noqa: E402


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ods", default=os.path.join(RADICE, "ods"), help="cartella con gli O.d.S. in PDF")
    p.add_argument("--out", default=os.path.join(RADICE, "stampe"), help="cartella di destinazione")
    p.add_argument("--oggi", default=datetime.date.today().isoformat(), help="data di riferimento AAAA-MM-GG")
    a = p.parse_args()
    os.makedirs(a.out, exist_ok=True)

    dati = ormeggi.estrai(a.ods)
    with open(os.path.join(a.out, "ormeggi.json"), "w") as f:
        json.dump(dati, f, indent=1, ensure_ascii=False, sort_keys=True)
    giorni = sorted(dati)
    print(f"Turno navi: {len(giorni)} giorni, dal {giorni[0]} al {giorni[-1]}")

    lunedi = a4_desenzano.settimana(a.oggi)
    a4_desenzano.main(os.path.join(a.out, "Desenzano_pontile_AgB_A4.pdf"), dati, lunedi)
    coperti = sum((lunedi + datetime.timedelta(days=i)).isoformat() in dati for i in range(7))
    print(f"A4 Desenzano: ormeggi settimana dal {lunedi} ({coperti}/7 giorni negli O.d.S.)")
    a4_maderno.main(os.path.join(a.out, "Maderno_servizio_terra_A4.pdf"))
    a4_passeggeri_maderno.main(os.path.join(a.out, "Maderno_passeggeri_A4.pdf"))
    a4_passeggeri_maderno.main_traghetto(os.path.join(a.out, "Maderno_traghetto_Torri_A4.pdf"))
    a4_passeggeri_maderno.main_destinazioni(os.path.join(a.out, "Maderno_prossima_partenza_A4.pdf"))
    a4_passeggeri_maderno.main_tascabile(os.path.join(a.out, "Maderno_tascabile_A4.pdf"))
    calendario.main(dati, os.path.join(a.out, "Desenzano_calendario_ormeggi_serali.pdf"))
    if not cover.genera(a.out):
        sys.exit("Cover: qualche testo finisce sotto MagSafe o fotocamera")
    print("Stampe aggiornate in", a.out)


if __name__ == "__main__":
    main()
