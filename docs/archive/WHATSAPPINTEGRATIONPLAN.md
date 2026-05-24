# WhatsApp Integration Plan

## 1. Ringkasan

Dokumen ini menjelaskan rencana teknis integrasi WhatsApp blast untuk RetailMind menggunakan Fonnte sebagai gateway awal. Tujuan sistem adalah mengirim pesan WhatsApp terpersonalisasi kepada pelanggan berdasarkan hasil segmentasi model yang sudah tersedia di pipeline RetailMind.

Integrasi ini bersifat outbound campaign, bukan chatbot inbound. Sistem memilih audience dari hasil model, membuat pesan sesuai segmen, meminta admin melakukan review, lalu mengirim pesan bertahap dengan kontrol anti-spam dan tracking status.

Sumber konteks utama:

- `docs/PLAN.md`: campaign engine dan distribusi multi-channel.
- `docs/wa.md`: rancangan WA broadcast, campaign manager, dispatch worker, dan Fonnte.
- `docs/pipeline_documentation.md`: RFM, churn risk, K-Means segment, CLTV, dan recommended action.
- `model/data/enriched_customer_analytics.csv`: output segmentasi dan scoring pelanggan.

Catatan penting: dataset demo saat ini belum memiliki nomor WhatsApp. Sebelum blast nyata, sistem harus menambahkan contact enrichment table yang berisi nomor, status opt-in, dan blacklist.

## 2. Tujuan Dan Prinsip

### Tujuan

- Mengirim campaign WhatsApp sesuai segmen pelanggan, misalnya `At Risk`, `Can't Loose`, `High Value`, atau `Hibernating`.
- Menggunakan hasil analitik RetailMind sebagai konteks copywriting, bukan blast generik.
- Menyediakan dashboard admin untuk preview audience, preview pesan, approval, scheduling, dan monitoring.
- Mencatat feedback delivery dan conversion agar campaign berikutnya lebih akurat.

### Prinsip desain

- Admin harus selalu review dan approve sebelum campaign dikirim.
- Pesan harus dikirim bertahap, bukan sekaligus.
- Nomor tanpa opt-in tidak boleh masuk audience.
- Opt-out harus diproses otomatis.
- Fonnte dipakai untuk MVP karena cepat disiapkan, tetapi arsitektur harus tetap bisa migrasi ke WhatsApp Cloud API.

## 3. Data Segmentasi RetailMind

File `model/data/enriched_customer_analytics.csv` berisi kolom utama:

| Kolom | Fungsi Untuk WhatsApp Campaign |
| --- | --- |
| `Customer ID` | Primary key pelanggan dari pipeline analitik. |
| `Recency` | Jumlah hari sejak pembelian terakhir. |
| `Frequency` | Frekuensi transaksi. |
| `Monetary` | Total nilai pembelian. |
| `Segment` | Label RFM seperti `Champions`, `At Risk`, `Can't Loose`, `Lost`. |
| `churn_risk_score` | Skor risiko churn 0-100. |
| `KMeansSegment` | Segmentasi K-Means seperti `High Value`, `Hibernating`, `At Risk`. |
| `cltv_6_months` | Estimasi CLTV 6 bulan. |
| `CLTVSegment` | Bucket CLTV seperti `A`, `B`, `C`. |
| `RecommendedAction` | Aksi bisnis seperti `Win-back Priority` atau `Loyalty Maintenance`. |

### Contact enrichment wajib

Tambahkan tabel atau file kontak yang tidak dicampur langsung ke dataset model:

