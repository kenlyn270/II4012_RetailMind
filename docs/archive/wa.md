# 📡 WA Broadcast System — Technical Planning Document

> Sistem broadcast pesan WhatsApp terpersonalisasi berbasis LLM Copywriter,  
> dibangun di atas infrastruktur Fonnte yang sudah ada di HitungUang/CuanBeres.

---

## 1. Executive Summary

Sistem ini adalah **push broadcast engine** — kebalikan dari chatbot reaktif HitungUang.  
Alih-alih menunggu pesan masuk lalu membalas, sistem ini **secara aktif menginisiasi pengiriman pesan** ke pelanggan yang tersegmentasi berdasarkan profil perilaku mereka, dengan pesan yang dihasilkan oleh LLM Copywriter secara individual per target.

**Perbedaan Fundamental dari HitungUang:**

| Aspek | HitungUang (Existing) | Broadcast System (Baru) |
|---|---|---|
| **Arah Komunikasi** | Inbound (user → bot) | Outbound (sistem → user) |
| **Trigger** | Webhook dari Fonnte (pesan masuk) | Scheduler / Event / Manual trigger |
| **LLM Role** | Parser transaksi & NL2SQL | Copywriter pesan personal |
| **Target** | Satu user per sesi | N users sekaligus (batch) |
| **Konteks** | Data keuangan user | Profil segmentasi + perilaku pembelian |

---

## 2. Arsitektur Sistem

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROADCAST SYSTEM                             │
│                                                                 │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │  Segmentation│    │  Campaign     │    │  Dispatch        │  │
│  │  Engine      │───▶│  Manager      │───▶│  Engine          │  │
│  │  (ML/Rules)  │    │  (CRUD)       │    │  (Queue Worker)  │  │
│  └──────────────┘    └───────────────┘    └──────────────────┘  │
│         │                   │                      │            │
│         ▼                   ▼                      ▼            │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │  Customer DB │    │  LLM          │    │  Fonnte API      │  │
│  │  (Supabase)  │    │  Copywriter   │    │  (WA Gateway)    │  │
│  └──────────────┘    │  Service      │    └──────────────────┘  │
│                      └───────────────┘           │             │
│                                                  ▼             │
│                                         ┌──────────────────┐   │
│                                         │  Status Webhook  │   │
│                                         │  Tracker         │   │
│                                         └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow End-to-End

```
[1] Segmentation Engine
     └─ Query DB → identifikasi pelanggan berisiko churn
            │
[2] Campaign Manager
     └─ Operator buat campaign: nama, tipe segmen, template prompt, jadwal
            │
[3] Audience Resolver
     └─ Resolve daftar nomor WA + profil data per user (RFM, CLTV, dll)
            │
[4] LLM Copywriter (per user)
     └─ Input: profil user + campaign context
        Output: pesan personal yang unik per nomor
            │
[5] Job Queue (BullMQ / Cron)
     └─ Enqueue tiap user sebagai job terpisah, atur delay antar kirim
            │
[6] Fonnte Dispatch Worker
     └─ Ambil job → POST ke api.fonnte.com/send dengan delay + typing
            │
[7] Status Webhook Handler
     └─ Terima callback dari Fonnte (/webhook/fonnte/message-status)
        Update status per job: pending → sent → delivered / failed
            │
[8] Analytics Dashboard
     └─ Tampilkan open rate, delivery rate, bounce per campaign
```

---

## 3. Komponen Teknis Detail

### 3.1 Segmentation Engine

**Tujuan:** Mengklasifikasikan pelanggan ke dalam segmen perilaku yang bisa di-trigger untuk broadcast.

**Pendekatan segmentasi (pilih sesuai data yang tersedia):**

