# NaviSuite · piano di ripristino

Ogni notte il TrueNAS (programma `navisuite-arrivi`) salva in `/mnt/nas/Navigarda/backup`:

| File | Cosa contiene | Quanti |
|---|---|---|
| `NaviSuite-backup-AAAA-MM-GG.json` | tutti i dati Firebase: distinte, trasformazioni, profili, PIN, turni, variazioni, navi, pontili | ultimi 60 giorni |
| `NaviSuite-backup-AAAA-MM-GG-distinte.csv` | le distinte di tutti, da aprire con Excel | ultimi 60 giorni |
| `codice/NaviSuite.git` | il codice dell'app con tutta la storia (copia di GitHub) | sempre aggiornato |
| `codice/NaviSuite-sito-AAAA-MM-GG.zip` | il sito pronto da pubblicare | ultimi 14 giorni |

Backup subito: `docker exec navisuite-arrivi node worker.js --backup`

## Se GitHub non funziona

Il sito si può servire dal TrueNAS, con lo stesso Firebase (i dati restano quelli di sempre):

```sh
cd /mnt/nas/Navigarda/backup/codice
rm -rf sito && mkdir sito && cd sito && unzip -q ../$(ls ../NaviSuite-sito-*.zip | tail -1 | xargs basename)
docker run -d --name navisuite-sito --restart unless-stopped -p 8090:8765 -v "$PWD":/app -w /app node:20-alpine node server.js
```

Poi si apre `http://<indirizzo del TrueNAS>:8090` (in rete di casa) oppure l'indirizzo Tailscale del TrueNAS. Per
notifiche e installazione sul telefono serve https: con Tailscale `tailscale serve` lo dà già.

Per spostare il codice su un altro servizio (GitLab, Codeberg…), creato un repository vuoto:
`git --git-dir /mnt/nas/Navigarda/backup/codice/NaviSuite.git push --mirror <indirizzo del nuovo repository>`

## Se Firebase perde i dati (o va rifatto)

1. Nella console Firebase (lo stesso progetto o uno nuovo) → Realtime Database.
2. Dal file JSON di backup si estraggono le due parti da importare:
   ```sh
   cd /mnt/nas/Navigarda/backup
   F=$(ls NaviSuite-backup-*.json | tail -1)
   docker run --rm -v "$PWD":/b -w /b node:20-alpine node -e "const d=require('./'+process.argv[1]);require('fs').writeFileSync('adminUpdates.json',JSON.stringify(d.adminUpdates));require('fs').writeFileSync('schedule.json',JSON.stringify(d.schedule))" "$F"
   ```
3. Nella console: sul nodo `private/adminUpdates` → menu ⋮ → **Importa JSON** → `adminUpdates.json`; sul nodo
   `public/schedule` → **Importa JSON** → `schedule.json`.
4. Se il progetto Firebase è nuovo, nel codice vanno cambiati indirizzo del database e chiave
   (`assets/js/admin-firebase-rest.js`, `assets/js/shared-data.js`, `assets/js/connection-webpush.js`) e le regole di accesso.

Ogni agente ha anche il suo backup personale (Distinta → Scarica backup) da ricaricare con "Carica backup".

## Se si rompe il TrueNAS

Conviene una seconda copia fuori casa della cartella `backup`: su TrueNAS **Data Protection → Cloud Sync Tasks** →
Add → Google Drive (o OneDrive, Dropbox), direzione **Push**, cartella `/mnt/nas/Navigarda/backup`, ogni notte alle 3.
Lo spazio basta: circa 5 MB al giorno di dati più 50 MB di codice.

## Se spariscono sia GitHub sia Firebase

Si fanno i due passi sopra: sito dal TrueNAS (o da un altro servizio) e dati in un nuovo progetto Firebase.
Per non dipendere più da Firebase c'è la migrazione a PocketBase sul TrueNAS, iniziata e da completare
(`pocketbase/MIGRATION_STATUS.md`).
