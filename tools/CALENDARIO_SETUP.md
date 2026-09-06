# NaviSuite · Calendario personale

Il front-end del calendario personale è già attivo in `Impostazioni` tramite `assets/js/calendar-settings-v2.js`.

## Cosa esporta

Ogni giornata lavorativa contiene:

- servizio;
- nave;
- ormeggio serale;
- rifornimento;
- equipaggio con qualifica.

Il file `.ics` funziona subito e non richiede backend.

## Attivare la sincronizzazione automatica iPhone / Google

La sincronizzazione richiede un feed HTTPS pubblico. NaviSuite usa Google Apps Script come endpoint leggero.

1. Crea un nuovo progetto su Google Apps Script.
2. Copia nel progetto il contenuto di `tools/navisuite-calendar-apps-script-v2.gs`.
3. In **Impostazioni progetto → Proprietà script** aggiungi:
   - nome: `NAVISUITE_FIREBASE_API_KEY`
   - valore: la Firebase Web API Key già usata da NaviSuite.
4. Verifica che la funzione `postResult_` restituisca un `HtmlOutput` con `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`. NaviSuite riceve infatti l'esito dell'attivazione tramite un iframe nascosto; senza `ALLOWALL` Apps Script usa la protezione X-Frame predefinita e il browser non può consegnare il `postMessage` di risposta.
5. Esegui il deploy come **Applicazione web**:
   - esegui come: proprietario del progetto;
   - accesso: chiunque.
6. Copia l'URL finale che termina con `/exec`.
7. Inserisci quell'URL in `assets/calendar-config.json` come valore di `feedBase`.
8. Pubblica la modifica.

La funzione corretta è:

```js
function postResult_(requestId,result){
  const payload=JSON.stringify(Object.assign({source:'navisuite-calendar',requestId:String(requestId||'')},result||{})).replace(/<\//g,'<\\/');
  return HtmlService
    .createHtmlOutput('<!doctype html><meta charset="utf-8"><script>parent.postMessage('+payload+',"*");<\\/script>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

Esempio configurazione:

```json
{
  "feedBase": "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  "provider": "Google Apps Script",
  "timezone": "Europe/Rome"
}
```

## Test finale

1. Apri direttamente l'URL `/exec` senza token: deve apparire `Calendario NaviSuite: link non valido.`. Se compare una richiesta di accesso Google, la distribuzione non è pubblica e va impostata su **Chiunque**.
2. Apri NaviSuite e accedi normalmente.
3. Vai in **Impostazioni → Calendario personale**.
4. Premi **Attiva sincronizzazione**.
5. Verifica che compaiano il link personale e i pulsanti **Aggiungi su iPhone** / **Aggiungi su Google**.
6. Apri una giornata con turno nave e controlla servizio, nave, ormeggio, rifornimento ed equipaggio.
7. Modifica un turno o una variazione ODS e verifica che il feed mantenga lo stesso UID della giornata e restituisca i dati aggiornati.

## Sicurezza

- Il PIN non viene inserito nel link del calendario.
- Ogni agente riceve un token casuale a 256 bit.
- La registrazione del token viene accettata solo se l'hash del PIN corrisponde a quello salvato in Firebase.
- Rigenerando il link, il token precedente viene revocato.
- La Firebase Web API Key non è salvata nel nuovo sorgente Apps Script: viene letta dalle Script Properties.
- `ALLOWALL` viene usato solo sulla piccola risposta HTML di registrazione/revoca necessaria al `postMessage`; la validazione del token e del PIN resta lato server.
