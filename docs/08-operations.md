# 08 — Operations, Commands, Environment

## Menjalankan Frontend

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Menjalankan Backend Express

```bash
cd server
npm install
npm run dev
npm start
npm run seed
```

## Menjalankan Inference Service

Sesuaikan environment Python yang memiliki dependency FastAPI, pandas, scikit-learn, lifetimes, joblib.

Contoh:

```bash
uvicorn backend.inference.app:app --host 0.0.0.0 --port 8000 --reload
```

Jika memakai conda env project:

```bash
/home/ikhbar/miniconda3/envs/basicneeds/bin/python -m uvicorn backend.inference.app:app --host 0.0.0.0 --port 8000 --reload
```

## Environment Variable

### Backend Express

```bash
PORT=3001
BROADCAST_ENABLED=false
FONNTE_TOKEN=...
GEMINI_API_KEY=...
INFERENCE_BASE_URL=http://localhost:8000
```

### Inference

```bash
MODEL_PATH=backend/model/retail_ai_model_assets.joblib
```

## Health Check

```bash
curl http://localhost:3001/api/health
curl http://localhost:8000/health
```

## Ngrok/Webhook Local

```bash
cd server
npm run dev
ngrok http 3001
```

Daftarkan URL HTTPS ngrok ke Fonnte webhook.

## Data dan File Sensitif

Jangan commit:

- `.env`, token, API key,
- database lokal runtime (`server/data/*.db*`),
- nomor telepon nyata di dokumentasi publik,
- dataset customer sensitif.

## Validasi Setelah Perubahan

| Area perubahan | Validasi minimum |
| --- | --- |
| Frontend | `npm run build` dan/atau `npm run lint`. |
| Backend route/service | Start server dan hit endpoint terkait. |
| Inference | `GET /health`, test `/score/from-rfm` atau `/score/from-transactions`. |
| WhatsApp | dry-run dulu, lalu test send terbatas. |
| Dokumentasi | Pastikan link dari `docs/README.md` tetap valid. |

## Backup/Fallback

- Jika Gemini gagal: gunakan fallback template.
- Jika Fonnte token tidak ada: dry-run.
- Jika inference down: UI/backend harus mengembalikan error jelas.
- Jika CSV invalid: tampilkan pesan validasi kolom.

## Production Checklist

- Auth backend dan role access.
- HTTPS dan CORS terbatas.
- Secret manager untuk token.
- Persistent DB yang dikelola.
- Queue robust untuk campaign worker.
- Rate limiting endpoint public/webhook.
- Idempotency untuk webhook dan send job.
- Opt-in/opt-out customer.
- Monitoring/logging terstruktur.
- Backup database dan migration strategy.