```sql
CREATE TABLE customer_contacts (
  customer_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  display_name TEXT,
  whatsapp_opt_in BOOLEAN DEFAULT false,
  opt_in_source TEXT,
  opt_in_at TIMESTAMPTZ,
  last_marketing_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Nomor disimpan dalam format E.164 tanpa tanda plus, misalnya `6281234567890`. Untuk dataset internasional, simpan `country_code` terpisah atau pakai format penuh dan set `countryCode=0` saat mengirim via Fonnte.

## 4. Segment-To-Campaign Mapping

Gunakan hasil model untuk menentukan audience, tone, dan CTA.

| Kondisi Audience | Tujuan Campaign | Tone | Contoh CTA |
| --- | --- | --- | --- |
| `Segment = At Risk` atau `KMeansSegment = At Risk` | Win-back pelanggan yang mulai tidak aktif. | Hangat, personal, tidak menyalahkan. | "Lihat rekomendasi produk favoritmu." |
| `Segment = Can't Loose` dan `CLTVSegment = A` | Selamatkan pelanggan bernilai tinggi. | Eksklusif, VIP, apresiatif. | "Klaim penawaran khusus pelanggan prioritas." |
| `Segment = Hibernating` atau `Lost` | Reaktivasi ringan dengan penawaran jelas. | Ringkas, low pressure. | "Cek katalog terbaru." |
| `Segment = Champions` atau `Loyal Customers` | Loyalty maintenance. | Apresiatif dan premium. | "Dapatkan akses awal koleksi baru." |
| `RecommendedAction = Win-back Priority` | Prioritas broadcast mingguan. | Urgent tetapi tidak spam. | "Balas pesan ini untuk dibantu admin." |

Default MVP:

- Prioritas pertama: `Win-back Priority`.
- Filter tambahan: `churn_risk_score >= 70`.
- Frequency cap: nomor yang sama tidak boleh menerima campaign marketing lebih dari 1 kali dalam 7 hari.
- Exclusion: blacklist, opt-out, nomor invalid, atau tidak opt-in.

## 5. User Journey

### Journey Admin

1. Admin login ke dashboard RetailMind.
2. Admin membuka halaman `Campaigns`.
3. Sistem menampilkan kartu segmen, misalnya:
   - `At Risk`: 1.465 pelanggan.
   - `Can't Loose`: high CLTV dan inactive.
   - `High Value`: pelanggan bernilai tinggi.
4. Admin memilih segmen dan melihat preview audience:
   - jumlah pelanggan eligible,
   - estimasi biaya/pesan,
   - risiko spam,
   - sample 10 pelanggan.
5. Admin membuat campaign:
   - nama campaign,
   - goal,
   - promo atau non-promo,
   - CTA,
   - jadwal kirim,
   - batas penerima.
6. Sistem menghasilkan draft pesan dengan AI copywriter berdasarkan data segmen.
7. Admin mengedit dan menyetujui pesan.
8. Admin mengirim test message ke nomor internal.
9. Admin menekan `Approve & Schedule`.
10. Worker mengirim pesan bertahap via Fonnte.
11. Admin memantau status campaign:
    - queued,
    - sent,
    - delivered,
    - read jika tersedia,
    - failed,
    - opted out.
12. Setelah 7-30 hari, sistem menghitung conversion:
    - pelanggan kembali transaksi,
    - revenue campaign,
    - segment response rate.

### Journey Pelanggan

1. Pelanggan menerima pesan WhatsApp yang relevan dengan riwayat belanja.
2. Pelanggan klik link, membalas pesan, atau mengabaikan.
3. Jika pelanggan membalas `STOP`, `BERHENTI`, atau `UNSUBSCRIBE`, sistem memasukkan nomor ke blacklist.
4. Jika pelanggan belanja kembali, campaign job ditandai sebagai converted saat transaksi baru masuk ke pipeline.

## 6. Arsitektur Sistem

```text
React Dashboard
  -> Campaign API
  -> Segment Resolver
  -> Contact Eligibility Filter
  -> AI Copywriter
  -> Campaign Jobs
  -> Dispatch Worker
  -> Fonnte API
  -> Fonnte Status Webhook
  -> Campaign Analytics
  -> Feedback Loop To Model Evaluation
```

### Komponen

