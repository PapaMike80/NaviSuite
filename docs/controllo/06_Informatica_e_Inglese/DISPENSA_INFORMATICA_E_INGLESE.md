# Dispensa di Studio: Informatica (Office, Internet, PEC) e Lingua Inglese
**Concorso Operatore di Ufficio (par. 130) - Gestione Governativa Navigazione Laghi**

---

## PARTE 1: INFORMATICA E STRUMENTI D'UFFICIO

### 1. Pacchetto Microsoft Office

#### 1.1 Microsoft Excel (Fogli Elettronici - Cruciale per l'Ufficio Controllo)
* **Struttura**: Cartella di lavoro composta da fogli; ogni foglio è una griglia di righe (numeri) e colonne (lettere); l'incrocio forma la **cella** (es. `B4`).
* **Riferimenti di Cella**:
  * **Relativi** (`A1`): se la formula viene copiata o trascinata, il riferimento si sposta proporzionalmente.
  * **Assoluti** (`$A$1`): bloccati sia per riga sia per colonna col simbolo `$`. Utile per moltiplicare per un parametro fisso (es. aliquota IVA o tariffa fissa).
  * **Misti** (`$A1` o `A$1`): bloccata solo la colonna o solo la riga.
* **Formule e Funzioni Principali**:
  * `=SOMMA(intervallo)`: somma i valori delle celle.
  * `=MEDIA(intervallo)`: calcola la media aritmetica.
  * `=CONTA.NUMERI(intervallo)` / `=CONTA.VALORI(intervallo)`: contano le celle numeriche o non vuote.
  * `=CONTA.SE(intervallo; criterio)` / `=SOMMA.SE(intervallo; criterio; intervallo_somma)`: eseguono conteggi o somme condizionate.
  * `=SE(test; se_vero; se_falso)`: logica condizionale (es. `=SE(C2>0; "Incassato"; "Non incassato")`).
  * `=CERCA.VERT(valore_cercato; tabella; indice_colonna; [falso])`: cerca un valore nella prima colonna di una matrice e restituisce il corrispondente valore nella colonna indicata (fondamentale per collegare matrici biglietti, scali o codici tariffa).
* **Tabelle Pivot**: Strumento avanzato per riassumere, aggregare, raggruppare e analizzare grandi masse di dati contabili e di bigliettazione senza modificare i dati di origine.
* **Ordinamento e Filtri**: Consente di filtrare rapidamente per data, scalo, cassa, operatore o tipologia di titolo di viaggio.

#### 1.2 Microsoft Word (Elaboratore di Testi)
* **Formattazione**: Carattere, paragrafo (interlinea, rientri, allineamento), margini di pagina, intestazione e piè di pagina, numerazione pagine.
* **Stili**: Applicazione di titoli gerarchici (Titolo 1, Titolo 2) essenziali per generare automaticamente il sommario (indice del documento).
* **Stampa Unione (Mail Merge)**: Funzione che consente di creare documenti personalizzati (es. lettere, attestati, convocazioni) combinando un documento modello con un database o foglio Excel di destinatari.
* **Revisioni e Commenti**: Strumenti per la tracciatura delle modifiche e l'inserimento di note nel lavoro collaborativo tra uffici.

#### 1.3 Microsoft PowerPoint (Presentazioni)
* **Elementi**: Diapositive (slide), layout predefiniti, caselle di testo, forme, immagini e tabelle.
* **Schema Diapositiva (Slide Master)**: Modello generale che controlla lo sfondo, i font e il posizionamento degli elementi grafici su tutte le slide.
* **Animazioni vs Transizioni**: Le *transizioni* riguardano l'effetto di passaggio da una slide alla successiva; le *animazioni* riguardano l'effetto di comparsa/scomparsa dei singoli oggetti all'interno della stessa slide.

---

### 2. Reti, Internet e Posta Elettronica

* **Browser e Navigazione Web**: Software di navigazione (Edge, Chrome, Firefox). Differenza tra protocollo non sicuro (`http://`) e sicuro con crittografia SSL/TLS (`https://`).
* **Posta Elettronica Ordinaria (Email)**:
  * Campi indirizzo:
    * **A (To)**: Destinatari principali dell'azione.
    * **CC (Copia Conoscenza)**: Destinatari informati per conoscenza; i loro indirizzi sono visibili a tutti.
    * **CCN (Copia Conoscenza Nascosta / BCC)**: Destinatari i cui indirizzi rimangono oscurati a tutti gli altri destinatari (obbligatorio per comunicazioni massive a tutela della privacy GDPR).
  * Protocolli di posta: **SMTP** (invio), **POP3** (scarica la posta sul dispositivo eliminandola/lasciandola sul server), **IMAP** (sincronizza cartelle e messaggi costantemente con il server).

