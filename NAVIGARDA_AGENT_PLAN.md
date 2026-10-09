# Navigarda Live Tracker — piano di sviluppo

Stato: **solo ricognizione e piano. Nessun codice scritto.** Data: 2026-10-09.
Le verifiche sulle fonti (§3) sono *preliminari* (sondaggi GET su pagine pubbliche + ricerca web) e vanno completate nella Fase 1.

---

## 1. Ricognizione del repository

### 1.1 Struttura
Repo `papamike80/navisuite`, branch `main`, **nessun ramo/cartella "Navibeta"**: l'ambiente di test non esiste nel repo (vedi §6, decisione D1).

| Area | Contenuto |
|---|---|
| Radice | ~25 pagine HTML statiche (`index`, `naviturni`, `movimento`, `oggi`, `orario`, `servizi-terra`, `mio-turno`, `cambi_turno`, …), `sw.js`, `manifest.json`, `server.js` (server statico locale + OCR) |
| `assets/js`, `assets/css` | Frontend vanilla JS (nessun bundler, nessun framework) |
| `v2/assets/pb.js` | Unico client PocketBase del frontend (`window.NaviV2PB`) |
| `pocketbase/` | `pb_schema.json` (dump di 27 collection), `pb_hooks/*.pb.js`, `MIGRATION_STATUS.md` |
| `ponteradio-worker/` | Worker Node (web-push) → **modello da imitare** per il nuovo servizio |
| `firebase-pocketbase-sync/` | Mirror Firebase→PB, Node senza dipendenze, gira sul TrueNAS |
| `backend/orari-api/` | Unico servizio Python+FastAPI esistente (SQLite, porta 8080) |
| `tools/stampe`, `stampe/`, `ods/` | Generatori PDF Python e documenti |
| `tests/` | Test Node sui moduli puri JS |

### 1.2 Tecnologia frontend
HTML + JavaScript vanilla, PWA (service worker, manifest), moduli "puri" testabili con Node (`push-arrivi.js`, `push-summary.js`, `course-info.js`, `orario-corse.js`). Dati correnti ancora da **Firebase RTDB** (autoritativo); migrazione a PocketBase in corso, frontend PB per ora solo in `v2/`.

**Deploy: GitHub Pages pubblica l'intero repository** (`.github/workflows/static.yml` carica `path: '.'`). Conseguenza: *tutto ciò che committiamo è pubblico*. Nessun `.env`, token o credenziale nel repo; solo `.env.example`.

### 1.3 Docker esistente
Nessuna orchestrazione unica; ogni servizio ha il suo `Dockerfile`:
- `ponteradio-worker`: `node:22-alpine`, `env_file: .env`, rete esterna **`ix-pocketbase_default`**, avvio con `docker build` + `docker run` (il plugin Compose **non è installato** sul TrueNAS; il `docker-compose.yml` è solo documentazione).
- `firebase-pocketbase-sync`: stesso schema, nessuna dipendenza npm.
- `orari-api`: `python:3.12-slim`, FastAPI+uvicorn, porta 8080, volume `./data`.

Il nuovo servizio seguirà lo stesso schema (Dockerfile + `.env.example` + istruzioni `docker run` + compose come documentazione).

### 1.4 PocketBase
- Versione **0.40.1**, container `pocketbase` sul TrueNAS. LAN `http://192.168.178.158:8095`, interno Docker `http://pocketbase:8090`, esterno (Tailscale) `https://truenas-scale.tail805e51.ts.net:8443`.
- Collection italiane (`navi`, `turni_navi`, `agenti`…), rules in stile `@request.auth.role = "admin"`. `users` ha `role` ∈ agente/admin/super_user.
- I servizi sul NAS si autenticano come **superuser PB** (`PB_SUPERUSER_EMAIL/PASSWORD`, token rinnovato da sé) — pattern già usato da `firebase-pocketbase-sync`.
- Gli endpoint custom vivono in `pb_hooks/*.pb.js` con prefisso `/api/navisuite-v2/...` (`routerAdd`); il frontend raggiunge PB solo da Tailscale/LAN.
- Nessun `pb_migrations/` (schema solo dump JSON): le nuove collection vanno consegnate come **JSON importabile** + (opz.) creazione idempotente da parte dell'agente.
- Collection già esistenti che si sovrappongono: `navi` (27 navi, `nome`, `residenza`) → il nuovo `vessels` deve poter puntare a `navi` (campo opzionale `nave` relation) per non duplicare l'anagrafica.
- Nomi richiesti (`vessels`, `ports`, `passages`, `events`) **non collidono** con le 27 collection esistenti.

