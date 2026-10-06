# Stampe da O.d.S.

Genera i PDF da stampare (laser bianco/nero) e le cover per iPhone 15:

| File in `stampe/` | Contenuto |
|---|---|
| `Desenzano_pontile_AgB_A4.pdf` | AgB e PonD, navi in ordine di orario, ormeggi serali lun–dom con rifornimenti (R) |
| `Maderno_servizio_terra_A4.pdf` | AgM e AgT1, navi di linea e traghetto Torri in ordine di orario |
| `Desenzano_calendario_ormeggi_serali.pdf` | calendario mensile degli ormeggi serali da tutti i "Turno navi" |
| `Cover_*.pdf` | cover iPhone 15 (M1, T1, T2, Maderno, Desenzano) |
| `ormeggi.json` | navi, pontili e rifornimenti estratti dagli O.d.S. |

## Ogni venerdì, con il nuovo O.d.S.

Basta caricare il PDF in `ods/` sul branch `main` (anche da "Add files via upload").
La GitHub Action **Stampe da O.d.S.** rigenera tutto, fa il commit in `stampe/` e ripubblica il sito.
Si può lanciare anche a mano dalla scheda *Actions*.

Il nome del file deve contenere il numero, come gli altri: `O.d.S. n. 40-2026.pdf`.
Se due O.d.S. coprono lo stesso giorno vale quello con il numero più alto.

## A mano

```
pip install -r tools/stampe/requirements.txt
python3 tools/stampe/genera.py                    # settimana in corso; da venerdì la successiva
python3 tools/stampe/genera.py --oggi 2026-10-09  # come se fosse quel giorno
```

## Cosa arriva dagli O.d.S. e cosa no

- **Dagli O.d.S. settimanali** (allegato "TURNO NAVI"): nave, pontile di ormeggio serale e
  rifornimenti dei gruppi D1–D4 e BIS (più S.S. quando ormeggia a un pontile).
- **Scritti negli script** (orario invernale, O.d.S. n. 39/2026): orari delle navi, servizi a
  terra (AgB, PonD, AgM, AgT1) e regole dei rifornimenti. Vanno aggiornati con il nuovo orario
  stagionale (`a4_desenzano.py`, `a4_maderno.py`, `cover.py`).