| Komponen | Tanggung Jawab |
| --- | --- |
| Campaign Dashboard | UI untuk membuat, preview, approve, dan monitor campaign. |
| Campaign API | CRUD campaign, trigger, pause, resume, cancel. |
| Segment Resolver | Query pelanggan berdasarkan `Segment`, `KMeansSegment`, `churn_risk_score`, dan CLTV. |
| Contact Filter | Validasi nomor, opt-in, blacklist, dan frequency cap. |
| AI Copywriter | Membuat pesan personal per segmen atau per pelanggan. |
| Dispatch Worker | Mengirim job ke Fonnte secara bertahap. |
| Fonnte Service | Wrapper API `https://api.fonnte.com/send`. |
| Status Webhook | Update status job berdasarkan callback Fonnte. |
| Analytics | Delivery rate, failure reason, opt-out, conversion, ROI. |

## 7. Detail Teknis Fonnte

### Endpoint send

Fonnte menggunakan endpoint:

```http
POST https://api.fonnte.com/send
Authorization: <FONNTE_TOKEN>
```

Header `Authorization` berisi token langsung, tanpa prefix `Bearer`.

Parameter penting:

| Parameter | Tipe | Catatan Implementasi |
| --- | --- | --- |
| `target` | string | Nomor target, comma-separated untuk multi-target. |
| `message` | string | Isi pesan teks. Mendukung variable jika target memakai format variable. |
| `delay` | string | Delay tetap atau random range, misalnya `5` atau `5-20`. Tetap gunakan throttle internal. |
| `typing` | boolean | Menampilkan typing indicator. Gunakan `true` untuk pesan campaign. |
| `countryCode` | string | Default Indonesia `62`. Gunakan `0` jika nomor sudah full international format. |
| `schedule` | int | Unix timestamp untuk jadwal kirim di sisi Fonnte. |
| `data` | string | JSON string untuk batch request dengan pesan berbeda per target. |
| `sequence` | boolean | Menjaga urutan request jika urutan pesan penting. |
| `preview` | boolean | Atur link preview. Gunakan `false` untuk link unik/tracking. |
| `connectOnly` | boolean | Jika `true`, request ditolak saat device disconnected. |

Response sukses berisi `status: true`, `id`, `target`, `process`, `detail`, dan `requestid`. Simpan `id` per target sebagai `fonnte_message_id` karena webhook status mengacu ke ID tersebut.

### Single send wrapper

```javascript
export async function sendWhatsAppMessage({ target, message }) {
  const form = new FormData();
  form.append("target", target);
  form.append("message", message);
  form.append("typing", "true");
  form.append("delay", "5-20");
  form.append("countryCode", "0");
  form.append("preview", "false");
  form.append("connectOnly", "true");

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: process.env.FONNTE_TOKEN },
    body: form,
  });

  const result = await response.json();
  if (!result.status) {
    throw new Error(result.reason || result.detail || "Fonnte send failed");
  }

  return result;
}
```

### Batch personal message

Untuk pesan berbeda per pelanggan, gunakan parameter `data` sebagai JSON string. Ini lebih cocok untuk campaign personal dibanding satu `message` untuk banyak target.

```javascript
export async function sendWhatsAppBatch(jobs) {
  const payload = jobs.map((job, index) => ({
    target: job.phone,
    message: job.generated_message,
    delay: index === 0 ? "0" : "5-20",
    typing: true,
    countryCode: "0",
    preview: false,
  }));

  const form = new FormData();
  form.append("data", JSON.stringify(payload));

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: process.env.FONNTE_TOKEN },
    body: form,
  });

  return response.json();
}
```

### Status webhook

Fonnte status webhook mengirim data seperti:

```json
{
  "device": "6281234567890",
  "id": "80367170",
  "stateid": "abc123",
  "status": "sent",
  "state": "delivered"
}
```

Mapper internal:

```javascript
const FONNTE_STATUS_MAP = {
  sent: "sent",
  processing: "queued",
  pending: "queued",
  waiting: "scheduled",
  invalid: "failed",
  failed: "failed",
  expired: "failed",
};

const FONNTE_STATE_MAP = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};
```

Webhook endpoint internal:

