# ⚓ NaviSuite

**NaviSuite** è la piattaforma web progressiva (PWA) tutto-in-uno progettata per il personale navigante, i servizi di scalo e l'Ufficio Movimento della **Navigazione Lago di Garda**.

Riunisce in un'unica interfaccia rapida, utilizzabile da smartphone, tablet e PC (anche **offline**), la consultazione dei turni, il registro della distinta personale, la situazione in tempo reale degli scali e della flotta, i cambi turno, la verifica della busta paga e gli strumenti operativi per gli uffici.

> ### 📖 Guide per i Colleghi
> * 🚀 **[Guida Rapida (2 minuti)](docs/GUIDA-RAPIDA.md)** — Primo accesso col PIN, installazione sul telefono e le 5 funzioni di tutti i giorni, con immagini passo-passo.
> * 📘 **[Guida Avanzata illustrata](docs/GUIDA-AVANZATA.md)** — Distinta e ritardi d'equipaggio, Verifica busta paga, Notifiche a telefono bloccato (10 min prima di arrivi/scali), Calendario sincronizzato, Widget iPhone, Stampe A4 e Backup.

---

## ✨ Funzionalità Principali

### 👨‍✈️ Per il Personale Navigante e di Scalo

* **📋 Distinta (`NaviDiaria`)** — Compilazione e calcolo automatico della distinta giornaliera, settimanale e mensile:
  * Importazione automatica del turno del giorno.
  * Calcolo di ore ordinarie, straordinari, banca ore e competenze accessorie (su base 39 ore settimanali, inclusa la gestione delle settimane a cavallo di mese).
  * Strumenti di conversione/trasformazione ore, allineamento archivi e salvataggio in cloud con fallback locale offline.
* **⚑ Il mio turno** — Riepilogo immediato della propria giornata lavorativa: turno assegnato, nave, elenco delle corse con orari e scali, pontile di ormeggio serale, rifornimenti ed equipaggio completo a bordo con relative qualifiche.
* **▦ Turni (`NaviTurni`)** — Tabellone interattivo dei turni di tutti gli agenti suddiviso per residenza:
  * Evidenziazione automatica del proprio nominativo e codifica a colori per turni, riposi, assenze, variazioni O.d.S. e cambi turno.
  * Dettaglio istantaneo di ogni casella con composizione dell'equipaggio e note operative.
* **☀ Oggi** — Panoramica giornaliera completa di tutte le navi in servizio, dei relativi equipaggi di bordo e del personale assegnato ai servizi a terra.
* **⚓ Scali e Mappa Live (`Orario`)** — Monitoraggio in tempo reale del traffico sul lago:
  * Prossimi arrivi e partenze per ogni scalo, pontili di attracco, coincidenze e indicazione di eventuali ritardi o corse sospese/BIS.
  * Mappa vettoriale interattiva del Lago di Garda con coste, boe, pontili e rotte in acqua delle unità in servizio.
* **🕒 Orari Stagionali** — Consultazione rapida degli orari ufficiali delle corse e delle coincidenze in formato grafico e tabellare.
* **⇄ Cambio Turno** — Motore di ricerca automatica dei colleghi compatibili per richiedere uno scambio turno nel rispetto di qualifiche e riposi, con invio telematico della richiesta e stato di approvazione in tempo reale.
* **▤ Documenti e O.d.S.** — Archivio digitale sempre aggiornato di Ordini di Servizio (O.d.S.), turni periodici e bozze in formato PDF.
* **✔ Verifica Busta Paga** — Confronto automatico tra la distinta registrata in *NaviDiaria* e il PDF del cedolino paga, con lettura delle voci retributive, stima del netto e controllo delle competenze secondo il CCNL.
* **¤ Controllo Cassa** — Calcolatore rapido per il conteggio dei tagli di banconote e monete e la quadratura del fondo cassa di biglietterie e servizi di bordo.
* **⛴ Comitive e Collegamenti** — Consultazione delle comitive prenotate sulle corse (scali di salita/discesa, numero passeggeri) e degli orari di coincidenza con i trasporti pubblici terrestri (treni e bus).
* **🎮 Area Svago** — Include il quiz formativo aziendale/nautico e il minigioco *Battaglia sul Garda*.

---

### 🛠️ Per l'Ufficio Movimento e gli Amministratori

* **⚓ Gestione Movimento (`movimento.html`)** — Cruscotto operativo per l'assegnazione di navi ed equipaggi, gestione delle variazioni giornaliere, segnalazione in tempo reale di ritardi o soppressioni corse e approvazione delle richieste di cambio turno.
* **↻ Aggiornamenti e Importazione (`aggiornamenti.html`)** — Pannello di pubblicazione per:
  * Importare nuovi turni da PDF (anche scansiti, tramite OCR) o fogli di calcolo.
  * Estrarre automaticamente dagli O.d.S. settimanali le variazioni turno, i turni nave, gli ormeggi serali e i rifornimenti.
  * Inviare comunicazioni e avvisi mirati (generali, per singola pagina o personali).
  * Generare con un clic i fogli A4 pronti per la stampa dei servizi a terra.
