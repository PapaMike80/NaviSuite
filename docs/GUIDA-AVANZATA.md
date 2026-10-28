# 📘 Guida Avanzata a NaviSuite

Questa guida approfondisce tutte le funzioni avanzate di **NaviSuite**: dal calcolo dettagliato della Distinta e il controllo automatico della busta paga, fino agli avvisi a telefono bloccato, il calendario sincronizzato, il widget per iPhone e la mappa in tempo reale degli scali.

> 💡 *Sei alle prime armi? Inizia prima dalla [**🚀 Guida Rapida (2 minuti)**](GUIDA-RAPIDA.md).*

---

## Indice

1. [La Nuova Pagina Turni (`NaviTurni`): Tabellone, Bolle ed Equipaggi](#1-la-nuova-pagina-turni-naviturni-tabellone-bolle-ed-equipaggi)
2. [Distinta (`NaviDiaria`): Funzioni Avanzate e Calcolo Ore](#2-distinta-navidiaria-funzioni-avanzate-e-calcolo-ore)
3. [Verifica Busta Paga e Statistiche Annuali](#3-verifica-busta-paga-e-statistiche-annuali)
4. [Notifiche Push a Telefono Bloccato](#4-notifiche-push-a-telefono-bloccato)
5. [Scali in Tempo Reale, Mappa del Lago e Stampe A4](#5-scali-in-tempo-reale-mappa-del-lago-e-stampe-a4)
6. [Sincronizzazione automatica col Calendario (iPhone e Android)](#6-sincronizzazione-automatica-col-calendario-iphone-e-android)
7. [Widget per iPhone (Schermata Home e Blocco Schermo)](#7-widget-per-iphone-schermata-home-e-blocco-schermo)
8. [Personalizzazione del Menu e Pagina Iniziale](#8-personalizzazione-del-menu-e-pagina-iniziale)
9. [Controllo Cassa, Comitive e Documenti O.d.S.](#9-controllo-cassa-comitive-e-documenti-ods)
10. [Backup, Allineamento Archivi e Uso Offline](#10-backup-allineamento-archivi-e-uso-offline)

---

## 1. La Nuova Pagina Turni (`NaviTurni`): Tabellone, Bolle ed Equipaggi

La pagina **Turni** è stata completamente rinnovata con la nuova interfaccia grafica fluida, ottimizzata per l'uso immediato sul campo:

<p align="center">
  <img src="../assets/images/naviturni-reale.png" alt="Nuova grafica NaviTurni reale" width="320">
</p>

### Struttura e funzioni della nuova interfaccia:

1. **Testata operativa del turno**:
   * In alto trovi la pastiglia del turno corrente (es. `POND` in bordeaux per i pontili, `T1` in blu per traghetti, `M1` in arancione, `D1`...).
   * Sotto compaiono giorno, orario preciso di presentazione e termine, con la durata complessiva: `mer 28 ott · 9.30 – 19.50 (8 h 55')`.
   * La pastiglia con il pallino e il tuo nome (`● PEDRONI M.`) conferma il profilo attualmente collegato.
2. **Pulsanti rapidi delle residenze (`D`, `M`, `R`, `P`)**:
   * Posizionati nell'angolo in alto a sinistra della tabella per cambiare istantaneamente la visuale tra:
     * **`D`** → Desenzano del Garda
     * **`M`** → Maderno
     * **`R`** → Riva del Garda
     * **`P`** → Peschiera del Garda
3. **Riga personale fissata in alto**:
   * La riga con il tuo nome (`PEDRONI M.`) è scritta in verde acqua ed è fissata in alto: mentre scorri l'elenco dei colleghi verso il basso, la tua riga rimane fissa come riferimento per confrontare i turni.
4. **Colonna «OGGI» evidenziata con cornice tratteggiata**:
   * Il giorno corrente (`OGGI 28`) è racchiuso da una colonna verticale tratteggiata in verde acqua su tutta la lunghezza della tabella, consentendo di individuare all'istante chi è in servizio, chi è a terra e chi è a riposo oggi.
5. **Pallini del grado contrattuale**:
   * Un indicatore circolare colorato precede il cognome di ciascun collega:
     * 🟡 **Giallo**: Capitani e Comandanti (`Cap`, `CT`)
     * 🟣 **Viola**: Motoristi e Aiuto Motoristi (`Mot`, `AM`)
     * 🟢 **Verde**: Timonieri, Marinai e Applicati (`Tim`, `Mar`, `App`)
6. **Gettoni dei turni e puntini di variazione**:
   * **Servizi di bordo e di terra**: gettoni circolari colorati (`T1`, `T2`, `M1`, `POND`, `LAV`, `L.D.`).
   * **Assenze e congedi**: `F.P.` (Festività Soppressa / Ferie Programmate), `CON` (Congedo), `—` (Riposo).
   * **Puntini indicatori**: piccoli pallini colorati posizionati ai bordi del gettone (es. arancione, viola, azzurro) segnalano variazioni da O.d.S., trasferte o rifornimenti.
7. **Esplorazione interattiva con un tocco**:
   * Toccando qualsiasi cella della tabella (anche di colleghi o di giorni futuri), la testata in alto si sincronizza all'istante mostrando gli orari di quel servizio e l'equipaggio collegato.

---

## 10. Distinta (`NaviDiaria`): Funzioni Avanzate e Calcolo Ore

La sezione **Distinta** non è un semplice foglio di appunti: applica automaticamente le regole del CCNL e degli accordi aziendali per calcolare ore, straordinari e indennità del periodo di competenza.

### Come funziona il calcolo
* **Periodo di competenza e settimane a 39 ore**: la distinta mensile considera le settimane del periodo di competenza (indicate sotto il mese, es. *28/09/2026 – 25/10/2026*), gestendo in automatico anche le settimane a cavallo tra due mesi.
* **Ricalcolo istantaneo**: quando tocchi una giornata e modifichi una voce (*Ritardo*, *Cambio*, *Sentine*, *Banca ore*, *Rifornimento*), NaviSuite aggiorna in tempo reale sia le **Ore lavorate** del giorno sia gli **Straordinari** settimanali e mensili.

<p align="center">
  <img src="guida-distinta/guida-distinta-passi.png" alt="Passi per modificare la Distinta" width="100%">
</p>

### Ritardo condiviso con l'equipaggio
Se un collega che naviga **sulla tua stessa corsa/nave** registra un ritardo nella propria distinta, quando apri NaviSuite ti comparirà un avviso automatico:

<p align="center">
  <img src="../tools/mockup-ritardo-collega.png" alt="Avviso ritardo collega dell'equipaggio" width="320">
</p>

* Premendo **Registra**, quel ritardo viene inserito con un solo tocco anche nella tua giornata (potrai comunque modificarlo in qualsiasi momento).
* Premendo **Annulla**, l'avviso viene ignorato.

### Stampa / PDF della Distinta
In alto a destra sopra la tabella mensile puoi premere **Stampa / PDF** per generare il foglio riepilogativo mensile pronto da stampare o salvare sul telefono.

---

## 10. Verifica Busta Paga e Statistiche Annuali

Dalla **Distinta** (pulsante **Verifica busta**) oppure dal menu **`☰` → Verifica busta (`✔`)** puoi controllare in pochi secondi se il cedolino paga corrisponde a quanto hai segnato nella tua distinta.

> [!NOTE]
> **Privacy garantita**: il file PDF della busta paga viene letto direttamente dal tuo telefono; il documento PDF non viene caricato online ma restano salvati solo i valori numerici estratti per il tuo riepilogo.

### Confronto Mese per Mese e Mail per l'Ufficio Personale
1. Premi **`+ Carica`** e seleziona il PDF della busta paga ricevuto dall'azienda.
2. NaviSuite abbina automaticamente le competenze della busta (che si riferiscono al mese precedente) con la tua **Distinta di quel periodo**:
   * **In verde (`ok`)**: le voci che coincidono (entro la percentuale di tolleranza scelta, es. 10%).
   * **In rosso (`diff.`)**: le voci in cui c'è una differenza tra la tua distinta e la busta paga (es. ore di straordinario mancanti, maneggio denaro, diarie).
   * **In giallo (`verifica`)**: le voci particolari da controllare (es. differenza paga, ticket).
3. Se ci sono differenze, in fondo alla pagina NaviSuite **scrive già per te il testo completo della segnalazione** con l'elenco dettagliato dei giorni e dei turni! Ti basta premere **Apri mail** o **Copia** per inviarlo all'Ufficio Personale:

<p align="center">
  <img src="../tools/mockup-verifica-busta-mail.png" alt="Verifica busta paga e mail pronta per l'Ufficio Personale" width="340">
</p>

### Vista Annuale (`Anno`)
Passando alla scheda **Anno**, hai un quadro completo di tutti i cedolini caricati nell'anno:
* Grafico dell'andamento del netto mese per mese (con indicazione della quota derivante dagli straordinari).
* Totali annui di **Lordo**, **Ritenute**, **Netto**, **13ª**, **14ª**, **TFR** e dettaglio voce per voce.

<p align="center">
  <img src="../tools/mockup-verifica-busta-anno.png" alt="Riepilogo annuale buste paga" width="340">
</p>

---

## 10. Notifiche Push a Telefono Bloccato

NaviSuite può inviarti avvisi automatici sul telefono anche quando l'app è chiusa.
Per attivarli vai in **`☰` → Impostazioni (`⚙`) → Notifiche**:

<p align="center">
  <img src="../tools/mockup-notifiche.png" alt="Configurazione Notifiche in Impostazioni" width="680">
</p>

1. Accendi l'interruttore **Su questo telefono** (e consenti le notifiche quando il telefono lo chiede).
2. Scegli quali avvisi ricevere:
   * **📅 Riepilogo della giornata**: ricevi un promemoria con il tuo servizio, la nave, l'equipaggio, l'ormeggio serale e il rifornimento. Puoi scegliere se riceverlo **la sera prima** (all'orario che preferisci, es. `22:05`), **la mattina stessa** oppure **da 30 minuti a 2 ore prima dell'inizio del servizio**.
   * **⛴ Navi (10 minuti prima)**:
     * **Se sei di servizio a terra** (`AgB`, `PonD`, `AgM`, `AgT`…): 10 minuti prima dell'arrivo ti avvisa con **nome nave, pontile, provenienza, numero corsa e comandante**.
     * **Se sei imbarcato a bordo** (`D1`, `P2`, `M1`, `T1`, `BIS`…): 10 minuti prima ti avvisa con **il prossimo scalo, l'orario, la corsa, il pontile a Desenzano e lo scalo successivo**.
     * *Gli avvisi tengono conto in tempo reale dei ritardi, delle corse sospese dall'Ufficio Movimento e dei BIS!*
   * **⇄ Cambi turno**: ti avvisa subito quando un collega ti manda una richiesta di cambio turno e quando l'ufficio la approva.
   * **📋 ODS e variazioni**: ti avvisa appena viene pubblicato un nuovo O.d.S. o una variazione dell'Ufficio Movimento che modifica un tuo turno futuro (es. `📋 ODS 40/26 · dom 11/10 — M1→RIP`).

---

## 10. Scali in Tempo Reale, Mappa del Lago e Stampe A4

Aprendo **`☰` → Scali (`⚓`)** hai sotto controllo l'intera rete del Lago di Garda:

* **Situazione allo scalo**: scegli uno scalo (es. *Desenzano*, *Maderno*, *Sirmione*, *Riva*…) per vedere le prossime navi in arrivo e in partenza, il pontile assegnato, l'equipaggio a bordo e gli eventuali minuti di ritardo.
* **Mappa del Lago in tempo reale**: visualizza la posizione stimata delle navi lungo le rotte del lago e lo stato dei pontili.
* **Partenze dallo scalo e Stampa A4**: nel riquadro delle partenze vedi tutte le corse della giornata con le destinazioni dirette e le note (servizio rapido `SR`, limitazioni biciclette, accessibilità). Premendo **Stampa orario A4** ottieni il foglio ufficiale impaginato in 3 lingue (italiano, tedesco, inglese) pronto da appendere in biglietteria o al pontile:

<p align="center">
  <img src="../tools/mockup-partenze-scalo.png" alt="Partenze dallo scalo e foglio A4 da stampare" width="680">
</p>

---

## 10. Sincronizzazione automatica col Calendario (iPhone e Android)

Vuoi vedere i tuoi turni direttamente nell'app **Calendario** dell'iPhone o in **Google Calendar** insieme ai tuoi impegni personali?

1. Apri **`☰` → Impostazioni (`⚙`) → Calendario personale**.
2. Premi **Attiva sincronizzazione**: NaviSuite genera un tuo collegamento personale sicuro (il tuo PIN non è mai contenuto nel link).
3. Premi **Aggiungi su iPhone** oppure **Aggiungi su Google** (oppure **Scarica `.ics`** per un'esportazione singola).

**Cosa troverai in ogni giornata sul calendario del telefono:**
* Nome del turno e orario di inizio/fine;
* Nave assegnata;
* Pontile di ormeggio serale ed eventuale rifornimento;
* Elenco completo dei colleghi d'equipaggio con le rispettive qualifiche.

Quando un tuo turno cambia per un O.d.S. o un cambio turno approvato, il calendario si aggiorna da solo!

---

## 10. Widget per iPhone (Schermata Home e Blocco Schermo)

Su iPhone puoi aggiungere un **widget gratuito** che mostra a colpo d'occhio la **prossima nave in arrivo al tuo scalo** (se sei a terra) oppure il **prossimo scalo** (se stai navigando), senza nemmeno sbloccare il telefono o aprire l'app.

1. Installa dall'App Store l'app gratuita **Scriptable**.
2. Apri questo collegamento dal telefono e copia tutto il testo:
   `https://raw.githubusercontent.com/PapaMike80/NaviSuite/main/tools/widget-iphone/NaviSuite-widget.js`
3. Apri **Scriptable** → tocca **`+`** in alto a destra → incolla il testo → rinomina in alto lo script in **`NaviSuite`** → premi **Fine**.
4. **Per metterlo sulla schermata Home**:
   * Tieni premuto uno spazio vuoto sulla Home → **Modifica** → **Aggiungi widget** → cerca **Scriptable** → scegli la dimensione e premi **Aggiungi widget**.
   * Tieni premuto sul widget appena creato → **Modifica widget**:
     * **Script**: scegli `NaviSuite`
     * **Parameter**: scrivi il tuo **cognome** (es. `Pedroni` o `Pedroni M.` in caso di omonimia, oppure il tuo numero di matricola/agente).
5. **Per metterlo anche sulla schermata di blocco**:
   * Tieni premuto sulla schermata bloccata → **Personalizza** → **Schermata di blocco** → tocca l'area dei widget sotto l'orologio → scegli **Scriptable** → toccalo e imposta Script = `NaviSuite` e Parameter = il tuo cognome.

---

## 10. Personalizzazione del Menu e Pagina Iniziale

### Riordinare le icone del menu `☰`
Puoi decidere tu quali pagine tenere in grande in alto e in quale ordine:

<p align="center">
  <img src="guida-menu/guida-menu.gif" alt="Animazione riordino menu" width="320">
</p>

1. Apri il menu **`☰`** in alto a destra.
2. **Tieni premuta un'icona** per mezzo secondo finché si solleva.
3. **Trascinala** tra le pagine principali in alto o tra le *Altre pagine* in basso e rilascia il dito.
4. Se in futuro vuoi tornare alla disposizione standard, ti basta premere **Ripristina il menu** in basso nel menu.

### Scegliere la Prima Pagina di apertura
Quando apri NaviSuite dal telefono, l'app ti porta subito nella tua pagina preferita (senza passare ogni volta dalla schermata di scelta).

Per cambiarla:
1. Tocca il menu **`☰`** in alto a destra → **Impostazioni (`⚙`)**.
2. Tocca il riquadro azzurro **Prima pagina di apertura** (quando è chiuso mostra a destra la pagina attualmente attiva).
3. Tocca una delle pastiglie disponibili:
   * **Automatica** *(predefinita)*: apre **Il mio turno**, anche nei giorni di servizio a terra.
   * **Turni**: apre il calendario turni generale della residenza.
   * **Distinta**: apre subito *NaviDiaria* (giornate e competenze).
   * **Il mio turno**: nave, colleghi e scali di oggi.
   * **Oggi**: il quadro completo di navi ed equipaggi della giornata.
   * **Scali**: navi sul lago e allo scalo, pontili e ritardi.
   * **Documenti**: gli O.d.S. e i turni in PDF.
   * **Cambio**: le richieste di cambio turno.
   * **Home**: la panoramica con tutte le tessere dell'app.
4. La modifica viene **salvata automaticamente sul tuo profilo** (compare la scritta *"Salvato automaticamente sul tuo profilo"* in fondo alla pagina).

> 💡 **Nota per gli Amministratori**: all'interno dello stesso riquadro *Prima pagina di apertura* è presente anche il comando **Prima pagina per tutti gli agenti** (*Reset per tutti*), che permette di impostare una pagina iniziale predefinita per tutti i profili (lasciando poi a ciascun collega la libertà di ricambiarla).

---

## 10. Controllo Cassa, Comitive e Documenti O.d.S.

* **¤ Cassa (`controllo_cassa.html`)**: inserisci il numero di banconote e monete per ciascun taglio per ottenere all'istante il totale contato, la differenza rispetto al fondo cassa previsto e il riepilogo del versamento.
* **⛴ Comitive (`comitive.html`)**: consulta l'elenco dei gruppi turistici e delle comitive previste sulle corse del giorno (estratti dagli O.d.S. e dagli avvisi operativi), con indicazione di corsa, scalo di imbarco, scalo di sbarco e numero di passeggeri.
* **▤ Documenti (`documenti.html`)**: consulta in qualsiasi momento i PDF ufficiali pubblicati dall'azienda, divisi tra **Turni** e **O.d.S.** (Ordini di Servizio). I documenti non ancora definitivi sono chiaramente contrassegnati dall'etichetta **Bozza**.

---

## 10. Backup, Allineamento Archivi e Uso Offline

### Come funziona quando non c'è campo sul lago
NaviSuite salva sul telefono una copia degli ultimi turni e delle tue modifiche alla distinta:
* Se sei in mezzo al lago o in un punto senza rete, puoi comunque aprire i turni e compilare la distinta.
* Non appena il telefono ritrova la connessione, i dati vengono sincronizzati con l'archivio cloud.

> [!CAUTION]
> **Non cancellare i dati di navigazione / la cache del browser** mentre sei senza rete o se hai modifiche non ancora sincronizzate, altrimenti potresti perdere le ultime note salvate solo sul dispositivo.

### Allineamento Archivi
Se hai usato NaviSuite su due dispositivi diversi (es. telefono e PC di casa) o durante un passaggio tra archivi cloud e ci sono differenze su alcune giornate della distinta, NaviSuite ti mostra una schermata chiara di confronto:

<p align="center">
  <img src="../tools/mockup-allinea-archivi.png" alt="Confronto e allineamento archivi" width="320">
</p>

Ti viene già preselezionata la versione modificata più di recente, ma puoi scegliere giornata per giornata quale mantenere e premere **Salva le scelte su entrambi**.

### Backup Personale (`Backup`)
Da **`☰` → Backup (`⤓`)** (oppure dal pulsante **Backup** nella Distinta) puoi scaricare in qualsiasi momento sul tuo telefono un file con tutte le tue distinte e impostazioni, o ricaricarlo in caso di cambio telefono.

---

## 🆘 Hai bisogno di aiuto?

Se qualcosa non funziona come previsto:
1. Premi il pulsante **Aggiorna** nella pagina o chiudi e riapri l'app.
2. Verifica di aver selezionato il tuo **nominativo corretto** e di non aver confuso il PIN.
3. Quando segnali un problema a un amministratore, indica **il tuo cognome**, **la pagina che stavi usando** e allega una **schermata dell'errore** *(attenzione: non inviare mai schermate in cui sia visibile il tuo PIN!)*.