#### A. Rule-Based Segmentation (Quick Win)
```javascript
// src/services/segmentationService.js
const SEGMENT_RULES = {
  churn_risk: {
    label: 'Churn Risk',
    description: 'Pelanggan aktif tapi tidak transaksi >30 hari',
    query: `
      SELECT customer_id, phone, last_name, last_purchase_date,
             DATEDIFF(NOW(), last_purchase_date) AS days_inactive
      FROM customers
      WHERE is_active = true
        AND DATEDIFF(NOW(), last_purchase_date) BETWEEN 30 AND 90
    `
  },
  high_value_lapsed: {
    label: 'High Value Lapsed',
    description: 'High-value customer (lifetime > Rp 500rb) yang lapsed',
    query: `
      SELECT c.customer_id, c.phone, SUM(o.amount) AS lifetime_value
      FROM customers c JOIN orders o ON c.id = o.customer_id
      GROUP BY c.id
      HAVING lifetime_value > 500000
        AND MAX(o.created_at) < NOW() - INTERVAL 45 DAY
    `
  },
  new_no_repurchase: {
    label: 'New, No Repurchase',
    description: 'Pelanggan baru (<60 hari) yang belum repeat order',
    query: `...`
  }
};
```

#### B. ML-Based Segmentation (Advanced — referensi dari RetailMind)
- **RFM Scoring:** Recency, Frequency, Monetary — lihat `minggu1_data_rfm_cohort.ipynb`
- **CLTV Prediction:** Customer Lifetime Value — lihat `minggu2_model_cltv_ai.ipynb`
- Output: score per user yang bisa di-threshold untuk masuk segmen

**Kontrak data output Segmentation Engine:**
```typescript
interface SegmentedCustomer {
  customerId: string;
  phone: string;          // Format: 628xxx (tanpa +)
  displayName: string;
  segmentId: string;      // e.g., 'churn_risk'
  segmentScore?: number;  // 0.0 - 1.0
  profileData: {
    lastPurchaseDate?: string;
    lifetimeValue?: number;
    favoriteProduct?: string;
    daysSinceLastPurchase?: number;
    purchaseCount?: number;
    // ... custom fields per bisnis
  };
}
```

---

### 3.2 LLM Copywriter Service

**Tujuan:** Generate pesan yang terasa personal dan tidak seperti blast generic.

**Pattern yang diadopsi dari `aiParser.js` di HitungUang:**
- Gunakan `llmService.generateContentWithFallback()` yang sudah ada
- Cache hasil jika profil identik (hash dari profileData)
- Strict output parsing — validasi panjang, bahasa, tidak boleh kosong

```javascript
// src/services/copywriterService.js

const COPYWRITER_SYSTEM_PROMPT = `
Kamu adalah seorang copywriter WhatsApp profesional untuk brand [BRAND_NAME].
Tugasmu: tulis pesan WhatsApp yang terasa personal, hangat, dan relevan untuk pelanggan tertentu.

ATURAN WAJIB:
- Gunakan nama pelanggan di awal pesan
- Maksimal 3 paragraf pendek (total <200 kata)
- Jangan terkesan spam atau hard-sell
- Sesuaikan nada dengan tipe segmen (lihat konteks)
- Sertakan satu CTA yang jelas di akhir
- Gunakan bahasa Indonesia kasual (tidak formal)
- Boleh gunakan emoji secukupnya (maks 3)
- TIDAK BOLEH mengklaim diskon/promo yang tidak ada di campaign context