* **♙ Anagrafica e Permessi Agenti (`agenti.html`)** — Gestione di nominativi, matricole, qualifiche (Comandante/Capitano, Capo Timoniere, Timoniere, Motorista, Aiuto Motorista, Marinaio, Applicato, Barista, Scalo), residenze, permessi di accesso granulari alle pagine e reset del PIN.

---

## 📱 Ecosistema Mobile, Notifiche e Stampe

Oltre all'applicazione web principale, NaviSuite include una serie di strumenti integrati:

1. **Installazione PWA e Modalità Offline**
   Installabile su iOS, Android e Desktop come applicazione nativa. Grazie al Service Worker e alla cache locale, permette di consultare gli ultimi turni scaricati e compilare la distinta anche in assenza di connessione dati.
2. **Notifiche Push Intelligenti (`tools/push-arrivi-worker/` & `ponteradio-worker/`)**
   * **A terra**: avviso a schermo bloccato **10 minuti prima dell'arrivo della nave** allo scalo (con unità, pontile, provenienza, numero corsa e comandante).
   * **A bordo**: avviso **10 minuti prima del prossimo scalo** (con orario, corsa, pontile a Desenzano e scalo successivo).
   * **O.d.S. e Cambi Turno**: notifiche istantanee quando viene pubblicata una variazione sul proprio turno o quando si riceve/viene approvato un cambio turno.
3. **Sincronizzazione Calendario Personale (`.ics` / iPhone / Google Calendar)**
   Dalle *Impostazioni* ogni agente può esportare un file `.ics` o attivare un feed live sicuro (protetto da token a 256 bit) che aggiorna automaticamente sul calendario del telefono i propri turni completi di servizio, nave, ormeggio serale, rifornimento ed equipaggio.
4. **Widget per iPhone (`tools/widget-iphone/`)**
   Script dedicato per l'app gratuita *Scriptable* (iOS) che mostra direttamente sulla schermata Home o sulla schermata di blocco la prossima nave in arrivo al proprio scalo o il prossimo approdo della propria nave.
5. **Generatore Automatico di Stampe da O.d.S. (`tools/stampe/`)**
   Pipeline in Python (eseguibile anche in automatico via GitHub Actions ad ogni caricamento di un nuovo PDF in `ods/`) che produce i materiali cartacei in `stampe/`:
   * **Riepiloghi A4 per i servizi a terra** di Desenzano (`AgB`, `PonD`) e Maderno (`AgM`, `AgT`) con barre orarie di servizio, ormeggi serali e rifornimenti (`R`).
   * **Tascabili A6 fronte/retro** per i pontilisti.
   * **Locandine orari per i passeggeri** (in italiano, inglese e tedesco) per biglietterie e pontili.
   * **Cover per smartphone** personalizzate con gli schemi orari dei turni.

---

## 🗂️ Struttura del Progetto

```text
NaviSuite/
├── index.html                  # Portale di accesso con PIN e schermata Home dinamica
├── navidiaria.html             # Distinta personale (ore, straordinari, competenze)
├── mio-turno.html              # Dettaglio giornaliero di turno, nave, corse ed equipaggio
├── naviturni.html              # Tabellone turni generale per residenza
├── oggi.html                   # Quadro giornaliero di navi ed equipaggi
├── orario.html                 # Situazione scali in tempo reale e mappa del lago
├── orari.html                  # Consultazione orari stagionali e coincidenze
├── cambi_turno.html            # Ricerca compatibilità e gestione richieste cambio turno
├── documenti.html              # Consultazione PDF di O.d.S., turni e bozze
├── verifica-busta.html         # Analisi PDF cedolino e confronto con la distinta
├── controllo_cassa.html        # Conteggio rapido cassa e tagli monetari
├── comitive.html               # Gestione gruppi e comitive a bordo
├── collegamenti.html           # Coincidenze con trasporti pubblici (treni/bus)
├── movimento.html              # Pannello operativo Ufficio Movimento
├── aggiornamenti.html          # Importazione turni/O.d.S. e gestione avvisi (Admin)
├── agenti.html                 # Anagrafica, ruoli, permessi e reset PIN (Admin)
├── backup-dati.html            # Esportazione, importazione e confronto (diff) backup
├── impostazioni.html           # Preferenze utente, notifiche push, calendario e PIN
├── assets/
│   ├── css/                    # Fogli di stile modulari (tema scuro/chiaro responsive)
│   ├── js/                     # Logica applicativa client-side, parser PDF e calcolo CCNL
│   └── images/                 # Loghi, icone PWA e risorse grafiche
├── ods/                        # Archivio PDF degli Ordini di Servizio pubblicati
├── stampe/                     # PDF pronti per la stampa generati dagli O.d.S.
├── backend/orari-api/          # Microservizio REST (Python/Docker) per sincronizzazione orari
├── pocketbase/                 # Schema, hook e documentazione per il backend PocketBase
├── firebase-pocketbase-sync/   # Servizio Node.js di sincronizzazione Firebase ↔ PocketBase
├── ponteradio-worker/          # Worker Docker per l'invio delle notifiche Web Push
├── tools/
│   ├── push-arrivi-worker/     # Worker TrueNAS per avvisi arrivi/scali, turno pronto e backup
│   ├── stampe/                 # Script Python per generare PDF A4, tascabili A6 e mappe
│   └── widget-iphone/          # Widget iOS (Scriptable) per arrivi e scali live
└── tests/                      # Suite di test automatizzati (calcoli distinta, parser, cambi)
```

