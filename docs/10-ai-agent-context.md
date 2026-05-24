# 10 — AI Agent Context

Dokumen ini adalah konteks ringkas untuk AI/coding agent yang bekerja di repository RetailMind.

## Entry Point

Baca berurutan:

1. `docs/README.md`
2. `docs/01-overview.md`
3. Dokumen domain sesuai tugas:
   - Frontend: `docs/02-frontend.md`
   - Backend/API: `docs/03-backend.md`
   - Inference/ML: `docs/04-inference-process.md`
   - Webhook/WhatsApp: `docs/05-webhook-whatsapp.md`
   - User flow: `docs/06-user-journey.md`

## Struktur Penting

```text
frontend/src/                 Frontend
backend/src/          Backend Express
model/inference/   FastAPI inference
model/model/       Model artifact
model/data/        Dataset
model/modelling/   Training/testing scripts
docs/                Dokumentasi utama
```

## Aturan Kerja

- Jangan mengubah artifact besar/dataset/model kecuali diminta eksplisit.
- Jangan commit credential/token/API key.
- Pertahankan ESM import/export di frontend dan server.
- Update dokumentasi di `docs/` ketika mengubah arsitektur/API/flow.
- Untuk frontend, validasi dengan `npm run build`/`npm run lint` jika memungkinkan.
- Untuk backend, jalankan server atau test endpoint terkait.
- Untuk inference, cek `/health` dan endpoint scoring.

## Sumber Kebenaran Saat Ini

Folder `docs/` adalah sumber utama. Dokumen lama yang tersebar telah dipindahkan ke `docs/archive/` untuk referensi historis, bukan sumber utama.

## Guardrail Domain

- Churn risk adalah proxy unsupervised.
- WhatsApp broadcast harus safe: opt-in, throttling, dry-run/test send, audit log.
- AI copywriting harus human-reviewed sebelum blast.
- Data pelanggan harus dianggap sensitif.
