# 📱 User Journey: Message Blasting RetailMind

## Overview

Message blasting di RetailMind adalah proses mengirim pesan WhatsApp terpersonalisasi ke pelanggan berdasarkan segmentasi model (RFM, Churn Risk, CLTV). Proses ini **bukan** blast generik — pesan disesuaikan per segmen pelanggan.

---

## Prasyarat

Sebelum melakukan message blasting, pastikan:

1. ✅ Server backend berjalan (`cd server && npm run dev`)
2. ✅ Ngrok tunnel aktif (`./start-ngrok.sh`)
3. ✅ Webhook URL sudah didaftarkan di Fonnte dashboard
4. ✅ `FONNTE_TOKEN` sudah diisi di `backend/.env`
5. ✅ Device WhatsApp terhubung di Fonnte
6. ✅ Data kontak pelanggan sudah diimport (tabel `customer_contacts` dengan `whatsapp_opt_in = true`)

---

## User Journey (Step-by-Step)

### Step 1: Jalankan Server & Ngrok

```bash
# Terminal 1 - Backend server
cd server
npm run dev

# Terminal 2 - Ngrok tunnel
cd server
./start-ngrok.sh
```

Catat URL ngrok yang muncul (contoh: `https://a1b2c3d4.ngrok-free.app`).

---

### Step 2: Daftarkan Webhook di Fonnte

Buka [fonnte.com](https://fonnte.com) → Device → Settings → Webhook:

- **Webhook**: `https://<NGROK_URL>/webhook/fonnte`
- **Webhook Connect**: `https://<NGROK_URL>/webhook/fonnte/connect`
- **Webhook Message Status**: `https://<NGROK_URL>/webhook/fonnte/message-status`

---

### Step 3: Lihat Segmen yang Tersedia

```bash
curl http://localhost:3001/api/segments
```

Response menampilkan daftar segmen pelanggan beserta jumlahnya:
- `at_risk` — pelanggan yang mulai tidak aktif
- `cant_loose` — pelanggan bernilai tinggi yang hampir churn
- `hibernating` — pelanggan yang sudah lama tidak aktif
- `champions` — pelanggan loyal
- dll.

---

### Step 4: Preview Audience Segmen

```bash
curl http://localhost:3001/api/segments/at_risk/preview
```

Response menampilkan:
- Total pelanggan yang cocok
- Jumlah yang eligible (punya nomor, opt-in, tidak blacklist)
- Jumlah yang diexclude (dan alasannya)
- Sample 10 pelanggan

---

### Step 5: Buat Campaign

```bash
curl -X POST http://localhost:3001/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Win-back At Risk Mei 2026",
    "segmentFilter": {
      "segmentId": "at_risk",
      "minChurnRisk": 70
    },
    "goal": "Reaktivasi pelanggan yang mulai tidak aktif",
    "campaignBrief": "Kirim pesan personal untuk mengajak pelanggan kembali berbelanja dengan penawaran spesial",
    "createdBy": "admin"
  }'
```

Catat `id` campaign dari response.

---

### Step 6: Generate Pesan AI

```bash
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/generate \
  -H "Content-Type: application/json" \
  -d '{
    "ctaLink": "https://toko.example.com/promo",
    "promoDetails": "Diskon 20% untuk pembelian berikutnya"
  }'
```

AI copywriter akan membuat pesan yang sesuai dengan segmen, tone, dan CTA. Pesan otomatis tersimpan sebagai template campaign.

---

### Step 7: Preview Pesan (Opsional)

Jika ingin generate pesan tanpa menyimpan:

```bash
curl -X POST http://localhost:3001/api/campaigns/preview/generate-preview \
  -H "Content-Type: application/json" \
  -d '{
    "segmentId": "at_risk",
    "segmentLabel": "At Risk",
    "goal": "Win-back",
    "ctaLink": "https://toko.example.com/promo",
    "promoDetails": "Diskon 20%"
  }'
```

---

### Step 8: Test Send ke Nomor Internal

Sebelum blast ke semua audience, kirim test dulu:

```bash
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/test-send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "628xxxxxxxxxx",
    "message": "Halo! Ini pesan test dari RetailMind. Abaikan pesan ini."
  }'
```

Cek WhatsApp nomor tersebut — pastikan pesan diterima dengan benar.

---

### Step 9: Approve Campaign

Setelah yakin pesan sudah benar:

```bash
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/approve
```

Ini akan:
- Mengubah status campaign ke `scheduled`
- Membuat `campaign_jobs` untuk setiap pelanggan eligible

---

### Step 10: Trigger Pengiriman

```bash
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/trigger
```

Ini akan:
- Mengubah status campaign ke `running`
- Dispatch worker mulai mengirim pesan secara bertahap
- Delay 8-20 detik antar pesan (anti-spam)
- Batch 5-10 pesan per cycle

---

### Step 11: Monitor Progress

```bash
# Lihat status campaign
curl http://localhost:3001/api/campaigns/<CAMPAIGN_ID>

# Lihat detail jobs (status per penerima)
curl "http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/jobs?limit=20"

# Filter jobs berdasarkan status
curl "http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/jobs?status=sent"
curl "http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/jobs?status=failed"
```

---

### Step 12: Pause / Resume / Cancel (Jika Diperlukan)

```bash
# Pause - hentikan sementara
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/pause

# Resume - lanjutkan pengiriman
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/resume

# Cancel - batalkan permanen
curl -X POST http://localhost:3001/api/campaigns/<CAMPAIGN_ID>/cancel
```

---

## Diagram Alur

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] Lihat Segmen → [2] Preview Audience → [3] Buat Campaign   │
│                                                                  │
│  [4] Generate Pesan AI → [5] Test Send → [6] Approve            │
│                                                                  │
│  [7] Trigger → [8] Monitor → [9] Pause/Resume/Cancel            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       SYSTEM FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Dispatch Worker (setiap 30 detik)                              │
│    ↓                                                             │
│  Ambil pending jobs (batch 5-10)                                │
│    ↓                                                             │
│  Generate pesan personal (jika belum ada)                       │
│    ↓                                                             │
│  Kirim via Fonnte API (delay 8-20 detik antar pesan)            │
│    ↓                                                             │
│  Simpan fonnte_message_id                                       │
│    ↓                                                             │
│  Fonnte kirim webhook status → Update job status                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      PELANGGAN FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Terima pesan WhatsApp                                          │
│    ↓                                                             │
│  Klik link / Balas / Abaikan                                    │
│    ↓                                                             │
│  Jika balas "STOP" → Masuk blacklist, tidak dapat pesan lagi    │
│    ↓                                                             │
│  Jika belanja kembali → Ditandai sebagai conversion             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Status Lifecycle

