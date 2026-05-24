# RetailMind AI Agent Context

Dokumen ini adalah konteks utama untuk AI coding agent yang bekerja di repository **RetailMind**. Gunakan dokumen ini sebagai entry point sebelum membaca dokumen teknis lain.

## 1. Ringkasan Produk

RetailMind adalah platform customer intelligence dan campaign distribution untuk bisnis retail/UMKM. Sistem mengubah data transaksi mentah menjadi insight pelanggan dan aksi marketing otomatis.

Kapabilitas utama:

- Analitik pelanggan berbasis RFM, churn risk, segmentasi, dan CLTV.
- Dashboard React untuk melihat performa pelanggan.
- AI copywriting berbasis Gemini untuk membuat pesan campaign.
- Distribusi campaign WhatsApp melalui server Node.js dan webhook Fonnte.
- Rencana orkestrasi campaign multi-channel: WhatsApp, Instagram, dan email.

## 2. Arsitektur Tingkat Tinggi

```text
Data Transaksi
   ↓
Python/Notebook ML Pipeline
   ↓
RFM + Segmentation + Churn Risk + CLTV
   ↓
Model/data artifacts di backend/data dan backend/model
   ↓
Frontend Dashboard React
   ↓
Campaign Generator Gemini
   ↓
Node.js API + SQLite + Dispatch Worker
   ↓
WhatsApp/Fonnte Webhook dan Channel Distribusi
```

## 3. Struktur Repository Penting

| Path | Fungsi |
| --- | --- |
| `src/` | Source frontend React/Vite. |
| `src/components/` | Komponen dashboard dan campaign UI. |
| `src/api.js` | Client API frontend ke server. |
| `server/src/` | Backend Express API, routes, worker, dan integrasi webhook. |
| `server/data/retailmind.db` | SQLite database lokal. |
| `backend/data/` | Dataset mentah dan hasil enrichment ML. |
| `backend/model/` | Artifact model ML serialized (`joblib`). |
| `backend/modelling/` | Notebook eksperimen/training ML. |
| `docs/` | Dokumentasi terorkestrasi untuk manusia dan AI agent. |
| `backend/docs/` | Dokumentasi pipeline ML legacy/duplikat historis. |

## 4. Stack Teknologi

Frontend:

- React 19
- Vite
- Tailwind CSS
- Recharts
- Lucide React

Backend/API:

- Node.js ESM
- Express
- SQLite via `better-sqlite3`
- Fonnte webhook/API untuk WhatsApp
- Google Generative AI SDK

ML/Data:

- Python notebook
- Pandas, NumPy
- Scikit-learn
- Lifetimes untuk CLTV
- Joblib untuk model artifact

AI:

- Gemini/Gemini Flash untuk copy generation.

## 5. Perintah Development

Root frontend:

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

Server:

```bash
cd server
npm install
npm run dev
npm start
npm run seed
```

Catatan: belum ada test script resmi. Jika menambah behavior baru, tambahkan test/validasi yang relevan sebelum memperkenalkan command test.

## 6. Domain Model Utama

### Customer Analytics

Sumber utama insight pelanggan berasal dari:

- RFM: Recency, Frequency, Monetary.
- Churn risk score: risiko pelanggan tidak kembali belanja.
- Customer segment: hasil clustering K-Means/RFM.
- CLTV: estimasi customer lifetime value.

### Campaign

Campaign dibuat berdasarkan segmentasi dan objective bisnis. Output copy dapat berupa:

- WhatsApp message.
- Instagram caption.
- Email subject/body.
- Rekomendasi diskon.

### WhatsApp Distribution

Alur campaign WhatsApp:

1. User memilih segment/target di dashboard.
2. Sistem generate atau memakai copy campaign.
3. Campaign disimpan di server/database.
4. Worker mengirim pesan secara bertahap jika broadcast aktif.
5. Webhook Fonnte menerima status delivery/reply.
6. Status digunakan untuk monitoring dan feedback loop.

## 7. Prinsip Orkestrasi AI Agent

Saat AI agent mengerjakan repository ini:

1. Mulai dari `docs/README.md` dan dokumen ini.
2. Untuk tugas UI, baca `src/App.jsx`, `src/components/`, dan `src/api.js`.
3. Untuk tugas API/campaign/webhook, baca `server/src/index.js` dan route terkait di `server/src/routes/`.
4. Untuk tugas ML/data, baca `docs/pipeline_documentation.md`, `backend/docs/pipeline_documentation.md`, dan notebook di `backend/modelling/`.
5. Jangan mengubah dataset/model artifact besar kecuali diminta eksplisit.
6. Jangan commit `.env`, database lokal, credential, token Fonnte, atau Gemini API key.
7. Pertahankan gaya UI Tailwind yang sudah ada.
8. Pertahankan module ESM (`import/export`) di frontend dan server.
9. Validasi dengan `npm run build` atau `npm run lint` jika perubahan menyentuh frontend.
10. Validasi server dengan menjalankan `cd server && npm run dev` atau endpoint health jika perubahan menyentuh API.

## 8. Prioritas Sumber Dokumentasi

Urutan bacaan yang disarankan:

1. `docs/README.md` — indeks dokumentasi.
2. `docs/AI_AGENT_CONTEXT.md` — konteks kerja AI agent.
3. `docs/DOC_ORCHESTRATION.md` — peta dan status seluruh file Markdown.
4. `docs/pipeline_documentation.md` — detail pipeline ML.
5. `docs/PLAN.md` — rencana campaign distribution pipeline.
6. `docs/wa.md` — rencana integrasi WhatsApp.
7. `WEBHOOK_SETUP.md` — setup webhook Fonnte praktis.
8. `USER_JOURNEY_BLASTING.md` — user journey blasting WhatsApp.
9. `WHATSAPPINTEGRATIONPLAN.md` — rencana WhatsApp historis/detail.
10. `PLANIMPROVEMENT.md` — backlog improvement historis.

## 9. Area Risiko

- Pseudo-labelling churn tidak boleh dianggap ground truth absolut; gunakan feedback loop aktual.
- Integrasi WhatsApp membutuhkan rate limit, retry, dan status tracking.
- Broadcast massal harus punya guardrail: opt-in, opt-out, throttling, dan audit log.
- Prompt Gemini harus menghasilkan JSON yang bisa diparse dan harus ada fallback jika parsing gagal.
- Data pelanggan dan nomor telepon harus diperlakukan sebagai data sensitif.

## 10. Definition of Done untuk AI Agent

Sebuah perubahan dianggap selesai jika:

- File yang relevan sudah dibaca sebelum diedit.
- Perubahan kecil, fokus, dan tidak menyentuh file besar tanpa perlu.
- Dokumentasi di `docs/` diperbarui jika ada perubahan arsitektur/API/alur campaign.
- Tidak ada credential atau data sensitif baru yang masuk repository.
- Command validasi yang relevan sudah dijalankan atau alasan tidak menjalankannya dijelaskan.