---

## 🚀 Avvio Rapido in Locale

NaviSuite non richiede bundler complessi per lo sviluppo front-end e include un server Node.js integrato.

### Prerequisiti
* [Node.js](https://nodejs.org/) (v18 o superiore)
* *(Opzionale)* `tesseract-ocr` installato nel sistema per l'importazione OCR di O.d.S. scansionati (`sudo apt install tesseract-ocr` su Linux)
* *(Opzionale)* [Python 3](https://www.python.org/) per rigenerare le stampe PDF da O.d.S. (`pip install -r tools/stampe/requirements.txt`)

### Esecuzione
1. Clona il repository e posizionati nella cartella del progetto:
   ```bash
   git clone https://github.com/PapaMike80/NaviSuite.git
   cd NaviSuite
   ```
2. Avvia il server web locale:
   ```bash
   node server.js
   ```
3. Apri il browser all'indirizzo:
   ```text
   http://127.0.0.1:8765/
   ```

### Generazione delle stampe PDF da O.d.S.
Per rigenerare manualmente tutti i PDF nella cartella `stampe/` a partire dagli Ordini di Servizio presenti in `ods/`:
```bash
pip install -r tools/stampe/requirements.txt
python3 tools/stampe/genera.py
```
Su Windows è possibile avviare direttamente con un doppio clic lo script [`tools/stampe/Genera stampe.bat`](tools/stampe/Genera%20stampe.bat).

---

## 🔒 Sicurezza, Cloud e Backup

* **Accesso protetto da PIN**: al primo accesso (PIN iniziale temporaneo `1957`) ogni agente imposta il proprio PIN personale da 4 a 8 cifre, salvato in forma cifrata (hash).
* **Architettura ibrida Cloud + NAS**:
  * **Firebase Realtime Database** gestisce la sincronizzazione in tempo reale tra i dispositivi e pubblica il pacchetto compresso `turnoFuturo` (~25 KB) per garantire un'apertura istantanea anche in zone del lago con scarsa copertura cellulare.
  * **TrueNAS & PocketBase**: i worker su NAS eseguono ogni notte il backup completo di database, distinte (in formato `.json` e `.csv` per Excel) e codice sorgente, mantenendo uno storico di 60 giorni (vedi [`tools/RIPRISTINO.md`](tools/RIPRISTINO.md)).

---

## 📖 Documentazione Utile

* 🚀 [**Guida Rapida per i Colleghi (`docs/GUIDA-RAPIDA.md`)**](docs/GUIDA-RAPIDA.md) — Guida illustrata veloce per entrare in NaviSuite e usare le funzioni principali.
* 📘 [**Guida Avanzata per i Colleghi (`docs/GUIDA-AVANZATA.md`)**](docs/GUIDA-AVANZATA.md) — Manuale completo illustrato (Distinta, Verifica busta paga, Notifiche a schermo bloccato, Calendario `.ics`, Widget iPhone, Backup e allineamento).
* 📄 [**Guida Testuale Semplice (`GUIDA_UTENTE.txt`)**](GUIDA_UTENTE.txt) — Istruzioni in formato solo testo per il primo accesso.
* 🖨️ [**Guida Stampe da O.d.S. (`tools/stampe/README.md`)**](tools/stampe/README.md) — Dettagli sulla generazione dei PDF per scali, pontilisti e passeggeri.
* 🔔 [**Worker Notifiche e Backup (`tools/push-arrivi-worker/README.md`)**](tools/push-arrivi-worker/README.md) — Configurazione degli avvisi a schermo bloccato e del backup automatico su TrueNAS.
* 📅 [**Setup Calendario Personale (`tools/CALENDARIO_SETUP.md`)**](tools/CALENDARIO_SETUP.md) — Configurazione del feed `.ics` per iPhone e Google Calendar.
* 📱 [**Istruzioni Widget iPhone (`tools/widget-iphone/ISTRUZIONI.md`)**](tools/widget-iphone/ISTRUZIONI.md) — Come installare il widget degli arrivi/scali su iOS.
* 🛡️ [**Piano di Ripristino (`tools/RIPRISTINO.md`)**](tools/RIPRISTINO.md) — Procedure di emergenza e disaster recovery.
