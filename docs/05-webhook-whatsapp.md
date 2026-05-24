# 05 — Webhook dan WhatsApp/Fonnte

## Tujuan

Integrasi WhatsApp digunakan untuk mengirim campaign dan menerima status/reply. Implementasi MVP memakai Fonnte karena setup cepat dan biaya rendah; untuk production skala besar disarankan evaluasi WhatsApp Cloud API resmi.

## Endpoint Webhook

Backend mount webhook pada dua prefix:

```text
/webhook/fonnte
/api/webhooks/fonnte
```

Endpoint public yang didaftarkan di dashboard Fonnte:

- `POST/GET /webhook/fonnte`
- `POST/GET /webhook/fonnte/connect`
- `POST/GET /webhook/fonnte/message-status`

Endpoint internal/backward compatible:

- `POST /api/webhooks/fonnte/message-status`

## Flow Delivery Status

```text
Campaign triggered
  ↓
Dispatch worker calls Fonnte send API
  ↓
Fonnte accepts/rejects send request
  ↓
Fonnte sends delivery status to webhook
  ↓
webhooks route parses payload
  ↓
Campaign/job status updated in DB
  ↓
Frontend monitoring reads campaign jobs/status
```

## Flow Reply

```text
Customer receives WhatsApp message
  ↓
Customer replies
  ↓
Fonnte forwards inbound message to webhook
  ↓
Backend stores/handles reply event
  ↓
Future: feedback loop for campaign effectiveness and model labels
```

## Setup Lokal dengan Ngrok

1. Jalankan backend:

```bash
cd backend
npm run dev
```

2. Jalankan ngrok ke port backend:

```bash
ngrok http 3001
```

atau gunakan script jika tersedia:

```bash
cd backend
./start-ngrok.sh
```

3. Ambil public HTTPS URL dari ngrok.

4. Daftarkan webhook Fonnte:

```text
https://<ngrok-domain>/webhook/fonnte
https://<ngrok-domain>/webhook/fonnte/message-status
```

5. Test koneksi dari dashboard Fonnte atau curl.

## Environment Variable

```bash
FONNTE_TOKEN=your_token
BROADCAST_ENABLED=true_or_false
PORT=3001
```

Jika `FONNTE_TOKEN` tidak tersedia, flow demo dapat menggunakan dry-run sehingga tidak mengirim pesan nyata.

## Opsi Gateway

| Gateway | Kelebihan | Kekurangan |
| --- | --- | --- |
| Fonnte | Cepat, murah, mudah untuk demo/MVP. | Unofficial, risiko ban/SLA terbatas. |
| WhatsApp Cloud API | Official, reliable, cocok production. | Butuh Meta Business verification dan template approval. |
| WhatsApp Web automation | Murah/gratis. | Sangat fragile dan berisiko tinggi. |

## Batching dan Throttling yang Disarankan

Untuk production, jangan mengirim semua pesan sekaligus. Gunakan batch:

```text
Batch 1: 1–50      send now
Batch 2: 51–100    delay 30 min
Batch 3: 101–150   delay 60 min
...
```

Guardrail:

- delay 2–5 detik antar pesan individual,
- retry maksimal dengan exponential backoff,
- pause/cancel campaign dapat menghentikan batch berikutnya,
- daily cap sesuai limit gateway,
- audit log per recipient.

## Kepatuhan dan Etika

- Kirim hanya ke customer yang opt-in.
- Sediakan instruksi opt-out.
- Jangan mengirim spam atau pesan terlalu sering.
- Mask nomor telepon pada UI/log publik.
- Jangan menyimpan token Fonnte di dokumentasi atau commit.
