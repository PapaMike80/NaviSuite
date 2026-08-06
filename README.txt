NAVISUITE - VERSIONE FIREBASE

Avvio locale:
1. Aprire il terminale nella cartella del progetto.
2. Eseguire: node server.js
3. Aprire: http://127.0.0.1:8765/

Struttura:
- assets/images: loghi, icone e immagini PWA
- assets/css: tutti i fogli di stile
- assets/js: codice JavaScript dell'applicazione
- vendor: librerie di terze parti
- ods e turni: documenti PDF pubblicati
- backend: servizio separato per gli orari

Firebase Realtime Database è l'unica sorgente cloud dell'applicazione.
La cache del browser mantiene disponibili gli ultimi dati letti quando manca la rete.

Per le istruzioni destinate ai colleghi consultare GUIDA_UTENTE.txt.

File principali:
- index.html: accesso e portale
- naviturni.html: turni
- cambi_turno.html: ricerca e richieste di cambio
- navidiaria.html: diaria
- documenti.html: archivio documenti
- aggiornamenti.html e agenti.html: amministrazione Firebase
- impostazioni.html: preferenze

Configurazione Firebase:
- assets/js/admin-firebase-rest.js
- assets/js/firebase-data.js
- firebase-rules-aggiornamenti.json