OUTPUT: Hanya teks pesan WhatsApp saja. Tidak ada penjelasan tambahan.
`;

async function generatePersonalizedMessage(customer, campaign) {
  const cacheKey = `copy:${campaign.id}:${hashProfile(customer.profileData)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const userContext = `
Nama: ${customer.displayName}
Segmen: ${campaign.segmentLabel}
Terakhir beli: ${customer.profileData.lastPurchaseDate || 'tidak diketahui'}
Produk favorit: ${customer.profileData.favoriteProduct || '-'}
Sudah ${customer.profileData.daysSinceLastPurchase || '?'} hari tidak berbelanja
  `.trim();

  const prompt = `
${COPYWRITER_SYSTEM_PROMPT}

CAMPAIGN CONTEXT:
${campaign.campaignBrief}

DATA PELANGGAN:
${userContext}

Tulis pesan WhatsApp untuk pelanggan ini:
  `.trim();

  const { result } = await llmService.generateContentWithFallback(prompt, {
    maxOutputTokens: 400,
    temperature: 0.85  // Lebih kreatif untuk copywriting
  });

  const message = result.response.text().trim();
  
  // Validasi output
  if (!message || message.length < 20 || message.length > 1500) {
    throw new Error('LLM copywriter returned invalid message length');
  }

  setCached(cacheKey, message, 60 * 60 * 1000); // TTL 1 jam
  return message;
}
```

**Variasi prompt per segmen:**
```javascript
const SEGMENT_CAMPAIGN_BRIEFS = {
  churn_risk: `
    Tujuan: Re-engage pelanggan yang sudah lama tidak berbelanja.
    Tone: Hangat, sedikit kangen, tidak menghakimi.
    CTA: Ajak kembali ke toko dengan reminder produk/kategori favorit mereka.
    Hindari: Terkesan panik atau desperate.
  `,
  high_value_lapsed: `
    Tujuan: Mempertahankan pelanggan premium yang mulai pergi.
    Tone: Eksklusif, dihargai, VIP treatment.
    CTA: Tawarkan preview produk baru atau early access.
    Hindari: Promosi murahan yang merendahkan status VIP mereka.
  `,
};
```

---

### 3.3 Campaign Manager

**Tujuan:** CRUD untuk campaign broadcast, atur jadwal, kelola audience.

**Schema database (Supabase):**
```sql
-- Table: campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment_id TEXT NOT NULL,          -- Referensi ke SEGMENT_RULES key
  campaign_brief TEXT NOT NULL,       -- Context untuk LLM Copywriter
  status TEXT DEFAULT 'draft',        -- draft | scheduled | running | paused | completed
  scheduled_at TIMESTAMPTZ,           -- NULL = manual trigger
  message_delay_range TEXT DEFAULT '5-15', -- Seconds delay antar pesan (Fonnte format)
  typing_indicator BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Table: campaign_jobs
CREATE TABLE campaign_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  customer_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  generated_message TEXT,             -- Hasil LLM Copywriter
  status TEXT DEFAULT 'pending',      -- pending | generating | queued | sent | delivered | failed
  fonnte_request_id TEXT,             -- ID dari response Fonnte API
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_campaign_jobs_campaign_id ON campaign_jobs(campaign_id);
CREATE INDEX idx_campaign_jobs_status ON campaign_jobs(status);
CREATE INDEX idx_campaign_jobs_phone ON campaign_jobs(phone);
```

---

### 3.4 Dispatch Engine (Queue Worker)

**Tujuan:** Mengonsumsi job dari queue, generate pesan via LLM, kirim via Fonnte secara terkontrol.

**Mengapa Queue?**
- Fonnte memiliki rate limit per token
- WhatsApp mendeteksi spam jika kirim terlalu cepat
- Butuh retry logic jika gagal
- Bisa pause/resume per campaign

**Stack yang direkomendasikan:**

| Opsi | Teknologi | Use Case |
|---|---|---|
| **Simple (recommended awal)** | Node.js `setInterval` + Supabase polling | Tanpa Redis, cocok untuk skala kecil (<500 targets/hari) |
| **Production** | BullMQ + Redis | Skala besar, retry otomatis, monitoring dashboard |

**Implementasi Simple (tanpa Redis):**
```javascript
// src/workers/dispatchWorker.js

const BATCH_SIZE = 10;
const INTER_MESSAGE_DELAY_MS = 8000; // 8 detik antar pesan

async function processBatch() {
  // Ambil job yang pending
  const jobs = await dbService.getPendingCampaignJobs(BATCH_SIZE);
  
  for (const job of jobs) {
    try {
      // 1. Generate message jika belum ada
      if (!job.generated_message) {
        await dbService.updateJobStatus(job.id, 'generating');
        const campaign = await dbService.getCampaign(job.campaign_id);
        const customer = await dbService.getCustomerProfile(job.customer_id);
        
        const message = await copywriterService.generatePersonalizedMessage(
          customer, campaign
        );
        
        await dbService.updateJobMessage(job.id, message);
      }

      // 2. Kirim via Fonnte
      await dbService.updateJobStatus(job.id, 'queued');
      const result = await fonnteService.sendMessage({
        target: job.phone,
        message: job.generated_message,
        typing: true,
        delay: '0'  // Delay dihandle sendiri oleh worker
      });

      await dbService.updateJobStatus(job.id, 'sent', {
        fonnte_request_id: result.id?.[0],
        sent_at: new Date()
      });

    } catch (error) {
      await dbService.updateJobStatus(job.id, 'failed', {
        error_message: error.message
      });
      logger.error(`Dispatch job ${job.id} gagal: ${error.message}`);
    }

    // Delay manusiawi antar pengiriman
    await sleep(INTER_MESSAGE_DELAY_MS + randomBetween(2000, 5000));
  }
}

