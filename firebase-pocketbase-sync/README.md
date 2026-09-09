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
| `configurazione` | `.../serviceConfigurations`, `.../announcements` | `chiave` |
| `periodi_bozza` | `.../draftPeriod` | `legacy_id = firebase-draft-period` |
| `stati_settimana` | `.../weekStatuses` | `data_inizio` (riconcilia) |
| `annunci` | `.../announcements/personal/*` | `legacy_id = <published.id>` |
| `users` | `.../userAuth` + `userRegistry` + `agentProfiles` | `login_id` (password = pinHash, reset solo se cambia) |
| `agenti` | `public/schedule/residenze` + `agentProfiles` + bariste | `legacy_id` (collega `user`) |
| `segnalazioni` | `.../feedbackTickets` | `legacy_id` |
| `variazioni` | `.../odsVariations` + `manualVariations` | `legacy_id = VAR:<data>|<id_agente>|<tipo>|<ods>` (riconcilia) |
| `turni_effective` | `.../effectiveSchedule` | `(agente, data)` (riconcilia) — **verify-turni.js: 0 differenze** |

> `stato = nascosta` per le settimane non è nell'enum PB `stati_settimana.stato`
> (`bozza`/`ufficiale`): contate ma non scritte. Aggiungere il valore all'enum.

## Da fare (prossime entità)

- `turni_navi` / `navi` — da `turniNavi` (serve matching nome nave → `navi`, i valori Firebase sono sporchi)
- `cambi_turno` — da `private/changeRequests` (+ `approvedChangeRequests`, `deletedChangeRequests`); lo `stato` è derivato, `changes[]` è multi
- `diaria` — da `private/adminUpdates/diaria/<agentId>` (solo input; il calcolo resta nel frontend)
- `turni` / `importazioni_turni` — da `scheduleImports` + `public/schedule` (grezzi; `turni_effective` basta al frontend)
- `documenti` — da `documentsMeta` + Firebase Storage (download → upload file PB)
- `correzioni_quiz`, `attivita_utenti`
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
