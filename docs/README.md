# Dokumentasi RetailMind

Selamat datang di pusat dokumentasi RetailMind. Folder `docs/` adalah sumber utama untuk memahami konteks produk, arsitektur, pipeline data/ML, dan orkestrasi kerja AI agent.

## Quick Start untuk AI Agent

Baca dokumen berikut secara berurutan sebelum melakukan perubahan:

1. [`AI_AGENT_CONTEXT.md`](./AI_AGENT_CONTEXT.md) — konteks utama project untuk AI agent.
2. [`DOC_ORCHESTRATION.md`](./DOC_ORCHESTRATION.md) — peta seluruh dokumentasi Markdown dan statusnya.
3. Dokumen domain sesuai tugas:
   - Frontend/UI: cek `src/App.jsx`, `src/components/`, `src/api.js`.
   - Campaign/WhatsApp: baca [`PLAN.md`](./PLAN.md), [`wa.md`](./wa.md), lalu `../WEBHOOK_SETUP.md`.
   - ML/Data: baca [`pipeline_documentation.md`](./pipeline_documentation.md), [`AIinput.md`](./AIinput.md), dan notebook di `../backend/modelling/`.

## Ringkasan Project

RetailMind adalah platform AI untuk retail/UMKM yang menyediakan:

- Customer analytics berbasis RFM, churn risk, segmentasi, dan CLTV.
- Dashboard React/Vite untuk visualisasi insight pelanggan.
- AI copywriting dengan Gemini untuk campaign marketing.
- Backend Express + SQLite untuk campaign dan webhook.
- Integrasi WhatsApp/Fonnte untuk distribusi dan status pesan.

## Indeks Dokumen Aktif

| Dokumen | Deskripsi |
| --- | --- |
| [`AI_AGENT_CONTEXT.md`](./AI_AGENT_CONTEXT.md) | Konteks operasional AI agent: arsitektur, struktur repo, command, domain model, dan guardrail. |
| [`DOC_ORCHESTRATION.md`](./DOC_ORCHESTRATION.md) | Orkestrasi semua file Markdown, status aktif/legacy, dan alur bacaan per jenis tugas. |
| [`pipeline_documentation.md`](./pipeline_documentation.md) | Dokumentasi detail pipeline data dan ML customer analytics. |
| [`PLAN.md`](./PLAN.md) | Arsitektur campaign distribution pipeline dari AI generation hingga channel distribusi. |
| [`wa.md`](./wa.md) | Rencana teknis WhatsApp dan distribusi multi-channel. |
| [`AIinput.md`](./AIinput.md) | Catatan feasibility, pseudo-labelling, backtesting, dan champion-challenger model. |

## Dokumen Root yang Masih Relevan

| Dokumen | Peran |
| --- | --- |
| [`../WEBHOOK_SETUP.md`](../WEBHOOK_SETUP.md) | Panduan setup webhook Fonnte/ngrok dan endpoint status. |
| [`../USER_JOURNEY_BLASTING.md`](../USER_JOURNEY_BLASTING.md) | User journey fitur blasting message. |
| [`../WHATSAPPINTEGRATIONPLAN.md`](../WHATSAPPINTEGRATIONPLAN.md) | Rencana WhatsApp lama yang detail; gunakan sebagai referensi historis. |
| [`../PLANIMPROVEMENT.md`](../PLANIMPROVEMENT.md) | Backlog/ide improvement historis. |
| [`../GEMINI.md`](../GEMINI.md) | Konteks lama untuk Gemini; digantikan oleh `AI_AGENT_CONTEXT.md`. |

## Struktur Kode Utama

```text
src/                 Frontend React/Vite
src/components/      Komponen dashboard, analytics, campaign UI
server/src/          Backend Express, routes, workers, webhook
backend/data/        Dataset raw dan processed
backend/model/       Artifact model ML
backend/modelling/   Notebook training/eksperimen ML
docs/                Dokumentasi terorkestrasi
```

## Command Penting

Frontend:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Server:

```bash
cd server
npm run dev
npm start
npm run seed
```

## Guardrail Dokumentasi

- Tambahkan dokumentasi baru ke `docs/`.
- Jangan membuat duplikasi panjang; link ke dokumen sumber.
- Jika mengubah API, campaign flow, webhook, atau ML pipeline, update dokumentasi terkait.
- Jangan menyimpan credential, token, API key, atau data sensitif di dokumentasi.