// Jalankan setiap 30 detik
setInterval(processBatch, 30000);
```

**Implementasi BullMQ (Production):**
```javascript
// src/workers/broadcastQueue.js
const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const connection = new Redis(process.env.REDIS_URL);
const broadcastQueue = new Queue('broadcast', { connection });

// Producer: tambah job per user
async function enqueueCampaignJobs(campaignId, customers) {
  const jobs = customers.map(customer => ({
    name: 'send-personalized-message',
    data: { campaignId, customerId: customer.customerId, phone: customer.phone },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    }
  }));
  
  await broadcastQueue.addBulk(jobs);
}

// Consumer Worker
const worker = new Worker('broadcast', async (job) => {
  const { campaignId, customerId, phone } = job.data;
  
  // ... generate + send logic
}, {
  connection,
  concurrency: 1,         // PENTING: serialkan pengiriman agar tidak spam
  limiter: {
    max: 5,               // Maks 5 pesan per 10 detik
    duration: 10000
  }
});
```

---

### 3.5 Status Webhook Tracker

**Memanfaatkan endpoint yang sudah ada di HitungUang:**

Di `src/index.js` sudah ada handler untuk `FONNTE_MESSAGE_STATUS_WEBHOOK_PATH`:
```javascript
// Sudah ada di src/index.js line 229-231
if (request.method === 'POST' && requestUrl.pathname === messageStatusWebhookPath) {
    return await processEventWebhook(request, response, requestUrl, 'message-status');
}
```

**Yang perlu ditambahkan:** Logic di dalam handler tersebut untuk update `campaign_jobs.status`:
```javascript
// Extend processEventWebhook untuk message-status
async function processMessageStatusWebhook(payload) {
  // Fonnte kirim: { id: "80367170", status: "delivered", target: "628xxx" }
  const { id: fonnteRequestId, status } = payload;
  
  if (fonnteRequestId && status) {
    const mappedStatus = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'delivered',
      'failed': 'failed',
    }[status] || null;

    if (mappedStatus) {
      await dbService.updateJobByFonnteId(fonnteRequestId, mappedStatus);
    }
  }
}
```

---

### 3.6 Throttle & Anti-Spam Guard

> [!IMPORTANT]
> Ini adalah komponen kritis untuk mencegah nomor WA diblokir oleh WhatsApp.

```javascript
// src/utils/broadcastThrottle.js

const DAILY_LIMIT_PER_DEVICE = 500;      // Rekomendasi Fonnte untuk keamanan
const MIN_DELAY_BETWEEN_MESSAGES = 5;    // detik
const MAX_DELAY_BETWEEN_MESSAGES = 20;   // detik
const MAX_CONCURRENT_CAMPAIGNS = 1;      // Jangan jalankan 2 campaign sekaligus

// Fonnte's `delay` parameter diset sebagai random range
function buildFonnteDelay(minSec = 5, maxSec = 20) {
  return `${minSec}-${maxSec}`;  // Format Fonnte: "5-20"
}

// Gunakan `data` parameter Fonnte untuk batch yang lebih terkontrol
function buildFonnteDataPayload(jobs) {
  return JSON.stringify(
    jobs.map((job, index) => ({
      target: job.phone,
      message: job.generated_message,
      delay: index === 0 ? '0' : buildFonnteDelay(5, 20), // First: immediate
      typing: true,
    }))
  );
}
```

---

## 4. Campaign Lifecycle

```
┌──────────┐     ┌───────────┐     ┌─────────┐     ┌──────────┐     ┌───────────┐
│  DRAFT   │────▶│ SCHEDULED │────▶│ RUNNING │────▶│ PAUSED   │────▶│ COMPLETED │
│          │     │           │     │         │     │ (manual) │     │           │
└──────────┘     └───────────┘     └─────────┘     └──────────┘     └───────────┘
     │                                  │
     └──────────────────────────────────┘
          (Manual trigger / skip schedule)
