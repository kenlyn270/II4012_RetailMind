# RetailMind Campaign Distribution Pipeline

> **Context:** Arsitektur end-to-end dari AI generate campaign → distribusi ke WhatsApp & Social Media  
> **Date:** 2026-05-17

---

## Arsitektur Keseluruhan

```
┌─────────────────────────────────────────────────────────────────┐
│                    RETAILMIND CAMPAIGN ENGINE                    │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐ │
│  │ Customer  │───▶│ AI Campaign  │───▶│ Campaign Orchestrator │ │
│  │ Segments  │    │ Generator    │    │ (BullMQ + Redis)      │ │
│  │ (RFM/     │    │ (Gemini API) │    │                       │ │
│  │  K-Means) │    │              │    │  ┌─── WA Channel ───┐ │ │
│  └──────────┘    │ Outputs:     │    │  │ Batch + Delay    │ │ │
│                  │ • WA Message  │    │  └──────────────────┘ │ │
│                  │ • IG Caption  │    │  ┌─── IG Channel ───┐ │ │
│                  │ • Email Copy  │    │  │ Container API    │ │ │
│                  └──────────────┘    │  └──────────────────┘ │ │
│                                      │  ┌─── Email ────────┐ │ │
│                                      │  │ SMTP / Resend    │ │ │
│                                      │  └──────────────────┘ │ │
│                                      └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: AI Campaign Generation (per Segment)

LLM menerima **context dari data analytics** dan menghasilkan multi-channel content sekaligus:

```javascript
// backend/services/campaignGenerator.js
const { GoogleGenAI } = require("@google/genai");

async function generateCampaign(segmentData, config) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
Kamu adalah marketing expert untuk retail UMKM Indonesia.
Buat campaign untuk segment "${segmentData.name}" (${segmentData.count} customers).

DATA SEGMENT:
- Avg Churn Risk: ${segmentData.avgChurn}/100
- Avg CLTV: £${segmentData.avgCltv}
- Avg Days Inactive: ${segmentData.avgRecency} hari
- Top Products: ${segmentData.topProducts.join(', ')}

GOAL: ${config.goal} | TONE: ${config.tone}

Generate dalam format JSON:
{
  "whatsapp": {
    "message": "...(max 500 chars, include emoji, personal greeting)...",
    "cta_button": "...(text untuk button CTA)..."
  },
  "instagram": {
    "caption": "...(include hashtags, max 2200 chars)...",
    "suggested_visual": "...(describe ideal image for the post)..."
  },
  "email": {
    "subject": "...",
    "body_html": "...(short, with CTA button placeholder)..."
  },
  "discount_recommendation": {
    "percentage": 0,
    "justification": "...",
    "estimated_roi": "..."
  }
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return JSON.parse(response.text);
}
```

### Output Contoh (At Risk Segment)

```json
{
  "whatsapp": {
    "message": "Hai kak! 👋 Udah lama nih gak belanja di [Toko]. Kangen banget sama kamu! 🥺\n\nSpesial buat kamu, ada diskon 15% untuk produk favorit kamu: White Hanging Heart & Jumbo Bag Red 🎁\n\nKlik link di bawah untuk belanja sekarang ⬇️",
    "cta_button": "Belanja Sekarang 🛒"
  },
  "instagram": {
    "caption": "✨ Special comeback offer! ✨\n\nUntuk pelanggan setia yang udah lama gak mampir, kami punya kejutan spesial! Diskon 15% untuk semua produk favorit kamu 💛\n\nBerlaku sampai akhir minggu ini — jangan sampai kelewatan!\n\n#RetailMind #PromoSpecial #UMKM #DiskonSpesial",
    "suggested_visual": "Flat-lay product photography with warm lighting, featuring top products with a 15% OFF badge overlay"
  },
  "email": {
    "subject": "Kamu masih di hati kami 💛 — Diskon 15% khusus untukmu",
    "body_html": "<h2>Hai [Nama]!</h2><p>Kami rindu belanjamu...</p>"
  },
  "discount_recommendation": {
    "percentage": 15,
    "justification": "Avg CLTV segment ini £1,240 — 15% discount on £50 avg order = £7.50 cost vs £1,240 potential lifetime value. ROI sangat positif.",
    "estimated_roi": "16.5x (cost £7.50 vs potential £1,240 CLTV recovery)"
  }
}
```

---

## Step 2: WhatsApp Broadcast (Bertahap)

### Opsi Gateway

| Opsi | Biaya | Kelebihan | Kekurangan |
|------|-------|-----------|------------|
| **WhatsApp Cloud API (Official)** | ~Rp586/pesan marketing | Legal, reliable, template approval | Perlu Meta Business verification |
| **Fonnte (Unofficial)** | Rp25K-175K/bulan flat | Murah, mudah setup | Risk ban, no SLA |
| **WhatsApp Web Automation** | Gratis | No cost | Sangat risky, fragile |

> [!IMPORTANT]
> **Rekomendasi untuk UMKM:** Mulai dengan **Fonnte** (Rp25K/bulan, 1000 pesan) untuk MVP/testing. Migrasi ke **WhatsApp Cloud API** saat sudah production-ready dan volume naik.

### Arsitektur Batch Sending (Bertahap)

```
Campaign Created (478 customers in "At Risk")
        │
        ▼
