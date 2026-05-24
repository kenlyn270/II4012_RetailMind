# Dokumentasi Terstruktur RetailMind

Dokumentasi ini adalah sumber kebenaran tunggal untuk project RetailMind. Semua dokumen lama yang tersebar di root, `backend/docs/`, dan dokumen plan historis sudah dikonsolidasikan ke folder `docs/`.

## Urutan Baca Cepat

1. [01-overview.md](./01-overview.md) — ringkasan produk, arsitektur, stack, struktur repo.
2. [02-frontend.md](./02-frontend.md) — frontend React/Vite, komponen, state, dan API client.
3. [03-backend.md](./03-backend.md) — backend Express, database, service, worker, endpoint.
4. [04-inference-process.md](./04-inference-process.md) — pipeline data, model, scoring, kalibrasi, rekomendasi.
5. [05-webhook-whatsapp.md](./05-webhook-whatsapp.md) — Fonnte/WhatsApp, webhook, status, setup ngrok.
6. [06-user-journey.md](./06-user-journey.md) — journey user dari login, upload dataset, insight, sampai blasting.
7. [07-campaign-ai-copywriting.md](./07-campaign-ai-copywriting.md) — AI copywriter Gemini dan orkestrasi campaign.
8. [08-operations.md](./08-operations.md) — command, environment, testing, deployment, guardrail.
9. [09-roadmap-risks.md](./09-roadmap-risks.md) — backlog, risiko, dan rekomendasi improvement.
10. [10-ai-agent-context.md](./10-ai-agent-context.md) — konteks kerja untuk AI/coding agent.

## Ringkasan Project

RetailMind adalah platform customer intelligence dan campaign distribution untuk retail/UMKM. Sistem mengubah data transaksi menjadi insight pelanggan dan aksi marketing:

- Analitik RFM, churn risk, segmentasi, dan CLTV.
- Dashboard React untuk upload dataset dan membaca insight.
- Inference service Python/FastAPI untuk scoring customer.
- Backend Express + SQLite untuk campaign, segment, webhook, dan dispatch worker.
- AI copywriting berbasis Gemini.
- Integrasi WhatsApp/Fonnte untuk pengiriman pesan dan webhook status.

## Peta Komponen

```text
Frontend React/Vite (frontend/src/)
  ↓ /api
Backend Express (backend/src/)
  ├─ Campaign, segment, dataset, system API
  ├─ SQLite database
  ├─ Fonnte service + webhook
  └─ Dispatch worker
  ↓ HTTP/process call
Inference FastAPI/Python (model/inference/)
  ├─ RFM aggregation
  ├─ Predictor loading joblib model
  ├─ Dataset calibration
  └─ Recommendation/explanation
  ↓
Model/data assets (model/model, model/data)
```

## Aturan Dokumentasi ke Depan

- Tambahkan dokumen baru hanya di `docs/`.
- Jangan membuat dokumen planning baru di root project.
- Jika mengubah API, update `03-backend.md` dan dokumen domain terkait.
- Jika mengubah inference/model, update `04-inference-process.md`.
- Jika mengubah WhatsApp/webhook, update `05-webhook-whatsapp.md`.
- Jika mengubah UI/journey, update `02-frontend.md` dan `06-user-journey.md`.
