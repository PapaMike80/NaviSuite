# Ponte Radio worker

Worker Node dedicato a Ponte Radio su NaviSuite. Legge i job dalle route
protette di PocketBase e usa web-push per consegnare le notifiche.

Il file .env resta esclusivamente sul TrueNAS e non deve essere inserito nel
repository. Deve definire:

- POCKETBASE_URL=http://pocketbase:8090
- PONTERADIO_WORKER_SECRET
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT
- POLL_MS (facoltativo, predefinito 5000)
- SYNC_USERS_URL (facoltativo): URL che restituisce {users:[{login_id,pin_hash,role,name}]}
- SYNC_USERS_TOKEN, SYNC_USERS_INTERVAL_MS (facoltativi)

Sul TrueNAS attuale il plugin Compose non è installato. Avvio:

- docker build -t navisuite-ponteradio-worker:latest .
- docker run -d --name navisuite-ponteradio-worker --restart unless-stopped --network ix-pocketbase_default --env-file .env navisuite-ponteradio-worker:latest

Il container si collega alla rete Docker esterna ix-pocketbase_default.