```

**State transitions:**
- `draft` → `scheduled`: Operator set waktu kirim
- `draft` / `scheduled` → `running`: Manual trigger atau scheduler cron
- `running` → `paused`: Operator pause (sementara stop dequeue)
- `paused` → `running`: Resume
- `running` → `completed`: Semua job selesai (sent/failed)

---

## 5. Struktur File yang Diusulkan

```
src/
├── index.js                         # Extend existing: tambah broadcast endpoint
├── handlers/
│   └── messageHandler.js            # Tidak berubah (inbound bot)
├── services/
│   ├── fonnteService.js             # Extend: tambah sendBatch(), sendWithData()
│   ├── segmentationService.js       # [NEW] Query & klasifikasi segmen
│   ├── copywriterService.js         # [NEW] LLM personalized message generator
│   ├── campaignService.js           # [NEW] Campaign CRUD & lifecycle manager
│   └── dbService.js                 # Extend: tambah campaign_jobs queries
├── workers/
│   ├── dispatchWorker.js            # [NEW] Polling worker (simple mode)
│   └── broadcastQueue.js            # [NEW] BullMQ worker (production mode)
└── utils/
    ├── broadcastThrottle.js         # [NEW] Anti-spam guard & delay calculator
    └── llmService.js                # Sudah ada, reuse untuk copywriter

web/
└── app/
    └── broadcast/                   # [NEW] Campaign management dashboard
        ├── page.js                  # List campaigns
        ├── [id]/page.js             # Campaign detail & analytics
        └── create/page.js           # Buat campaign baru

supabase/
└── migrations/
    └── 003_broadcast_tables.sql     # [NEW] campaigns + campaign_jobs tables
```

---

## 6. API Endpoints yang Dibutuhkan

### Internal REST API (Express/HTTP di `src/index.js`)

```
POST   /api/campaigns                    # Buat campaign baru
GET    /api/campaigns                    # List semua campaign
GET    /api/campaigns/:id                # Detail + analytics campaign
PATCH  /api/campaigns/:id/status         # { status: 'running'|'paused' }
POST   /api/campaigns/:id/trigger        # Manual trigger (start now)
GET    /api/campaigns/:id/jobs           # List job status per campaign
GET    /api/segments                     # List segmen tersedia + preview count
GET    /api/segments/:id/preview         # Preview audience (tanpa kirim)
```

### Webhook (sudah ada, perlu diextend)
```
POST   /webhook/fonnte/message-status    # Sudah ada, perlu diisi logic
```

---

## 7. Environment Variables Tambahan

```bash
# .env additions
BROADCAST_ENABLED=true
BROADCAST_DAILY_LIMIT=500            # Max pesan/hari per token Fonnte
BROADCAST_MIN_DELAY_SEC=5            # Min delay antar pesan
BROADCAST_MAX_DELAY_SEC=20           # Max delay antar pesan
BROADCAST_BATCH_SIZE=10              # Job per polling cycle

# Optional: Redis untuk BullMQ (production only)
REDIS_URL=redis://localhost:6379