### Campaign Status:
```
draft → scheduled → running → completed
                      ↓  ↑
                    paused
                      ↓
                   cancelled
```

### Job Status:
```
pending → generating → queued → sent → delivered → read
                         ↓                ↓
                       failed           failed
```

---

## Tips & Best Practices

1. **Mulai kecil** — Test dengan 5-10 nomor internal dulu sebelum blast besar
2. **Perhatikan daily limit** — Default 20 pesan/hari (atur di `.env`)
3. **Jangan spam** — Frequency cap 7 hari per nomor
4. **Monitor opt-out** — Jika opt-out > 5%, pause dan evaluasi pesan
5. **Cek ngrok inspector** — Buka `http://localhost:4040` untuk debug webhook
6. **Pastikan device online** — Cek status device di Fonnte dashboard

---

## Contoh Skenario Lengkap

```bash
# 1. Start server & ngrok
cd server && npm run dev          # Terminal 1
cd server && ./start-ngrok.sh     # Terminal 2

# 2. Lihat segmen
curl http://localhost:3001/api/segments

# 3. Preview segmen at_risk
curl http://localhost:3001/api/segments/at_risk/preview

# 4. Buat campaign
curl -X POST http://localhost:3001/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Win-back Mei 2026",
    "segmentFilter": {"segmentId": "at_risk"},
    "goal": "Reaktivasi pelanggan",
    "campaignBrief": "Ajak pelanggan kembali dengan diskon 20%",
    "createdBy": "admin"
  }'
# → Catat campaign ID, misal: "abc-123"

# 5. Generate pesan
curl -X POST http://localhost:3001/api/campaigns/abc-123/generate \
  -H "Content-Type: application/json" \
  -d '{"ctaLink": "https://toko.com/promo", "promoDetails": "Diskon 20%"}'

# 6. Test send
curl -X POST http://localhost:3001/api/campaigns/abc-123/test-send \
  -H "Content-Type: application/json" \
  -d '{"phone": "628123456789", "message": "Test pesan campaign"}'

# 7. Approve
curl -X POST http://localhost:3001/api/campaigns/abc-123/approve

# 8. Trigger blast
curl -X POST http://localhost:3001/api/campaigns/abc-123/trigger

# 9. Monitor
curl http://localhost:3001/api/campaigns/abc-123
curl "http://localhost:3001/api/campaigns/abc-123/jobs?limit=10"
```
