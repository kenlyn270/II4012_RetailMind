# DOCSIBAY.md — Dokumentasi Progress WhatsApp Integration

> Terakhir diperbarui: 20 Mei 2026

---

## 1. Status Umum

| Area | Status | Catatan |
| --- | --- | --- |
| Data Pipeline (Segmentasi) | ✅ Selesai | 5.878 customer tersegmentasi di SQLite |
| Contact Enrichment | ✅ Selesai | 5.878 kontak, 4.702 opted-in (80%) |
| Database Schema | ✅ Selesai | Semua tabel sesuai plan |
| Backend API (Segments) | ✅ Selesai | GET segments, preview, eligibility filter |
| Backend API (Campaigns) | ✅ Selesai | CRUD, approve, trigger, pause, resume, cancel |
| Fonnte Service | ✅ Selesai | Single send, batch send, dry-run mode |
| Dispatch Worker | ✅ Selesai | Polling worker, throttle, daily cap, auto-pause |
| Webhook Handler | ✅ Selesai | Status update + inbound opt-out |
| Frontend Campaign UI | ✅ Selesai | Terhubung ke API real, bukan mock |
| AI Copywriter (LLM) | ❌ Belum | Masih template statis di frontend |
| Conversion Tracking | ❌ Belum | Tabel `broadcast_conversions` ada, logic belum |
| Production Deployment | ❌ Belum | Masih local development |

---

## 2. Arsitektur Yang Sudah Berjalan

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                │
│  src/components/WhatsAppCampaign.jsx                    │
│  src/api.js                                             │
└────────────────────┬────────────────────────────────────┘
                     │ /api proxy (vite → localhost:3001)
┌────────────────────▼────────────────────────────────────┐
│  Backend (Express)                                      │
│  server/src/index.js                                    │
│                                                         │
│  Routes:                                                │
│    /api/segments         → segmentService.js            │
│    /api/campaigns        → campaignService.js           │
│    /api/webhooks/fonnte  → webhooks.js                  │
│                                                         │
│  Services:                                              │
│    fonnteService.js      → Fonnte API / dry-run         │
│    segmentService.js     → Query + eligibility filter   │
│    campaignService.js    → CRUD + job generation        │
│                                                         │
│  Workers:                                               │
│    dispatchWorker.js     → Polling setiap 30 detik      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│  SQLite (better-sqlite3)                                │
│  server/data/retailmind.db                              │
│                                                         │
│  Tables:                                                │
│    customer_segments     (5.878 rows)                   │
│    customer_contacts     (5.878 rows, 4.702 opt-in)    │
│    campaigns                                            │
│    campaign_jobs                                        │
│    broadcast_blacklist                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Data Segmentasi Tersedia

### RFM Segment (dari model)

| Segment | Jumlah |
| --- | --- |
| Hibernating | 1.523 |
| Loyal Customers | 1.161 |
| Champions | 837 |
| At Risk | 753 |
| Potential Loyalists | 714 |
| About To Sleep | 385 |
| Need Attention | 266 |
| Promising | 114 |
| Can't Loose | 71 |
| New Customers | 54 |

### K-Means Segment

| Segment | Jumlah |
| --- | --- |
| Hibernating | 1.974 |
| At Risk | 1.465 |
| New/Occasional | 1.251 |
| High Value | 1.188 |

### Recommended Action

| Action | Jumlah |
| --- | --- |
| Standard Nurture | 3.830 |
| Loyalty Maintenance | 1.945 |
| Onboarding Campaign | 54 |
| Win-back Priority | 43 |
| Low-cost Automation | 6 |

---

## 4. API Endpoints Yang Sudah Aktif

### Segments

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/segments` | List semua segment dengan jumlah customer |
| GET | `/api/segments/:segmentId/preview` | Preview audience + eligibility breakdown |

### Campaigns

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/campaigns` | Buat campaign baru (draft) |
| GET | `/api/campaigns` | List semua campaign |
| GET | `/api/campaigns/:id` | Detail campaign + job stats |
| PATCH | `/api/campaigns/:id` | Update field campaign |
| POST | `/api/campaigns/:id/approve` | Approve → generate jobs untuk eligible customers |
| POST | `/api/campaigns/:id/trigger` | Mulai kirim (status → running) |
| POST | `/api/campaigns/:id/pause` | Pause worker |
| POST | `/api/campaigns/:id/resume` | Resume worker |
| POST | `/api/campaigns/:id/cancel` | Cancel + mark pending jobs as failed |
| GET | `/api/campaigns/:id/jobs` | List jobs dengan pagination & filter status |
| POST | `/api/campaigns/:id/test-send` | Kirim test ke 1 nomor |

### Webhooks

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| POST | `/api/webhooks/fonnte/message-status` | Update status job dari Fonnte callback |
| POST | `/api/webhooks/fonnte/inbound` | Deteksi opt-out dari reply pelanggan |

---

## 5. Fitur Frontend Yang Sudah Jalan

### WhatsApp Campaign Page (`src/components/WhatsAppCampaign.jsx`)

**Step 1 — Select Segment**
- Load segment dari API real
- Menampilkan jumlah customer per segment

**Step 2 — Preview Audience**
- Menampilkan total model match vs eligible contacts
- Breakdown excluded: missing phone, not opted-in, blacklisted, frequency capped
- Tabel sample 10 customer (nomor di-mask)

**Step 3 — Craft & Approve Message**
- Template pesan per segment (statis, belum AI)
- Input CTA link
- Input max recipients
- Test send ke nomor internal
- Preview tampilan WhatsApp
- Tombol "Approve & Launch"

**Step 4 — Campaign Monitoring**
- Polling status campaign setiap 3 detik
- Progress: queued / sent / delivered+read / failed
- Tabel jobs terbaru
- Tombol pause/resume