┌──────────────────────────────────────────┐
│        CAMPAIGN ORCHESTRATOR             │
│        (BullMQ Queue + Redis)            │
│                                          │
│  Batch 1: Customer 1-50    → Send now    │
│  Batch 2: Customer 51-100  → Delay 30min │
│  Batch 3: Customer 101-150 → Delay 60min │
│  ...                                     │
│  Batch 10: Customer 451-478 → Delay 4.5h │
│                                          │
│  Why batching?                           │
│  • Avoid WA rate limits (250/day default)│
│  • Spread load on gateway               │
│  • Allow pause/cancel mid-campaign       │
└──────────────────────────────────────────┘
```

### Implementasi Queue

```javascript
// backend/services/campaignQueue.js
const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis(process.env.REDIS_URL);
const campaignQueue = new Queue("campaign-broadcast", { connection });

// === PRODUCER: Schedule batched messages ===
async function scheduleBroadcast(campaignId, customers, message, options = {}) {
  const BATCH_SIZE = options.batchSize || 50;
  const DELAY_BETWEEN_BATCHES_MS = options.delayMinutes * 60 * 1000 || 30 * 60 * 1000;

  const batches = chunkArray(customers, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    await campaignQueue.add(
      "send-batch",
      {
        campaignId,
        batchIndex: i,
        recipients: batches[i], // [{ phone, name, customerId }]
        message,
        channel: options.channel || "whatsapp",
      },
      {
        delay: i * DELAY_BETWEEN_BATCHES_MS, // Batch 0 = now, Batch 1 = +30min, ...
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
      }
    );
  }

  return { totalBatches: batches.length, totalRecipients: customers.length };
}

// === WORKER: Process each batch ===
const worker = new Worker(
  "campaign-broadcast",
  async (job) => {
    const { recipients, message, channel, campaignId, batchIndex } = job.data;
    const results = [];

    for (const recipient of recipients) {
      try {
        // Personalize message
        const personalizedMsg = message.replace("[Nama]", recipient.name);

        if (channel === "whatsapp") {
          await sendWhatsApp(recipient.phone, personalizedMsg);
        } else if (channel === "email") {
          await sendEmail(recipient.email, personalizedMsg);
        }

        results.push({ customerId: recipient.customerId, status: "sent" });

        // Delay 2-5 seconds between individual messages (anti-spam)
        await sleep(2000 + Math.random() * 3000);
      } catch (err) {
        results.push({ customerId: recipient.customerId, status: "failed", error: err.message });
      }
    }

    // Log batch results to DB
    await saveBatchResults(campaignId, batchIndex, results);
    return results;
  },
  { connection, concurrency: 1 }
);
```

### WhatsApp Send Function (Fonnte)

```javascript
// backend/services/channels/whatsapp.js
const axios = require("axios");

// Option A: Fonnte (Unofficial, murah untuk UMKM)
async function sendWhatsAppFonnte(phone, message) {
  const response = await axios.post("https://api.fonnte.com/send", {
    target: phone,
    message: message,
    countryCode: "62",
  }, {
    headers: { Authorization: process.env.FONNTE_TOKEN },
  });
  return response.data;
}