```http
POST /api/webhooks/fonnte/message-status
```

Handler harus mencari `campaign_jobs` berdasarkan `fonnte_message_id = payload.id`, lalu update status, state, dan timestamp.

## 8. Data Model Campaign

### campaigns

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment_filter JSONB NOT NULL,
  goal TEXT NOT NULL,
  campaign_brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### campaign_jobs

```sql
CREATE TABLE campaign_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  customer_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  display_name TEXT,
  segment_snapshot JSONB NOT NULL,
  generated_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  fonnte_message_id TEXT,
  fonnte_request_id TEXT,
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### broadcast_blacklist

```sql
CREATE TABLE broadcast_blacklist (
  phone TEXT PRIMARY KEY,
  customer_id TEXT,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  blacklisted_at TIMESTAMPTZ DEFAULT NOW()
);
```

### broadcast_conversions

```sql
CREATE TABLE broadcast_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  campaign_job_id UUID REFERENCES campaign_jobs(id),
  customer_id TEXT NOT NULL,
  conversion_type TEXT NOT NULL,
  revenue NUMERIC,
  converted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 9. API Internal

```http
GET    /api/segments
GET    /api/segments/:segmentId/preview
POST   /api/campaigns
GET    /api/campaigns
GET    /api/campaigns/:id
PATCH  /api/campaigns/:id
POST   /api/campaigns/:id/generate
POST   /api/campaigns/:id/test-send
POST   /api/campaigns/:id/approve
POST   /api/campaigns/:id/trigger
POST   /api/campaigns/:id/pause
POST   /api/campaigns/:id/resume
POST   /api/campaigns/:id/cancel
GET    /api/campaigns/:id/jobs
POST   /api/webhooks/fonnte/message-status
POST   /api/webhooks/fonnte/inbound
```

### Segment preview response

```json
{
  "segmentId": "win_back_priority",
  "label": "Win-back Priority",
  "totalModelMatches": 284,
  "eligibleContacts": 196,
  "excluded": {
    "missingPhone": 45,
    "notOptedIn": 31,
    "blacklisted": 4,
    "frequencyCapped": 8
  },
  "sample": [
    {
      "customerId": "12346.0",
      "displayName": "Customer 12346",
      "phoneMasked": "62812****789",
      "segment": "Can't Loose",
      "churnRiskScore": 80.47,
      "cltv6Months": 10150.62,
      "recommendedAction": "Win-back Priority"
    }
  ]
}
```

## 10. AI Copywriter

AI copywriter boleh berjalan per segment untuk MVP, lalu per customer untuk versi lanjutan.

### MVP prompt per segment

```text
Kamu adalah copywriter WhatsApp untuk retail Indonesia.
Buat pesan untuk segmen {segment_label}.

Konteks segment:
- Jumlah pelanggan: {eligible_count}
- Rata-rata churn risk: {avg_churn_risk}
- Rata-rata recency: {avg_recency} hari
- Rata-rata CLTV 6 bulan: {avg_cltv}
- Recommended action: {recommended_action}

Campaign:
- Goal: {goal}
- Promo: {promo}
- CTA: {cta}
- Brand tone: hangat, jelas, tidak spam.

Aturan:
- Bahasa Indonesia natural.
- Maksimal 500 karakter.
- Maksimal 3 emoji.
- Jangan klaim diskon jika tidak ada di campaign.
- Sertakan opt-out lembut: "Balas STOP jika tidak ingin menerima info promo."
```

### Personalization token

Gunakan token aman:

- `{name}`
- `{favorite_category}`
- `{last_purchase_days}`
- `{cta_link}`

Jangan memasukkan data sensitif seperti nilai transaksi detail atau skor churn secara eksplisit ke pesan pelanggan.

## 11. Dispatch Strategy

### MVP: polling worker tanpa Redis

Cocok untuk 50-500 target per campaign.

