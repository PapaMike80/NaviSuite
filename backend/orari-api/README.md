# NaviTurni - Orari API

API REST leggera per sincronizzare le modifiche della pagina `orari-tabella` tra dispositivi.
Include anche la persistenza per utente della pagina `navidiaria`.

## Endpoint

- `GET /health`
- `GET /api/orari-tabella`
- `PUT /api/orari-tabella`
- `POST /api/orari-tabella`
- `GET /api/navidiaria/{agentId}`
- `PUT /api/navidiaria/{agentId}`
- `POST /api/navidiaria/{agentId}`

### Payload scrittura

```json
{
  "data": {
    "N|101|0": "07:10",
    "S|204|4": "11:55"
  }
}
```

### Payload scrittura navidiaria

```json
{
  "entries": [
    {
      "id": "uuid",
      "date": "2026-07-26",
      "shift": "D1",
      "delay": 15,
      "bank": 0,
      "embark": true
    }
  ]
}
```

## Avvio con Docker Compose

```bash
cd backend/orari-api
docker compose up -d --build
```

## Variabili ambiente

- `DB_PATH` (default: `/app/data/orari.db`)
- `CORS_ORIGINS` (default: `*`, lista separata da virgole)

Esempio produzione:

```bash
CORS_ORIGINS=https://naviturni.tuodominio.it,https://www.naviturni.tuodominio.it
```