// Option B: Official WhatsApp Cloud API (Production)
async function sendWhatsAppOfficial(phone, templateName, params) {
  const response = await axios.post(
    `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,       // Pre-approved template
        language: { code: "id" }, // Indonesian
        components: [{
          type: "body",
          parameters: params.map((p) => ({ type: "text", text: p })),
        }],
      },
    },
    { headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` } }
  );
  return response.data;
}
```

---

## Step 3: Social Media Posting (Instagram)

### Arsitektur

```
AI generates caption + suggested visual
        │
        ▼
┌─────────────────────────────┐
│  Option A: Auto-Post via    │
│  Instagram Graph API        │
│  (requires Business acct)   │
│                             │
│  1. Upload image to CDN     │
│  2. Create media container  │
│  3. Publish container       │
└─────────────────────────────┘
        OR
┌─────────────────────────────┐
│  Option B: Copy-to-Clipboard│
│  (Simpler, no API needed)   │
│                             │
│  Dashboard shows preview +  │
│  "Copy Caption" button      │
│  User posts manually        │
└─────────────────────────────┘
```

> [!TIP]
> **Rekomendasi:** Mulai dengan **Option B** (copy-to-clipboard). Auto-posting via Instagram API memerlukan Meta Business verification yang prosesnya bisa berminggu-minggu. Copy-to-clipboard memberikan user control penuh dan zero setup cost.

### Option B Implementation (Practical)

```jsx
// components/CampaignPreview.jsx
function SocialMediaPreview({ campaign }) {
  const [copied, setCopied] = useState(false);

  const copyCaption = () => {
    navigator.clipboard.writeText(campaign.instagram.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl p-6 border shadow-sm">
      <h3 className="font-bold text-lg mb-4">📱 Instagram Post Preview</h3>
      
      {/* Mock IG Post Card */}
      <div className="border rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-amber-100 to-pink-50 h-48 
                        flex items-center justify-center text-slate-400">
          {campaign.instagram.suggested_visual}
        </div>
        <div className="p-4">
          <p className="text-sm whitespace-pre-wrap">
            {campaign.instagram.caption}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={copyCaption}
          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 
                     text-white py-3 rounded-xl font-bold">
          {copied ? "✅ Copied!" : "📋 Copy Caption"}
        </button>
        <button className="px-4 py-3 bg-slate-100 rounded-xl font-bold">
          ✏️ Edit
        </button>
      </div>
    </div>
  );
}
```

---

## Step 4: Campaign Dashboard (Monitoring)

### UI: Campaign Control Center

```
┌──────────────────────────────────────────────────────────────┐
│  📣 Campaign: Win-back At Risk Customers                     │
│  Status: 🟡 In Progress (Batch 3/10)                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Progress                                            │    │
│  │ ████████████████░░░░░░░░░░░░░░░░  148/478 (31%)    │    │
│  │                                                     │    │
│  │ ✅ Batch 1: 50 sent (2 failed)     10:00 AM        │    │
│  │ ✅ Batch 2: 50 sent (0 failed)     10:30 AM        │    │
│  │ 🔄 Batch 3: 48/50 sending...       11:00 AM        │    │
│  │ ⏳ Batch 4: Scheduled              11:30 AM        │    │
│  │ ⏳ Batch 5: Scheduled              12:00 PM        │    │
│  │ ...                                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Channels:                                                   │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐                   │
│  │ WhatsApp │ │ Instagram │ │  Email   │                   │
│  │ 148 sent │ │ 1 posted  │ │ 0 sent   │                   │
│  │ 96% rate │ │ ✅ Live   │ │ Skipped  │                   │
│  └──────────┘ └───────────┘ └──────────┘                   │
│                                                              │
│  [⏸ Pause Campaign]  [⏹ Cancel]  [📊 View Results]        │
└──────────────────────────────────────────────────────────────┘
```

### Campaign Data Model

```javascript
// backend/models/campaign.js
const campaignSchema = {
  id: "uuid",
  name: "Win-back At Risk Customers",
  segment: "At Risk",
  status: "in_progress", // draft | scheduled | in_progress | paused | completed | cancelled
  
  // AI-generated content
  content: {
    whatsapp: { message: "...", cta_button: "..." },
    instagram: { caption: "...", suggested_visual: "...", posted: false },
    email: { subject: "...", body_html: "..." },
    discount: { percentage: 15, justification: "..." },
  },

  // Distribution config
  distribution: {
    channels: ["whatsapp"],   // which channels to use
    batchSize: 50,
    delayMinutes: 30,
    totalRecipients: 478,
  },

  // Progress tracking
  progress: {
    totalBatches: 10,
    completedBatches: 2,
    sent: 100,
    failed: 2,
    pending: 376,
  },

  createdAt: "2026-05-17T10:00:00Z",
  scheduledAt: "2026-05-17T10:00:00Z",
  completedAt: null,
};
```

---

## Step 5: Full User Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  1. User membuka Dashboard                              │
│     └─→ Melihat segment "At Risk" = 478 customers      │
│                                                         │
│  2. Klik "Generate Campaign" untuk segment ini          │
│     └─→ Pilih: Goal=Re-engage, Tone=Friendly           │
│     └─→ AI generates WA message + IG caption + Email    │
│                                                         │
│  3. User review & edit AI-generated content             │
│     └─→ Preview: WA bubble, IG post mock, Email preview │
│     └─→ Edit kalau perlu, lalu "Approve"                │
│                                                         │
│  4. Configure distribution                              │
│     └─→ Channel: ☑ WhatsApp  ☑ Instagram  ☐ Email      │
│     └─→ Batch size: 50 | Interval: 30 menit            │
│     └─→ Schedule: Now / Pick date-time                  │
│                                                         │
│  5. Launch Campaign! 🚀                                 │
│     └─→ WA: BullMQ starts sending in batches            │
│     └─→ IG: Caption copied / auto-posted                │
│                                                         │
│  6. Monitor progress in Campaign Dashboard              │
│     └─→ Real-time: sent/failed/pending counts           │
│     └─→ Pause/resume/cancel anytime                     │
│                                                         │
│  7. Post-campaign analytics (after 7-30 days)           │
│     └─→ Berapa customer yang kembali belanja?            │
│     └─→ Revenue generated vs campaign cost               │
│     └─→ Feed back to churn model (feedback loop)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Estimasi Biaya untuk UMKM

### Skenario: 500 customer, 1 campaign/minggu

| Komponen | Opsi Murah | Opsi Production |
|----------|-----------|-----------------|
| Gemini API (generate content) | ~Rp500/campaign | ~Rp500/campaign |
| WhatsApp (Fonnte) | Rp25K/bulan (1000 pesan) | — |
| WhatsApp (Official API) | — | Rp293K/bulan (500×Rp586) |
| Instagram | Gratis (copy-paste) | Gratis (API) |
| Redis (queue) | Gratis (local) | ~Rp50K/bulan (cloud) |
| **Total/bulan** | **~Rp30K** | **~Rp350K** |

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| AI Content | Gemini 2.0 Flash | Generate multi-channel campaign copy |
| Queue | BullMQ + Redis | Batch scheduling, retry, pause/resume |
| WA Gateway | Fonnte → WA Cloud API | Send personalized messages |
| Social Media | Copy-to-clipboard → IG Graph API | Social posting |
| Email | Resend / Nodemailer | Email campaigns |
| Database | SQLite → PostgreSQL | Campaign & delivery tracking |
| Frontend | React (existing Vite app) | Campaign UI, preview, monitoring |

---

## Verdict: Feasibility

| Aspect | Score | Notes |
|--------|:-----:|-------|
| Technical feasibility | ⭐⭐⭐⭐⭐ | Semua API tersedia, well-documented |
| Cost for UMKM | ⭐⭐⭐⭐⭐ | Mulai dari Rp30K/bulan |
| Implementation effort | ⭐⭐⭐⭐ | ~2-3 sprint (4-6 minggu) |
| User value | ⭐⭐⭐⭐⭐ | Mengubah insight → action langsung |
| Legal/compliance risk | ⭐⭐⭐ | WA unofficial = risk; official = safe |

> [!IMPORTANT]
> **Ini sangat feasible.** Fitur ini mengubah RetailMind dari "dashboard analytics" menjadi **"action platform"** — user tidak hanya melihat data, tapi langsung bertindak dari dashboard yang sama. Ini differentiator kuat vs kompetitor yang hanya menyediakan visualisasi.