- Worker berjalan setiap 30 detik.
- Ambil maksimal 5-10 job status `pending`.
- Generate pesan jika belum ada.
- Kirim via Fonnte.
- Delay internal 8-20 detik antar job.
- Stop jika campaign `paused`, `cancelled`, atau daily cap tercapai.

Pseudo-flow:

```text
processPendingJobs()
  load running campaigns
  for each campaign
    validate daily cap
    fetch pending jobs limit 10
    for each job
      ensure campaign still running
      generate message if empty
      send to Fonnte
      save fonnte id and status
      sleep random 8-20 seconds
```

### Production: BullMQ + Redis

Gunakan saat volume naik atau ada banyak campaign:

- Queue: `campaign-broadcast`.
- Concurrency: `1` per Fonnte device.
- Rate limiter: maksimal 5 pesan per 60 detik untuk awal.
- Retry: 3 attempts dengan exponential backoff.
- Scheduler: enqueue job sesuai `scheduled_at`.
- Pause/resume memakai status campaign di database.

## 12. Lifecycle Dan Status

### Campaign status

| Status | Arti |
| --- | --- |
| `draft` | Campaign dibuat tetapi belum approve. |
| `scheduled` | Sudah approve dan menunggu jadwal. |
| `running` | Worker boleh memproses job. |
| `paused` | Worker berhenti mengambil job baru. |
| `completed` | Semua job selesai atau failed final. |
| `cancelled` | Campaign dihentikan permanen. |

### Job status

| Status | Arti |
| --- | --- |
| `pending` | Job dibuat, belum diproses. |
| `generating` | Pesan sedang dibuat AI. |
| `queued` | Sudah dikirim ke Fonnte queue. |
| `sent` | Fonnte/WhatsApp menandai terkirim. |
| `delivered` | Pesan sampai ke penerima. |
| `read` | Pesan dibaca jika status tersedia. |
| `failed` | Nomor invalid, token error, device error, atau payload invalid. |
| `opted_out` | Pelanggan membalas opt-out. |

## 13. Compliance Dan Anti-Spam

Checklist wajib sebelum production:

- Hanya kirim ke pelanggan dengan `whatsapp_opt_in = true`.
- Simpan sumber opt-in, misalnya checkout form, membership form, atau manual consent.
- Tambahkan opt-out di pesan marketing.
- Proses kata opt-out: `STOP`, `BERHENTI`, `UNSUBSCRIBE`, `JANGAN KIRIM`.
- Jangan mengirim ke nomor yang sama lebih dari 1 kali per 7 hari.
- Batasi campaign awal ke 50-100 nomor internal/low-risk.
- Gunakan delay acak dan jangan menjalankan dua campaign besar pada device yang sama.
- Simpan semua request, response, dan webhook status untuk audit.
- Hindari klaim promo palsu atau urgensi manipulatif.

## 14. Environment Variables

```bash
FONNTE_TOKEN=
FONNTE_SEND_URL=https://api.fonnte.com/send
FONNTE_COUNTRY_CODE=0

BROADCAST_ENABLED=true
BROADCAST_DAILY_LIMIT=100
BROADCAST_BATCH_SIZE=10
BROADCAST_MIN_DELAY_SEC=8
BROADCAST_MAX_DELAY_SEC=20
BROADCAST_FREQUENCY_CAP_DAYS=7

COPYWRITER_PROVIDER=gemini
COPYWRITER_MODEL=gemini-2.0-flash
COPYWRITER_TEMPERATURE=0.75

REDIS_URL=
```

Default MVP gunakan `BROADCAST_DAILY_LIMIT=100`. Naikkan bertahap hanya setelah delivery rate stabil dan opt-out rendah.

## 15. Dashboard Yang Dibutuhkan

### Campaign list

Tampilkan:

- nama campaign,
- segmen,
- status,
- total audience,
- sent/delivered/failed,
- jadwal,
- created by.

### Create campaign

Input:

- segment filter,
- campaign goal,
- promo details,
- CTA link,
- max recipients,
- schedule,
- test number.

### Campaign detail

Tampilkan:

