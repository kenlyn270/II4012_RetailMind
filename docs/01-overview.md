# 01 — Overview RetailMind

## Tujuan Produk

RetailMind membantu bisnis retail/UMKM memahami pelanggan dan menjalankan campaign yang lebih tepat sasaran. Input utama adalah data transaksi; outputnya adalah customer intelligence dan aktivasi marketing.

## Kapabilitas Utama

- **Customer analytics:** RFM, churn risk score, segmentasi K-Means/RFM, CLTV.
- **Dashboard intelligence:** ringkasan metrik, chart churn, RFM map, segment breakdown, high-risk table.
- **Dataset scoring:** upload CSV transaksi/RFM lalu sistem melakukan scoring dan profiling.
- **Campaign management:** create, approve, trigger, pause, resume, cancel campaign.
- **AI copywriter:** generate pesan WhatsApp/copy campaign dengan Gemini, dengan fallback template.
- **WhatsApp delivery:** pengiriman via Fonnte, dry-run mode, webhook status/reply.

## Arsitektur Tingkat Tinggi

```text
CSV transaksi/RFM
   ↓
Frontend DatasetUpload
   ↓ /api/datasets/score-direct
Backend Express
   ↓
Inference service Python/FastAPI
   ↓
RFM aggregation → Predictor → Calibration → Recommendation
   ↓
Dashboard insight
   ↓
AI campaign/copywriting
   ↓
Campaign approval + dispatch worker
   ↓
Fonnte WhatsApp API
   ↓
Webhook status/reply
```

## Stack Teknologi

| Area | Teknologi |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, Recharts, Lucide React |
| Backend | Node.js ESM, Express, SQLite/better-sqlite3 |
| WhatsApp | Fonnte API/webhook; opsi future: WhatsApp Cloud API |
| AI Copy | Google Generative AI/Gemini |
| Inference | Python, FastAPI, Pandas, Scikit-learn, Lifetimes, Joblib |
| Model | Isolation Forest, K-Means, BG-NBD, Gamma-Gamma |

## Struktur Repository

```text
src/                  Frontend React/Vite
src/components/       Komponen dashboard dan campaign UI
src/api.js            API client frontend
server/src/           Backend Express
server/src/routes/    Route segments, campaigns, datasets, system, webhooks
server/src/services/  Campaign, copywriter, Fonnte, inference, validator
server/src/workers/   Dispatch worker broadcast
server/data/          SQLite lokal runtime
backend/inference/    FastAPI inference service
backend/modelling/    Notebook/script training dan testing
backend/model/        Artifact model joblib + model card
backend/data/         Dataset mentah/processed/dummy
docs/                 Dokumentasi terstruktur
```

## Status Implementasi Saat Ini

- Dashboard frontend sudah memiliki mode **Intelligence** dan **Blasting Message**.
- Backend Express mengekspos `/api/segments`, `/api/campaigns`, `/api/datasets`, `/api/system`, dan webhook Fonnte.
- Inference service menyediakan scoring dari transaksi dan RFM.
- Broadcast worker dapat dijalankan jika `BROADCAST_ENABLED=true`.
- Untuk keamanan demo, beberapa flow campaign merutekan segmen ke nomor demo representative, bukan full mass blast.

## Prinsip Desain

1. **Human-in-the-loop:** campaign perlu preview/approval sebelum pengiriman.
2. **Safe blasting:** dry-run, demo routing, throttling, retry, dan audit status.
3. **Model transparency:** skor churn adalah proxy unsupervised, bukan label churn absolut.
4. **Data sensitivity:** nomor telepon, data pelanggan, token API, dan DB lokal tidak boleh dipublikasikan.
