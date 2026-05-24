# 03 — Backend Express

## Lokasi Kode

```text
server/src/index.js                  Entry point Express
server/src/routes/segments.js        Segment API
server/src/routes/campaigns.js       Campaign API + demo blast
server/src/routes/datasets.js        Dataset upload/scoring API
server/src/routes/system.js          Health/system API
server/src/routes/webhooks.js        Fonnte webhook API
server/src/services/*.js             Business logic
server/src/workers/dispatchWorker.js Worker pengiriman pesan
server/src/db/database.js            SQLite init/helper
server/src/db/migrations/            Skema database
```

## Entry Point

`server/src/index.js` melakukan:

1. Load environment via `dotenv/config`.
2. Setup Express + CORS + JSON body parser.
3. Init database dengan `initDatabase()`.
4. Mount routes:
   - `/api/segments`
   - `/api/campaigns`
   - `/api/datasets`
   - `/api/system`
   - `/webhook/fonnte`
   - `/api/webhooks/fonnte` untuk backward compatibility.
5. Health check `GET /api/health`.
6. Start worker jika `BROADCAST_ENABLED === "true"`.

## Endpoint Utama

### Health/System

- `GET /api/health` — health Express sederhana.
- `GET /api/system/status` — status komponen sistem, termasuk inference/Fonnte jika tersedia.

### Segment

- `GET /api/segments` — daftar segment bisnis.
- `GET /api/segments/:segmentId/preview?limit=...` — sample customer untuk segment.

### Dataset

- `POST /api/datasets/score-direct` — upload CSV dan scoring langsung.
- `GET /api/datasets/:datasetId/profile` — mengambil profile dataset tersimpan/terhitung.

### Campaign

- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/:id`
- `PATCH /api/campaigns/:id`
- `POST /api/campaigns/:id/approve`
- `POST /api/campaigns/:id/trigger`
- `POST /api/campaigns/:id/pause`
- `POST /api/campaigns/:id/resume`
- `POST /api/campaigns/:id/cancel`
- `GET /api/campaigns/:id/jobs`
- `POST /api/campaigns/:id/generate`
- `POST /api/campaigns/:id/test-send`
- `POST /api/campaigns/preview/generate-preview`
- `GET /api/campaigns/demo-blast/targets`
- `POST /api/campaigns/demo-blast`

## Campaign Lifecycle

```text
Draft campaign created
  ↓
Generate/preview AI message
  ↓
Approve campaign
  ↓
System creates campaign jobs/recipients
  ↓
Trigger campaign
  ↓
Dispatch worker sends pending jobs
  ↓
Fonnte returns status/reply via webhook
  ↓
Jobs and campaign metrics updated
```

## Demo Blast Safety

`routes/campaigns.js` memiliki `DEMO_SEGMENTS` yang memetakan 4 segment ke 4 nomor demo. Tujuannya:

- demo webhook tanpa blasting massal,
- setiap segment mengirim 1 pesan representative,
- fallback dry-run jika `FONNTE_TOKEN` tidak tersedia atau `dryRun=true`.

## Service Layer

| Service | Fungsi |
| --- | --- |
| `campaignService.js` | CRUD campaign, lifecycle, jobs, status. |
| `copywriterService.js` | Generate copy dengan Gemini dan fallback. |
| `fonnteService.js` | Send WhatsApp via Fonnte/dry-run. |
| `inferenceService.js` | Integrasi backend dengan inference service. |
| `datasetValidator.js` | Validasi format dataset upload. |
| `segmentService.js` | Data segment/preview. |

## Worker Dispatch

`dispatchWorker.js` berjalan saat `BROADCAST_ENABLED=true`. Worker mengambil job campaign yang siap dikirim, memanggil Fonnte service, lalu menyimpan hasil/status. Untuk production, worker harus punya:

- throttling per gateway,
- retry/backoff,
- idempotency key,
- pause/cancel check sebelum setiap batch,
- logging dan audit trail.

## Environment Variable Penting

```bash
PORT=3001
BROADCAST_ENABLED=false
FONNTE_TOKEN=...
GEMINI_API_KEY=...
INFERENCE_BASE_URL=http://localhost:8000
```

Jangan commit `.env`, token, database lokal runtime, atau credential.

## Menjalankan Backend

```bash
cd server
npm install
npm run dev
# atau
npm start
```