---

### 3. Posta Elettronica Certificata (PEC)

* **Definizione e Valore Legale**: La PEC è un sistema di trasporto di documenti informatici che fornisce al mittente prova opponibile a terzi della spedizione e della consegna del messaggio, con valore legale equivalente alla raccomandata con ricevuta di ritorno (A/R) (D.P.R. 68/2005 e CAD).
* **Funzionamento e Ricevute**:
  1. Il mittente invia il messaggio al proprio Gestore PEC.
  2. Il gestore del mittente rilascia la **Ricevuta di Accettazione** (che attesta la presa in carico del messaggio con data e ora).
  3. Il gestore del mittente inoltra la busta di trasporto al gestore del destinatario.
  4. Il gestore del destinatario consegna il messaggio nella casella e rilascia al mittente la **Ricevuta di Avvenuta Consegna** (che attesta l'avvenuta consegna nella casella PEC del destinatario).
* **Tipi di Ricevuta di Avvenuta Consegna**:
  * **Completa** (default): contiene i dati di consegna e la copia integrale del messaggio e degli allegati.
  * **Breve**: contiene i dati di consegna e l'impronta (hash) del messaggio e dei singoli allegati.
  * **Sintetica**: contiene solo i dati generali di consegna (mittente, destinatario, oggetto, orario), senza impronte dei file.
* **Regola aurea**: La notifica a mezzo PEC si intende perfezionata per il mittente con la ricevuta di accettazione, e per il destinatario nel momento in cui viene generata la **ricevuta di avvenuta consegna**.

---

## PARTE 2: LINGUA INGLESE PER IL SETTORE TRASPORTI E CUSTOMER SERVICE

### 1. Glossario Essenziale di Biglietteria e Navigazione

| Termine Italiano | Termine Inglese | Note d'uso |
|---|---|---|
| Biglietto di sola andata | **One-way ticket / Single ticket** | Tratta singola |
| Biglietto di andata e ritorno | **Round-trip ticket / Return ticket** | Stessa tratta andata e ritorno |
| Biglietto giornaliero / Libera circolazione | **Daily pass / Day ticket / Rover ticket** | Consente viaggi illimitati per la giornata |
| Biglietto ridotto / Intero | **Reduced ticket / Full price ticket** | Per bambini, over 65, residenti |
| Tariffa per residenti | **Residents' fare / Local discount** | Previa esibizione del documento |
| Supplemento rapido (aliscafo/catamarano) | **Fast service supplement / Hydrofoil surcharge** | Supplemento obbligatorio per corse veloci |
| Traghetto veicoli (auto/moto/camper) | **Car ferry / Vehicle ferry** | Servizio imbarco autoveicoli |
| Passeggeri a mobilità ridotta (PMR) | **Passengers with reduced mobility (PRM)** | Tutelati dal Regolamento UE 1177/2010 |
| Pontile / Imbarcadero / Scalo | **Pier / Dock / Landing stage / Ferry terminal** | Punto di attracco e imbarco |
| Banchina | **Quay / Wharf** | Spazio portuale di ormeggio |
| Biglietteria | **Ticket office / Booking office** | Sportello di emissione titoli |
| Tabellone orari | **Timetable / Schedule** | Quadro orari corse |
| Ritardo / Cancellazione corsa | **Delay / Cancellation** | Corsa posticipata o soppressa |
| Rimborso | **Refund** | Restituzione dell'importo speso |
| Reclamo | **Complaint** | Segnalazione formale disservizio |
| Mancata emissione / Evasione tariffaria | **Fare evasion / Traveling without a valid ticket** | Passeggero privo di titolo valido |

### 2. Frasi Tipiche di Comunicazione e Assistenza

* *Can I pay by credit card or cash?* -> "You can pay by cash, credit card or debit card at all ticket desks."
* *Is there any supplement for the fast boat?* -> "Yes, the fast catamaran service requires a supplement of..."
* *Where is the car ferry departing from?* -> "The vehicle ferry to Torri del Benaco departs from pier number 2."
* *Can I take my bicycle on board?* -> "Bicycles are allowed subject to available space and purchase of the bike ticket."
* *What happens if the ferry is cancelled due to adverse weather conditions?* -> "In case of bad weather, you are entitled to a full refund or re-routing on the next available service, according to EU Regulation 1177/2010."
* *Do you offer assistance for passengers in wheelchairs?* -> "Yes, free boarding assistance is provided. Please notify the staff at least 48 hours in advance or at least 60 minutes before departure at the pier."
