# Stampe da O.d.S.

Genera i PDF da stampare (laser bianco/nero) e le cover per iPhone 15:

| File in `stampe/` | Contenuto |
|---|---|
| `Desenzano_pontile_AgB_A4.pdf` | AgB e PonD, navi in ordine di orario, ormeggi serali lun–dom con rifornimenti (R), nei colori di NaviSuite (`a4_desenzano_colori.py`) |
| `Desenzano_pontile_tascabile_A4.pdf` | tascabile del pontilista: 2 pagine da stampare fronte/retro (lato lungo) e tagliare in 4 cartoncini A6; davanti le navi in ordine di orario, davanti le corse durante le pause pranzo di AgB e PonD colorate; dietro AgB/PonD, ormeggi serali della settimana con R, chi è di servizio AgB e PonD (dai turni pubblicati, altrimenti righe da compilare) e note su rifornimenti e bolgette |
| `Maderno_servizio_terra_A4.pdf` | AgM e AgT, navi di linea e traghetto Torri in ordine di orario |
| `Maderno_passeggeri_A4.pdf` | per la biglietteria (2 pagine): navi di linea, partenze da Maderno e ritorno a Maderno, con le coincidenze, in italiano, inglese e tedesco |
| `Maderno_traghetto_Torri_A4.pdf` | per la biglietteria: traghetto Maderno ⇄ Torri del Benaco, andata e ritorno |
| `Maderno_prossima_partenza_A4.pdf` | per la biglietteria: "Prossima partenza per … / Next boat to … / Nächstes Schiff nach …", una riga per località, da Desenzano a Riva come nell'orario ufficiale |
| `Maderno_tascabile_A4.pdf` | tascabile: A4 orizzontale, scali al centro, a sinistra le partenze da Maderno e a destra i ritorni a Maderno |
| `Desenzano_passeggeri_A4.pdf`, `Desenzano_prossima_partenza_A4.pdf`, `Desenzano_tascabile_A4.pdf` | gli stessi fogli per i passeggeri di Desenzano |
| `Cover_*.pdf` | cover iPhone 15 (M1, T1, T2, Maderno, Desenzano) |
| `ormeggi.json` | navi, pontili e rifornimenti estratti dagli O.d.S. |

## Dall'app: tasto "Genera Servizi a terra"

In *Aggiornamenti → Nuovo ODS* il tasto **Genera Servizi a terra** apre l'A4 di Desenzano
(`assets/js/servizi-terra-a4.js`, stessa impaginazione di `a4_desenzano.py`) con gli ormeggi
della settimana scelta, presi dai turni nave salvati e da quelli dell'ODS appena letto.
Da lì "Stampa / PDF".

## Ogni venerdì, con il nuovo O.d.S.

Basta caricare il PDF in `ods/` sul branch `main` (anche da "Add files via upload").
La GitHub Action **Stampe da O.d.S.** rigenera tutto, fa il commit in `stampe/` e ripubblica il sito.
Si può lanciare anche a mano dalla scheda *Actions*.

Il nome del file deve contenere il numero, come gli altri: `O.d.S. n. 40-2026.pdf`.
Se due O.d.S. coprono lo stesso giorno vale quello con il numero più alto.

## A mano

**Da GitHub** (dopo il merge su `main`): scheda *Actions* → **Stampe da O.d.S.** →
*Run workflow* → *Run workflow*. Dopo un paio di minuti i PDF aggiornati sono in `stampe/`.

**Dal PC Windows**: serve [Python](https://www.python.org/downloads/) (all'installazione
spunta "Add python.exe to PATH") e una copia del repository (GitHub Desktop o *Code → Download ZIP*).
Poi doppio clic su `tools/stampe/Genera stampe.bat`: la prima volta installa le librerie,
poi crea i PDF nella cartella `stampe/`.

**Da terminale** (Windows, Mac o Linux):

```
pip install -r tools/stampe/requirements.txt
python3 tools/stampe/genera.py                    # settimana in corso; da venerdì la successiva
python3 tools/stampe/genera.py --oggi 2026-10-09  # come se fosse quel giorno
```

I font DejaVu Sans sono inclusi in `tools/stampe/fonts/`: non serve installarli.

Il calendario mensile degli ormeggi serali di Desenzano non fa parte delle stampe; se serve si crea a mano:
`python3 tools/stampe/calendario.py stampe/ormeggi.json calendario.pdf`.

## Cosa arriva dagli O.d.S. e cosa no

- **Dagli O.d.S. settimanali** (allegato "TURNO NAVI"): nave, pontile di ormeggio serale e
  rifornimenti dei gruppi D1–D4 e BIS (più S.S. quando ormeggia a un pontile).
- **Scritti negli script** (orario invernale, O.d.S. n. 39/2026): orari delle navi, servizi a
  terra (AgB, PonD, AgM, AgT) e regole dei rifornimenti. Vanno aggiornati con il nuovo orario
  stagionale (`a4_desenzano.py`, `a4_maderno.py`, `cover.py`, e per i passeggeri
  `a4_passeggeri_maderno.py` / `a4_passeggeri_desenzano.py`; l'impaginazione è in `passeggeri.py`).
- **Orario di ogni corsa per la pagina "Il mio turno"** (scali e orari): `assets/js/orario-corse.js`,
  generato dalle pagine dell'orario dell'O.d.S. stagionale. Con un nuovo orario si rigenera indicando
  le pagine Desenzano–Riva e Riva–Desenzano (il traghetto Torri si ricava dagli orari di Maderno):
  `python3 tools/stampe/orario_corse.py "ods/O.d.S. n. 39-2026 INVERNO.pdf" 15 16 > assets/js/orario-corse.js`.
  I numeri delle corse di ogni turno sono in `assets/js/course-info.js`.
- **Mappa del lago della pagina "Orario"**: `assets/js/orario-lago.js` (costa, pontili, boe e rotte in
  acqua fra gli scali), generata da `cd tools/stampe && python3 mappa_lago.py > ../../assets/js/orario-lago.js`
  (circa un minuto e mezzo). Va rigenerata solo se si aggiunge uno scalo.
