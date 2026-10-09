# NaviSuite · avvisi a telefono bloccato (TrueNAS)

Ogni minuto controlla chi ha attivato le notifiche e, 10 minuti prima:

- **chi è a terra** (AgB, PonD, AgM, AgT…) riceve l'**arrivo della nave**: nave, pontile, provenienza, corsa, comandante;
- **chi è a bordo** (D1, P2, M1, T1, BIS…) riceve il **prossimo scalo**: scalo e ora, corsa, pontile a Desenzano e lo scalo dopo.

Valgono i ritardi e le sospensioni dell'Ufficio Movimento e le corse fatte dal BIS. L'interruttore
"Arrivi delle navi" in Impostazioni spegne entrambi.

Il programma **non spedisce** niente da solo: mette gli avvisi nella coda di Firebase
(`private/adminUpdates/pushQueue`), da cui li spedisce il push-worker che hai già su TrueNAS. Per questo non servono
chiavi: usa lo stesso accesso anonimo dell'app. Il codice delle regole è quello dell'app, scaricato da GitHub Pages
ogni 30 minuti, quindi ogni aggiornamento di NaviSuite vale subito anche qui.

## Installazione su TrueNAS

1. Copia questa cartella (`tools/push-arrivi-worker`) sul TrueNAS, per esempio in `/mnt/<pool>/apps/navisuite-arrivi`.
2. Da una shell, in quella cartella: `docker compose up -d --build`
3. Controlla il log: `docker logs -f navisuite-arrivi` (deve dire "codice dell'app caricato").

In alternativa, dall'interfaccia di TrueNAS: *Apps → Discover → Custom App*, immagine `node:20-alpine`, comando
`node /app/worker.js`, con la cartella montata in `/app` e la variabile `TZ=Europe/Rome`.

## Prove

- `DRY_RUN=1`: scrive nel log gli avvisi che metterebbe in coda, senza mandarli.
- `node worker.js --elenco 112`: elenca gli avvisi di oggi per l'agente 112.

Ogni avviso ha un codice fisso in coda: anche dopo un riavvio non arriva due volte.