---

## 6. Dispatch Worker Behavior

- Polling setiap 30 detik
- Ambil max 10 pending jobs per batch
- Delay random 8-20 detik antar pesan
- Daily limit default: 100 pesan/hari
- Auto-pause jika failure rate > 20% dalam 5 menit
- Auto-complete campaign jika semua jobs selesai
- Dry-run mode jika `FONNTE_TOKEN` tidak diisi

---

## 7. Compliance Yang Sudah Diimplementasi

- ✅ Hanya kirim ke `whatsapp_opt_in = 1`
- ✅ Blacklist check sebelum kirim
- ✅ Frequency cap 7 hari (configurable)
- ✅ Opt-out detection dari inbound webhook (STOP, BERHENTI, UNSUBSCRIBE, JANGAN KIRIM)
- ✅ Otomatis masuk blacklist + update opt-in = false
- ✅ Pending jobs untuk nomor opt-out langsung di-cancel
- ✅ Daily limit enforcement
- ✅ Auto-pause saat failure rate tinggi

---

## 8. Yang Belum Diimplementasi

### 8.1 AI Copywriter (Prioritas Tinggi)

**Status:** Template statis di frontend. Belum ada integrasi LLM.

**Yang perlu dibuat:**
- `server/src/services/copywriterService.js` — panggil Gemini API
- Route `POST /api/campaigns/:id/generate` — generate pesan per segment
- Prompt template sesuai plan section 10 (konteks segment: avg churn risk, avg recency, avg CLTV, recommended action)
- Personalization token: `{name}`, `{last_purchase_days}`, `{cta_link}`
- Validasi: max 500 karakter, max 3 emoji, wajib ada opt-out footer

**Env vars yang dibutuhkan:**
```bash
COPYWRITER_PROVIDER=gemini
COPYWRITER_MODEL=gemini-2.0-flash
COPYWRITER_TEMPERATURE=0.75
GEMINI_API_KEY=<key>
```

### 8.2 Conversion Tracking

**Status:** Tabel `broadcast_conversions` sudah ada di schema, logic belum.

**Yang perlu dibuat:**
- Endpoint atau cron yang mencocokkan transaksi baru dengan campaign jobs
- Attribution window 7-30 hari
- Hitung revenue per campaign
- Tampilkan di dashboard

### 8.3 Campaign Analytics Dashboard

**Yang perlu dibuat:**
- Delivery rate per campaign
- Failure reason breakdown
- Opt-out rate
- Segment response rate
- ROI calculation (jika conversion tracking aktif)

### 8.4 Scheduled Campaign

**Status:** Field `scheduled_at` ada di schema, tapi worker belum cek jadwal.

**Yang perlu dibuat:**
- Worker cek `scheduled_at` sebelum memproses
- UI date/time picker di step 3

### 8.5 BullMQ + Redis (Production Scale)

**Status:** Belum. Saat ini pakai polling worker.

**Kapan dibutuhkan:** Saat volume > 500 target per campaign atau ada multiple campaign concurrent.

---

## 9. File Structure

```
server/
├── .env                          # Environment variables
├── .env.example
├── package.json
├── data/
│   └── retailmind.db            # SQLite database
└── src/
    ├── index.js                  # Express app entry
    ├── db/
    │   ├── database.js           # Schema + init
    │   └── seed.js               # Import CSV → SQLite
    ├── routes/
    │   ├── segments.js           # Segment endpoints
    │   ├── campaigns.js          # Campaign CRUD + actions
    │   └── webhooks.js           # Fonnte callbacks
    ├── services/
    │   ├── segmentService.js     # Segment resolver + eligibility
    │   ├── campaignService.js    # Campaign logic + job generation
    │   └── fonnteService.js      # Fonnte API wrapper
    └── workers/
        └── dispatchWorker.js     # Polling dispatch worker

src/
├── api.js                        # Frontend API client
├── App.jsx                       # Main app with campaign tab
├── main.jsx
└── components/
    ├── WhatsAppCampaign.jsx      # Campaign UI (connected to API)
    ├── AICopywriter.jsx          # AI panel (intelligence tab)
    ├── ChurnChart.jsx
    ├── HighRiskTable.jsx
    ├── RFMMap.jsx
    ├── SegmentBreakdown.jsx
    └── StatsRow.jsx
```

---

## 10. Cara Menjalankan

```bash
# 1. Seed database (jika belum)
cd server
npm run seed

# 2. Jalankan backend
cd server
npm run dev
# → http://localhost:3001

# 3. Jalankan frontend
cd ..
npm run dev
# → http://localhost:5173 (proxy /api → 3001)
```

### Environment Variables (server/.env)

```bash
# Fonnte (kosongkan untuk dry-run)
FONNTE_TOKEN=
FONNTE_SEND_URL=https://api.fonnte.com/send
FONNTE_COUNTRY_CODE=0

# Broadcast control
BROADCAST_ENABLED=true
BROADCAST_DAILY_LIMIT=100
BROADCAST_BATCH_SIZE=10
BROADCAST_MIN_DELAY_SEC=8
BROADCAST_MAX_DELAY_SEC=20
BROADCAST_FREQUENCY_CAP_DAYS=7

# AI Copywriter (belum aktif)
COPYWRITER_PROVIDER=gemini
COPYWRITER_MODEL=gemini-2.0-flash
COPYWRITER_TEMPERATURE=0.75
GEMINI_API_KEY=
```

---

## 11. Referensi

- Plan lengkap: `WHATSAPPINTEGRATIONPLAN.md`
- Pipeline documentation: `docs/pipeline_documentation.md`
- WA planning draft: `docs/wa.md`
- Campaign engine plan: `docs/PLAN.md`
