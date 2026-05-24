# Orkestrasi Dokumentasi RetailMind

Dokumen ini merapikan peran seluruh file Markdown agar mudah digunakan oleh manusia maupun AI agent.

## 1. Entry Point

Gunakan `docs/README.md` sebagai indeks utama. AI agent harus membaca `docs/AI_AGENT_CONTEXT.md` setelah indeks untuk mendapatkan konteks produk, arsitektur, command, dan aturan kerja.

## 2. Peta Dokumen Aktif

| Dokumen | Status | Peran |
| --- | --- | --- |
| `docs/README.md` | Aktif | Indeks dokumentasi utama. |
| `docs/AI_AGENT_CONTEXT.md` | Aktif | Konteks operasional AI agent. |
| `docs/DOC_ORCHESTRATION.md` | Aktif | Peta orkestrasi seluruh Markdown. |
| `docs/pipeline_documentation.md` | Aktif | Dokumentasi detail pipeline ML/data. |
| `docs/PLAN.md` | Aktif | Arsitektur campaign distribution pipeline. |
| `docs/wa.md` | Aktif | Rencana teknis WhatsApp/social distribution. |
| `docs/AIinput.md` | Aktif | Catatan feasibility ML, pseudo-label, champion-challenger. |
| `backend/docs/pipeline_documentation.md` | Legacy mirror | Duplikat historis pipeline; sinkronkan dengan `docs/pipeline_documentation.md` jika diubah. |
| `WEBHOOK_SETUP.md` | Aktif praktis | Panduan setup Fonnte/ngrok/webhook. |
| `USER_JOURNEY_BLASTING.md` | Aktif produk | Journey pengguna untuk fitur blasting. |
| `WHATSAPPINTEGRATIONPLAN.md` | Legacy detail | Rencana integrasi WhatsApp panjang; gunakan sebagai referensi historis. |
| `PLANIMPROVEMENT.md` | Backlog historis | Ide improvement/roadmap. |
| `GEMINI.md` | Context lama | Ringkasan project lama; digantikan oleh `docs/AI_AGENT_CONTEXT.md`. |
| `DOCSIBAY.md` | Legacy | Referensi historis. |
| `init.md` | Legacy task brief | Brief pembuatan AGENTS.md; tidak menjadi sumber arsitektur. |
| `README.md` | Template lama | README root masih template Vite; gunakan `docs/README.md` untuk konteks proyek. |

## 3. Alur Bacaan Berdasarkan Tugas

### Tugas Frontend Dashboard

1. `docs/AI_AGENT_CONTEXT.md`
2. `src/App.jsx`
3. `src/components/*`
4. `src/api.js`
5. Jalankan validasi: `npm run lint` dan/atau `npm run build`.

### Tugas Campaign/WhatsApp/API

1. `docs/AI_AGENT_CONTEXT.md`
2. `docs/PLAN.md`
3. `docs/wa.md`
4. `WEBHOOK_SETUP.md`
5. `server/src/index.js`
6. `server/src/routes/*`, `server/src/workers/*`, dan modul integrasi terkait.

### Tugas ML/Data Science

1. `docs/AI_AGENT_CONTEXT.md`
2. `docs/pipeline_documentation.md`
3. `docs/AIinput.md`
4. `backend/modelling/*`
5. `backend/data/*` dan `backend/model/*` hanya jika benar-benar diperlukan.

### Tugas Dokumentasi

1. Update dokumen aktif di `docs/` terlebih dahulu.
2. Jika menyentuh pipeline ML, pertimbangkan sinkronisasi `backend/docs/pipeline_documentation.md`.
3. Jangan menjadikan file legacy sebagai sumber utama tanpa mengecek dokumen aktif.

## 4. Kebijakan Penyimpanan Dokumentasi

- Dokumentasi baru harus masuk ke `docs/` kecuali sangat spesifik untuk submodule.
- Dokumentasi yang berisi setup operasional boleh tetap di root jika sudah banyak dirujuk, tetapi harus dicatat di indeks `docs/README.md`.
- Hindari membuat duplikat baru. Jika ada konten overlap, buat ringkasan dan link ke dokumen sumber.
- File legacy tidak perlu dihapus tanpa permintaan eksplisit karena mungkin masih menjadi referensi historis.

## 5. Aturan Update untuk AI Agent

Ketika mengubah kode:

- Perubahan UI signifikan → update `docs/AI_AGENT_CONTEXT.md` atau dokumen product flow terkait.
- Perubahan endpoint/API → update `docs/AI_AGENT_CONTEXT.md` dan dokumen integrasi terkait.
- Perubahan pipeline ML → update `docs/pipeline_documentation.md`.
- Perubahan WhatsApp/webhook → update `WEBHOOK_SETUP.md` atau `docs/wa.md` sesuai konteks.
- Perubahan roadmap/backlog → update `PLANIMPROVEMENT.md` atau buat dokumen aktif baru di `docs/`.

## 6. Target Konsolidasi Masa Depan

Rekomendasi cleanup berikutnya:

1. Ganti `README.md` root dari template Vite menjadi ringkasan RetailMind.
2. Pindahkan atau arsipkan `DOCSIBAY.md`, `GEMINI.md`, dan `init.md` ke `docs/archive/` jika disetujui.
3. Gabungkan rencana WhatsApp yang tumpang tindih dari `WHATSAPPINTEGRATIONPLAN.md`, `docs/wa.md`, dan `WEBHOOK_SETUP.md`.
4. Tentukan satu sumber kebenaran untuk pipeline ML agar `backend/docs/` tidak divergen dari `docs/`.
