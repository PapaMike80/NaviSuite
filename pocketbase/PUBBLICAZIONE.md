# Pubblicare PocketBase su internet (Tailscale Funnel) in sicurezza

Obiettivo: i colleghi senza Tailscale raggiungono PocketBase allo stesso indirizzo di oggi
`https://truenas-scale.tail805e51.ts.net:8443`, e ognuno vede solo i propri dati.

Fai i passi **in quest'ordine**: prima la sicurezza, poi l'apertura.

## 1. Regole di sicurezza (PocketBase → Collections)

Le tre collection create da NaviSuite avevano le regole aperte. Importa i file aggiornati
(Settings → Import collections) oppure copia le regole a mano:

| Collection | List / View | Create / Update | Delete |
|---|---|---|---|
| `competenze_servizi` | `@request.auth.id != ""` | admin / super_user | admin / super_user |
| `collegamenti_pubblici` | `@request.auth.id != ""` | admin / super_user | admin / super_user |
| `controlli_cassa` | `@request.auth.id != ""` | `@request.auth.id != ""` | admin / super_user |

Le altre collection (`diaria`, `turni`, `variazioni`, `cambi_turno`, …) hanno già regole per utente
(`agente.user = @request.auth.id` o admin). `push_queue` e `push_subscriptions` senza regole = solo superuser.

## 2. Utenti (login)

- L'app ora fa **login automatico** su PocketBase con la sessione NaviSuite: utente = `login_id` (id agente),
  password = l'hash del PIN già salvato sul telefono (`auth-with-password` sulla collection `users`).
- Controlla in `users` che ogni agente abbia `login_id` e `attivo = true`. Chi ha cambiato PIN dopo la migrazione
  del 2026-09-01 ha la password vecchia: va reimpostata (da admin) con l'hash del PIN attuale, altrimenti il
  suo telefono continua a usare solo Firebase (funziona, ma senza copia su PocketBase).
- Gli account di scalo (es. `SCALO_GARDA`) devono esistere in `users` per usare il Controllo cassa.

## 3. Protezioni del server (PocketBase → Settings)

- **Rate limits**: attivali (soprattutto su `auth-with-password`), per bloccare tentativi ripetuti di PIN.
- **Superuser**: password lunga e unica; l'interfaccia `/_/` resta raggiungibile solo da chi la conosce.
- **Backups**: attiva i backup automatici.

## 4. Aprire con Tailscale Funnel

1. Admin console Tailscale → Access controls: abilita l'attributo `funnel` per il nodo TrueNAS
   (`"nodeAttrs": [{ "target": ["tag:..." o l'utente], "attr": ["funnel"] }]`).
2. Sul TrueNAS (shell dell'app/container Tailscale), con PocketBase sulla porta locale 8095:
   ```
   tailscale funnel --bg --https=8443 http://127.0.0.1:8095
   tailscale funnel status
   ```
   Funnel accetta solo le porte 443, 8443 e 10000: 8443 è quella già usata dall'app.
3. Prova da un telefono **senza** Tailscale (rete mobile): `https://truenas-scale.tail805e51.ts.net:8443/api/health`
   deve rispondere `{"code":200,...}`.

## 5. Dopo

Quando tutti raggiungono PocketBase (etichetta admin nella Distinta: «copia PocketBase aggiornata ✓» anche
dai telefoni dei colleghi), si può invertire: PocketBase archivio principale, Firebase backup.

## Buste paga (Verifica busta)
Importa `pocketbase/buste_paga.json` (Settings → Import collections, **senza** spuntare l'eliminazione delle altre collezioni).
Ogni agente vede e modifica solo le proprie buste, gli admin tutte. Si salvano solo i dati letti, mai il PDF.

## Comitive (pagina Comitive e Il mio turno)
Importa `pocketbase/comitive.json` (Settings → Import collections, **senza** spuntare l'eliminazione delle altre collezioni).
Una riga per comitiva (`chiave` unica): quelle dell'O.d.S. le copia la pagina Comitive alla prima apertura di un admin o
dell'Ufficio Movimento, quelle nuove hanno `fonte = manuale`. `turno` = turno nave assegnato (D1, D2, …).
Tutti gli agenti collegati le leggono (Il mio turno le mostra sulle corse); la pagina che le modifica è solo per admin e Movimento.