### 1.5 Dati orario già presenti nel repo (base "teorica")
`orari_corse_2026.csv` (corsa;partenza;località;arrivo;località) + `assets/js/orario-corse.js`, `course-info.js`, `push-arrivi.js` (avvisi 10 min prima dell'arrivo). Sono la base per `scheduled_time`: **non serve** scrapare gli orari ufficiali, vanno solo mappati a `passages`.

---

## 2. Punti di integrazione consigliati

| Cosa | Dove | Motivo |
|---|---|---|
| Servizio agente | nuova cartella **`navigarda-agent/`** alla radice (come `ponteradio-worker/`) | stessa convenzione; zip-abile da solo |
| Collection | `navigarda-agent/pb_collections.json` (import da UI PB) + bootstrap idempotente | niente `pb_migrations` nel repo |
| API `/live/*` | **hook PB** `pocketbase/pb_hooks/navigarda_live.pb.js` → `/api/navisuite-v2/live/{vessels,passages,delays}` | il frontend parla già solo con PB; zero nuove porte esposte; stesso pattern di `navisuite_schedule.pb.js` |
| FastAPI | solo `/health` + debug interno (opzionale) | evita un secondo endpoint pubblico; resta leggero |
| UI | nuova pagina `live.html` + `assets/js/live-*.js`, poi aggancio a `movimento.html` / `oggi.html` | pagine statiche autonome, modulo puro testabile |
| Avvisi | riuso `push_queue` (`kind` select) per "ritardo > N min" | già servito da ponteradio-worker |
| Dati teorici | `orari_corse_2026.csv` → seed di `passages.scheduled_time` | già nel repo |

---

## 3. Fonti dati — esito preliminare

> Regola: nulla è dato per esistente. Sotto, cosa è **verificato** e cosa **no**.

### A) Navigazione Laghi / Navigarda (navigazionelaghi.it)
| Verifica | Esito |
|---|---|
| Sito | WordPress (WPML, Yoast, WooCommerce, MailPoet…). HTTP 200, raggiungibile |
| `robots.txt` | consente tutto tranne `/wp-content/uploads/wpforms/` (+ sitemap). **Legittimo leggere le pagine pubbliche, a bassa frequenza** |
| WP REST `/wp-json/` | esiste (namespace standard + `mcp`, `wp-abilities`). Nessun namespace di orari/tracking/GPS nell'elenco |
| Endpoint JSON / WebSocket / GTFS | **nessuno trovato** nell'HTML di home e pagina Garda (solo `admin-ajax.php` per form/ricerca). `/gtfs.zip`, `/gtfs/` → 404 |
| Mappa live / GPS | **non trovata** (la pagina Garda non ha script di mappa; un solo "Tracking" è probabilmente testo/CSS) |
| Orari | **PDF** (estate/inverno, `wp-content/uploads/2026/..`) + pagine "avvisi" (variazioni, soppressioni) |
| Da fare | ispezione con Playwright (tab Network/WS) di: pagina "Biglietti e orari Lago di Garda", ricerca corse (`form_ricerca.js`), app **DreamLake** |

### B) Google Transit
- Ricerca web: **nessuna evidenza** di feed GTFS / GTFS-realtime pubblico per Navigarda. Nessun risultato su portali open data.
- Da verificare in Fase 1: Google Maps (indicazioni "traghetto" Desenzano→Riva), eventuale feed nel Mobility Database / Transitland / NAP nazionale (mobilitaitalia.it), open data Regione Lombardia/Veneto, e **richiesta formale** a `infogarda@navigazionelaghi.it`.
- ⚠ Google **non espone** i tempi aggiornati via API pubblica; lo scraping di Google Maps viola i ToS → **sconsigliato**. La confidence "Google Transit 85" resta valida solo se emerge un feed ufficiale.

### C) Altre fonti
| Fonte | Stato | Note |
|---|---|---|
| **AIS** (MarineTraffic, VesselFinder, AISHub…) | *non verificato* | Sui laghi interni la copertura AIS è spesso scarsa e i battelli possono non trasmettere. Verificare con ricerca per nome nave. È la **fonte più promettente per GPS** se esiste (feed gratuito AISHub in cambio di un ricevitore, oppure ricevitore RTL-SDR proprio in sede) |
| Webcam porti | *non verificato* | Esistono webcam turistiche (Desenzano, Peschiera, Riva…). Servono: URL stabile, diritti d'uso, inquadratura del pontile. Costoso (OCR/AI): ultima priorità |
| Comunicazioni ufficiali | verificato in parte | pagine `/avvisi/…` del sito → utili per eventi (soppressioni, nave sostituita), non per orari reali |
| Social (Facebook/Instagram/X) | *non verificato* | Confidence 40; API a pagamento/ToS restrittivi. Opzionale, ultima |
| **Fonte interna NaviSuite** | **disponibile** | Gli agenti a terra (AgB, PonD…) vedono arrivi/partenze reali: un tasto "nave arrivata / partita" nel frontend è la fonte **più affidabile e gratuita** (proposta confidence 98, `source = "operator"`) |

---

## 4. Architettura proposta

```
 fonti ──► collector (plugin) ──► normalizzatore ──► motore di fusione ──► PocketBase
 (AIS, sito, webcam,           (formato unico         (confidence,           vessels / ports /
  feed GTFS, operatore)         Observation)           ritardi)               passages / events
                                                                                  │
                                              pb_hook /api/navisuite-v2/live/* ◄──┘──► frontend NaviSuite
```

**Servizio `navigarda-agent`** (Python 3.12-slim, un solo container):
- `APScheduler` interno; ogni collector è un plugin con `fetch() -> list[Observation]` e intervallo proprio.
- `Observation = {source, vessel, port, kind: arrival|departure|position, ts, lat?, lon?, raw_ref, base_confidence}`.
- Fusione: per ogni (nave, porto, corsa, giorno) prende le osservazioni, applica pesi, produce `actual_time` + `confidence`. Regola esempio dell'utente: Google 10:20 (85) + Webcam 10:18 (70) → `actual_time = 10:18`, `confidence ≈ 90` (accordo entro 5 min **alza** la confidence, disaccordo la abbassa; il dato più "fisico" vince sul dato "schedulato").
- `delay_minutes = actual_time − scheduled_time` (o `estimated_time` finché non c'è l'actual).
- Persistenza su PB via REST con superuser (come `firebase-pocketbase-sync`), upsert idempotente per chiave `(vessel, port, line, scheduled_time, giorno)`.
- Dipendenze: `httpx`, `apscheduler`, `beautifulsoup4`. **Playwright/Chromium in immagine separata o profilo opzionale** (~400 MB) e solo se serve davvero; OpenCV/OCR escluso finché non c'è una webcam utilizzabile.

**Confidence di base (configurabili in `config.yaml`)**: operatore 98 · GPS/AIS 95 · feed ufficiale 85 · webcam AI 70 · sito (avviso) 60 · social 40.

**Modello dati** (come da richiesta, con aggiunte minime):
- `vessels`: name, code, type, last_lat, last_lon, last_speed, last_update (+ `nave` relation→`navi`, opz.)
- `ports`: name, latitude, longitude (+ `code`, `geofence_m` per rilevare l'attracco da GPS)
- `passages`: vessel, port, line, scheduled_time, estimated_time, actual_time, delay_minutes, source, confidence, created (+ `kind` arrival/departure, `corsa`, `service_date`, `sources` json con le osservazioni grezze → tracciabilità)
- `events`: type, description, timestamp, severity (+ `vessel`, `source`)
- Regole: lettura per utenti autenticati, scrittura solo superuser.

**API** (via hook PB): `GET /live/vessels`, `/live/passages`, `/live/delays`; risposta nel formato d'esempio (`vessel, port, status, time, delay, confidence`).

---

## 5. Rischi

| # | Rischio | Mitigazione |
|---|---|---|
| R1 | **Nessuna fonte live pubblica esiste** (probabile: niente GTFS-RT, niente mappa) → l'agente avrebbe dati teorici soltanto | Fase 1 decide *go/no-go*; fallback = fonte "operatore" interna + AIS proprio |
| R2 | Copertura AIS sul Garda assente/parziale | verificare per nome nave; eventuale ricevitore dedicato |
| R3 | Legale/ToS: scraping Google, social, webcam; GDPR per immagini con persone | no Google Maps scraping; solo fonti con permesso; richiesta scritta a Navigazione Laghi; niente salvataggio frame |
| R4 | Fragilità scraping (HTML WordPress cambia, PDF) | parser isolati per plugin, test su fixture, `events` severity=warning se un collector fallisce N volte |
| R5 | Carico sul NAS | un solo container, polling ≥60 s, niente Chromium sempre acceso, limiti `mem_limit`/`cpus` |
| R6 | Falsi ritardi (nave sostituita, corsa soppressa, sosta lunga) | associazione corsa↔nave con `orari_corse` + `turni_navi`; soglie e stato `cancelled` |
| R7 | **Repo pubblico (GitHub Pages)** → rischio di committare segreti/URL interni | solo `.env.example`; i token PB mai nel repo; URL interni già presenti nel repo, nessuna nuova esposizione |
| R8 | Scrittura accidentale su produzione | env separato Navibeta (§6 D1), prefisso collection o istanza PB di test, flag `DRY_RUN=1` di default |
| R9 | Orologi/fusi (DST) e giorni a cavallo di mezzanotte | tutto in UTC nel DB, `Europe/Rome` solo in presentazione; `service_date` esplicito |
| R10 | Confidence arbitraria percepita come "verità" | mostrare sempre fonte e confidence nell'UI; calibrare su dati reali raccolti |

---

## 6. Decisioni aperte (servono prima della Fase 2)

- **D1 — Navibeta**: non c'è nel repo. Opzioni: (a) ramo/cartella `navibeta/` nello stesso repo; (b) repo separato; (c) istanza PocketBase di test su altra porta del NAS. *Raccomandazione*: cartella `navigarda-agent/` autonoma + **istanza PB di test** (stesso container image, porta e volume diversi) finché non è validata.
- **D2 — API**: hook PB (raccomandato) vs FastAPI esposta.
- **D3 — Operatore interno**: ok aggiungere in NaviSuite il tasto "arrivata/partita" per gli agenti a terra? È la fonte più affidabile.
- **D4 — Contatto ufficiale** con Navigazione Laghi per feed/permessi.

---

## 7. Piano a fasi (stop e verifica a ogni fase)

| Fase | Contenuto | File toccati | Verifica |
|---|---|---|---|
| **0** (questa) | Ricognizione + piano | `NAVIGARDA_AGENT_PLAN.md` | tu leggi e decidi D1–D4 |
| **1** | **Analisi fonti** (nessun servizio): Playwright su sito/DreamLake, ricerca AIS per nome nave, Mobility Database/Transitland/NAP, webcam; report con evidenze e HAR/screenshot | `docs/navigarda/FONTI.md` (nuovo) | per ogni fonte: esiste / formato / frequenza / ToS / affidabilità; go/no-go |
| **2** | Prototipo minimo (CLI, **nessun PB**): 1 collector reale + normalizzazione + calcolo ritardo su `orari_corse_2026.csv`; output JSON/console | `navigarda-agent/` (src, test, Dockerfile) | `pytest` su fixture; run locale |
| **3** | Integrazione PocketBase (istanza test): `pb_collections.json`, client REST, upsert idempotente, scheduler, fusione + confidence | `navigarda-agent/…`, `.env.example` | `DRY_RUN` poi scrittura su PB test; casi Baldo 10:20/10:18 → 10:18, conf. 90 |
| **4** | API `/live/*` (hook PB) + test; `/health` | `pocketbase/pb_hooks/navigarda_live.pb.js` | `curl` sui 3 endpoint, formato d'esempio |
| **5** | Integrazione NaviSuite: `live.html` + modulo puro `assets/js/live-*.js` + test Node; poi push ritardi via `push_queue` | `live.html`, `assets/js/live-*.js`, `tests/` | test Node; prova su Navibeta |
| **6** | Hardening e rilascio: limiti risorse, log, alert su `events`, **ZIP di export** (`navigarda-agent.zip`) + istruzioni `docker build/run` sul TrueNAS | `README.md`, script zip | deploy su NAS di test, 48 h di soak |

**Export ZIP**: tutto il lavoro vive in `navigarda-agent/` (+ 1 hook + 2–3 file frontend elencati nel README del modulo), quindi `zip -r navigarda-agent.zip navigarda-agent pocketbase/pb_hooks/navigarda_live.pb.js` basta per portarlo altrove.