# LLM Copywriter Config
COPYWRITER_MODEL=gemini-1.5-flash   # Model untuk copywriting
COPYWRITER_TEMPERATURE=0.85          # Kreativitas tinggi untuk copywriting
COPYWRITER_CACHE_TTL_MS=3600000      # 1 jam
```

---

## 8. Reuse dari HitungUang — Komponen yang Langsung Dipakai

| Komponen | File | Cara Reuse |
|---|---|---|
| **Fonnte Send** | `src/services/fonnteService.js` | Extend dengan parameter `delay`, `typing`, `data` |
| **LLM Service** | `src/utils/llmService.js` | Direct import di `copywriterService.js` |
| **Logger** | `src/utils/logger.js` | Direct import |
| **DB Client** | `src/services/dbService.js` | Extend dengan campaign queries |
| **Webhook Server** | `src/index.js` | Tambah route `/api/*` dan extend message-status handler |
| **Status Webhook** | `src/index.js` line 229-231 | Sudah ada, isi logicnya |
| **Supabase Client** | Via `dbService.js` | Tidak perlu buat ulang |

---

## 9. Keamanan & Compliance

> [!WARNING]
> WhatsApp sangat ketat soal spam. Kegagalan di sini bisa menyebabkan nomor diblokir permanen.

**Checklist wajib sebelum launch:**

- [ ] **Opt-in explicit:** Semua nomor target HARUS sudah opt-in menerima pesan marketing
- [ ] **Opt-out handling:** Jika user reply "STOP" atau "BERHENTI", sistem harus blacklist otomatis
- [ ] **Frequency cap:** Tidak boleh kirim ke nomor yang sama >1x dalam 7 hari untuk segmen yang sama
- [ ] **Blacklist table:** Tabel `broadcast_blacklist(phone, reason, blacklisted_at)` 
- [ ] **Delay manusiawi:** Gunakan delay acak 5-20 detik, bukan 0 detik
- [ ] **Fonnte token rotation:** Gunakan beberapa token Fonnte untuk distribusi beban
- [ ] **Daily cap monitor:** Hard stop jika sudah mencapai `BROADCAST_DAILY_LIMIT`

---

## 10. Analytics & Monitoring

**Metrics yang harus bisa diukur per campaign:**

```javascript
const campaignAnalytics = {
  total_targeted: 1250,      // Jumlah audience di segmen
  total_sent: 1198,          // Berhasil dikirim ke Fonnte
  total_delivered: 1089,     // Dikonfirmasi delivered oleh WA
  total_failed: 52,          // Gagal (invalid number, etc.)
  delivery_rate: 0.91,       // total_delivered / total_sent
  llm_generation_errors: 15, // Job gagal di fase copywriting
  avg_generation_ms: 1250,   // Rata-rata waktu generate pesan
  campaign_duration_min: 95  // Menit dari start ke last job
};
```

---

## 11. Fase Implementasi

### Phase 0 — Foundation (1-2 hari)
- [ ] Buat migration SQL untuk `campaigns` + `campaign_jobs` + `broadcast_blacklist`
- [ ] Extend `dbService.js` dengan campaign queries
- [ ] Extend `fonnteService.js` dengan parameter broadcast

### Phase 1 — Core Engine (3-5 hari)
- [ ] Implementasi `segmentationService.js` dengan rule-based segmentation
- [ ] Implementasi `copywriterService.js` dengan LLM + cache + validation
- [ ] Implementasi `dispatchWorker.js` (polling mode, tanpa Redis)
- [ ] Extend `src/index.js` dengan API routes + message-status handler

### Phase 2 — Operator Interface (2-3 hari)
- [ ] Halaman Campaign Manager di `web/app/broadcast/`
- [ ] Form buat campaign + preview audience count
- [ ] Dashboard monitoring per campaign (delivery rate, status per job)

### Phase 3 — Hardening (2-3 hari)
- [ ] Implementasi opt-out handler (deteksi reply STOP)
- [ ] Blacklist enforcement
- [ ] Frequency cap checker
- [ ] Migrate ke BullMQ jika skala >500 target/hari

### Phase 4 — ML Segmentation (opsional, berbasis RetailMind)
- [ ] Integrasi RFM score dari pipeline ML
- [ ] Integrasi CLTV score
- [ ] Dynamic threshold untuk churn risk probability

---

## 12. Open Questions untuk Diklarifikasi

> [!IMPORTANT]
> Pertanyaan berikut perlu dijawab sebelum implementasi dimulai:

1. **Database customer:** Di mana data pelanggan (nomor WA, histori transaksi) disimpan? Apakah menggunakan Supabase yang sama dengan HitungUang, atau database terpisah?

2. **Skala awal:** Berapa estimasi jumlah target per campaign? Ini menentukan apakah perlu Redis/BullMQ dari awal atau cukup polling sederhana.

3. **Profil data pelanggan:** Field apa saja yang tersedia di data pelanggan untuk LLM Copywriter? (nama, produk terakhir dibeli, nilai transaksi, kategori favorit, dll.)

4. **Model LLM:** Apakah menggunakan Gemini (seperti HitungUang) atau model lain untuk copywriter? Budget token perlu diestimasi.

5. **Operator interface:** Apakah campaign manager dikelola via dashboard web (butuh halaman baru di Next.js) atau cukup via API (operator pakai Postman/curl)?

6. **Opt-in list:** Bagaimana cara mendapatkan dan memvalidasi list pelanggan yang sudah opt-in?

7. **Multi-brand:** Apakah sistem ini akan melayani satu brand saja atau multi-tenant (banyak klien)?