- progress bar,
- delivery rate,
- failure reason,
- opt-out count,
- sample generated message,
- job table,
- tombol pause/resume/cancel.

### Segment insight

Tampilkan:

- rata-rata churn risk,
- rata-rata recency,
- rata-rata CLTV,
- rekomendasi action,
- jumlah eligible setelah filter.

## 16. Rollout Plan

### Phase 0: Data readiness

- Tambahkan `customer_contacts`.
- Import nomor WhatsApp yang valid.
- Tandai opt-in.
- Tambahkan blacklist awal jika ada.

### Phase 1: Dry-run

- Buat campaign dari segmen `Win-back Priority`.
- Generate job tanpa kirim ke Fonnte.
- Validasi audience, pesan, dan frequency cap.

### Phase 2: Internal UAT

- Kirim ke 3-5 nomor internal.
- Validasi isi pesan, status Fonnte, webhook, dan dashboard.

### Phase 3: Limited pilot

- Kirim ke 50-100 pelanggan opted-in.
- Monitor failed rate, delivery rate, dan opt-out.
- Pause otomatis jika failed rate lebih dari 20 persen atau opt-out lebih dari 5 persen.

### Phase 4: Controlled production

- Jalankan maksimal 1 campaign aktif per device.
- Evaluasi hasil per 7 hari.
- Masukkan conversion ke feedback loop 30 hari.

## 17. Test Plan

### Unit test

- Normalisasi nomor Indonesia dan internasional.
- Filter opt-in, blacklist, dan frequency cap.
- Mapping `Segment`, `KMeansSegment`, `CLTVSegment`, dan `RecommendedAction` ke campaign audience.
- Validasi panjang pesan AI dan forbidden claim.

### Integration test

- Mock Fonnte send response sukses dan gagal.
- Simpan `fonnte_message_id` ke `campaign_jobs`.
- Proses webhook status menjadi `sent`, `delivered`, `read`, atau `failed`.
- Test idempotency webhook agar payload dobel tidak merusak status.

### Manual UAT

- Dry-run campaign tidak mengirim pesan.
- Test send ke nomor admin.
- Pause campaign saat worker berjalan.
- Resume campaign dan pastikan hanya job pending yang diproses.
- Opt-out inbound memasukkan nomor ke blacklist.

## 18. Risiko Dan Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Nomor WhatsApp terkena limit atau blokir | Delay acak, daily cap kecil, opt-in, satu campaign per device. |
| Pesan dianggap spam | Review manual, segment-specific copy, opt-out jelas. |
| Data nomor tidak valid | Validasi format, test send internal, failed reason tracking. |
| Fonnte device disconnected | `connectOnly=true`, alert admin, retry terbatas. |
| Webhook duplikat | Handler idempotent berdasarkan `fonnte_message_id` dan timestamp. |
| Model segmentasi bias | Gunakan feedback conversion 30 hari, jangan treat churn score sebagai label absolut. |

## 19. Acceptance Criteria

Integrasi dinyatakan siap MVP jika:

- Admin dapat preview audience dari hasil segmentasi RetailMind.
- Sistem mengecualikan nomor tanpa opt-in, blacklist, dan nomor yang terkena frequency cap.
- Admin dapat generate, edit, approve, dan test-send pesan.
- Worker dapat mengirim campaign bertahap via Fonnte.
- `campaign_jobs` menyimpan response ID Fonnte.
- Webhook status memperbarui job.
- Dashboard menampilkan progress dan failure.
- Opt-out masuk blacklist.
- Dry-run tersedia dan tidak memanggil Fonnte.

## 20. Referensi

- Fonnte API send message: https://docs.fonnte.com/api-send-message/
- Fonnte webhook update message status: https://docs.fonnte.com/webhook-update-message-status/
- Fonnte message status: https://docs.fonnte.com/message-status/
- RetailMind campaign plan: `docs/PLAN.md`
- RetailMind WA planning draft: `docs/wa.md`
- RetailMind AI pipeline: `docs/pipeline_documentation.md`
