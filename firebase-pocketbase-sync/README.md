# firebase-pocketbase-sync

Mirror **incrementale** Firebase RTDB → PocketBase per NaviSuite.

Finché il frontend non è migrato, **Firebase resta la sorgente autoritativa**:
questo processo scrive solo verso PocketBase (upsert idempotente per chiave
stabile) e traccia cosa ha già visto in `firebase_sync_state` /
`firebase_sync_runs`. Gira sul TrueNAS a fianco di `ponteradio-worker`, perché
PocketBase non è raggiungibile da fuori la LAN/Tailscale.

## Entità implementate

| Entità PB | Sorgente Firebase | Chiave upsert |
|---|---|---|
| `configurazione` | `private/adminUpdates/shipConfigurations`, `.../announcements` | `chiave` |
| `periodi_bozza` | `private/adminUpdates/draftPeriod` | `legacy_id = firebase-draft-period` |
| `stati_settimana` | `private/adminUpdates/weekStatuses` | `data_inizio` (riconcilia: crea/aggiorna/**elimina**) |
| `annunci` | `private/adminUpdates/announcements/personal/*` | `legacy_id = <published.id>` |

> `stato = nascosta` per le settimane non è nell'enum PB `stati_settimana.stato`
> (`bozza`/`ufficiale`): quelle settimane vengono contate ma non scritte.
> Aggiungere il valore all'enum per gestirle.

## Da fare (prossime entità)

Serve la logica di derivazione — idealmente lo **script del freeze del 1° settembre**
(non nel repo) per replicarne le convenzioni:

- `agenti` / `users` — da `public/schedule/residenze` + `private/adminUpdates/agentProfiles` + `userAuth`/`userRegistry`
- `variazioni` — da `odsVariations` + `manualVariations`
- `importazioni_turni` + `turni` + `turni_effective` — da `scheduleImports` + `public/schedule` (**la parte più complessa**: turno effettivo = base + variazione + cambio, con `versione`)
- `turni_navi` / `navi` — da `turniNavi`
- `cambi_turno` — da `private/changeRequests` (+ `approvedChangeRequests`, `deletedChangeRequests`)
- `diaria` — da `private/diaria/<agentId>` (solo input; il calcolo resta nel frontend)
- `documenti` — da `documentsMeta` + Firebase Storage (download → upload file PB)
- `segnalazioni` — da `feedbackTickets`
- `push_*` / `pushSettings` — unificare con l'infra Ponte Radio

## Configurazione

Copia `.env.example` in `.env` (resta sul TrueNAS, **mai nel repo**):

```
FIREBASE_DB_URL=...        # RTDB, sola lettura via sign-in anonimo
FIREBASE_API_KEY=...       # già pubblica nel frontend
PB_URL=http://pocketbase:8090
PB_SUPERUSER_EMAIL=...     # + PB_SUPERUSER_PASSWORD  (rinnova il token da solo)
SYNC_INTERVAL_MS=900000    # 15 min
ENTITIES=                  # vuoto = tutte; oppure CSV
```

`PB_SUPERUSER_TOKEN` (al posto di email+password) solo per un test/backfill una-tantum.

## Avvio

```bash
# test/backfill una-tantum (un solo giro, poi esce)
SYNC_ONCE=1 node sync.js

# in produzione (Docker, come ponteradio-worker)
docker build -t navisuite-firebase-pocketbase-sync:latest .
docker run -d --name navisuite-fb-pb-sync --restart unless-stopped \
  --network ix-pocketbase_default --env-file .env \
  navisuite-firebase-pocketbase-sync:latest
```

Nessuna dipendenza npm: Node 22 ha `fetch` nativo.
