# Migrazione Firebase → PocketBase — stato al 2026-09-09

PocketBase 0.40.1 · `http://192.168.178.158:8095` (LAN) / `https://truenas-scale.tail805e51.ts.net` (Tailscale) · container `pocketbase` su TrueNAS.

## Cosa c'è già

**Schema completo** — 27 collection non-di-sistema (dump versionato: `pb_schema.json`). Regole d'accesso già scritte (`@request.auth.role = "admin"`, `agente.user = @request.auth.id`, ecc.).

| Collection | Record | Note |
|---|---:|---|
| `users` (auth) | 145 | login PIN, `role` select, `login_id`, `must_change_pin` |
| `agenti` | 162 | legato a `users`, `legacy_id`, `permessi_speciali` json |
| `login_directory` | 143 | **pubblica** (list rule `attivo = true`) |
| `turni` | 14 994 | turni grezzi |
| `turni_effective` | 14 492 | **turno effettivo materializzato** (base + variazione + cambio, `versione`, `effective_meta`) |
| `turni_importati` | 0 | staging import (vuoto) |
| `importazioni_turni` | 3 | run di import |
| `variazioni` | 366 | ODS/manuali, `legacy_payload` col dato Firebase grezzo |
| `cambi_turno` | 12 | macchina a stati completa (inviata/accettata/approvata/…) |
| `diaria` | 1 918 | **modello completo** ma i campi calcolati (`ore_*`, `straordinario_*`) sono a **0** — solo `legacy_payload` + i flag booleani sono valorizzati |
| `navi` / `turni_navi` | 27 / 1 343 | |
| `equipaggi_turno_nave` / `requisiti_equipaggio_nave` | 0 / 0 | vuote |
| `documenti` | 2 | file storage PB |
| `annunci` | 3 | popup avvisi |
| `configurazione` | 2 | key/value json: `serviceConfigurations` (= Firebase `shipConfigurations`), `announcementsDrafts` (= Firebase `announcements`) |
| `periodi_bozza` | 1 | |
| `stati_settimana` | 0 | **non migrata** |
| `segnalazioni` | 1 | |
| `attivita_utenti` | 27 | presenza |
| `push_subscriptions` / `push_queue` | 7 / 10 | **usati da Ponte Radio** — `push_queue` ha `kind` select + `broadcast` + `target_agent` |
| `firebase_sync_runs` / `firebase_sync_state` / `log_migrazione` | 0 / 0 / 0 | **pipeline di sync progettata ma mai popolata** |

**Frontend PB** — solo `v2/assets/pb.js` (`window.NaviV2PB`: auth, CRUD, `login_directory`) e Ponte Radio (`ponteradio.js`, `pocketbase/pb_hooks/ponte_radio.pb.js`, route `/api/navisuite-v2/ponteradio/*`).

## I 3 buchi da chiudere

1. **I dati sono un freeze una-tantum del 2026-09-01** (`effective_meta.migratedFrom: "firebase-frozen-2026-09-01"`). Niente li sincronizza da allora: ogni giorno Firebase riceve scritture (cambi turno, diaria, ODS) che PB non ha. `stati_settimana` mai importata.
2. **Nessun importer ri-eseguibile nel repo.** Le collection `firebase_sync_state`/`firebase_sync_runs` erano il design per un sync incrementale con content-hash, ma non è implementato. Lo script che ha caricato il freeze non è versionato (né nel repo né su questo PC).
3. **Nessuno schema-as-code.** Solo `ponte_radio.pb.js` è versionato. Lo schema vive solo sul server (ora dumpato in `pb_schema.json`, ma non c'è `pb_migrations/`).

Il calcolo Diaria (straordinari, 39h, settimane a cavallo) resta lato client (`navidiaria-monthly.js`, `overtime-components.js`) — da NON toccare; PB conserva solo l'input.

## Piano proposto

**Percorso critico = l'importer, non il frontend.** Senza sync, qualunque cutover perde i dati dal 1° settembre in poi.

0. ✅ Dump schema (`pb_schema.json`).
1. **Importer ri-eseguibile** (Node, fuori dall'app live): legge Firebase REST, upsert su PB per `legacy_id`, scrive `firebase_sync_runs`/`firebase_sync_state`. Gira a schedule → PB diventa un mirror sempre fresco mentre Firebase resta autoritativo. Include `stati_settimana`.
2. **Schema-as-code** — `pocketbase/pb_migrations/` rigenerabile.
3. **Auth su PB** — `firebase-auth.js` → `users.auth-with-password`; keystone di tutte le regole d'accesso.
4. **Frontend feature-per-feature** (Firebase resta fallback per ogni feature finché la versione PB non è provata): schedule read (`turni_effective` → `shared-data.js`) → cambi turno → segnalazioni → annunci → aggiornamenti admin → documenti.
5. **Push** — unificare con l'infra PB di Ponte Radio (chiude alla radice il problema "avvisi agente collegato").
6. Spegnere Firebase.
