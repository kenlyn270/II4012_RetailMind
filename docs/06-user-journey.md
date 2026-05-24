# 06 — User Journey

## Persona Utama

- **Admin/Owner retail:** ingin melihat kesehatan pelanggan dan menjalankan campaign.
- **Marketing operator:** ingin membuat pesan promosi per segment dan mengirim/monitor WhatsApp.
- **Data/AI operator:** ingin upload dataset dan memvalidasi hasil scoring.

## Journey 1 — Login dan Masuk Dashboard

```text
User buka aplikasi
  ↓
Landing page RetailMind
  ↓
Klik Login/Register
  ↓
Submit modal auth dummy
  ↓
Masuk dashboard
```

Catatan: auth saat ini hanya localStorage untuk MVP. Production perlu backend auth.

## Journey 2 — Customer Intelligence dari Dataset

```text
User masuk tab Intelligence
  ↓
Cek SystemStatusPanel
  ↓
Upload CSV transaksi/RFM
  ↓
Frontend kirim file ke /api/datasets/score-direct
  ↓
Backend validasi dataset
  ↓
Inference service melakukan scoring
  ↓
Dashboard menampilkan profile dan customer analytics
```

Output yang dilihat user:

- total customers,
- distribusi churn risk,
- segment breakdown,
- RFM map,
- daftar high-risk customer,
- rekomendasi tindakan per customer/segment.

## Journey 3 — Membaca Insight

User membaca insight dengan urutan praktis:

1. Lihat `StatsRow` untuk metrik ringkas.
2. Lihat `ChurnChart` untuk distribusi risiko.
3. Lihat `SegmentBreakdown` untuk ukuran segment.
4. Lihat `HighRiskTable` untuk prioritas tindakan.
5. Gunakan insight segment untuk campaign.

## Journey 4 — Membuat Campaign WhatsApp

```text
User buka tab Blasting Message
  ↓
Pilih target segment
  ↓
Isi goal/campaign brief/CTA/promo
  ↓
Generate preview copywriting AI
  ↓
Review/edit pesan
  ↓
Create campaign
  ↓
Approve campaign
  ↓
Trigger send
  ↓
Monitor delivery status
```

Status lifecycle campaign:

```text
Draft → Approved → Running → Completed
                 ↘ Paused/Cancelled/Failed
```

## Journey 5 — Demo Blast

Untuk demo aman, tersedia flow blast terbatas:

```text
User buka demo blast
  ↓
Sistem tampilkan 4 target segment dengan nomor masked
  ↓
AI generate 1 pesan per segment
  ↓
Jika dryRun=true atau token tidak ada: tidak kirim real
  ↓
Jika token valid dan dryRun=false: kirim ke 4 nomor demo
  ↓
Webhook menerima status
```

Tujuan demo blast adalah membuktikan integrasi AI copywriting + Fonnte webhook tanpa mengirim ke seluruh database pelanggan.

## Journey 6 — Feedback Loop Campaign

Flow yang diinginkan untuk tahap lanjutan:

```text
Campaign sent
  ↓
Webhook delivery/reply captured
  ↓
Customer purchase behavior after campaign observed
  ↓
Campaign effectiveness measured
  ↓
Labels/feedback used for model evaluation
  ↓
Better targeting and champion-challenger model selection
```

## Failure/Edge Cases

| Kondisi | Perilaku yang Diinginkan |
| --- | --- |
| Inference service down | UI menampilkan error/status unhealthy; upload ditolak dengan pesan jelas. |
| CSV format salah | Validator memberi detail kolom yang hilang/salah. |
| Gemini gagal | Pakai fallback template copywriting. |
| Fonnte token kosong | Dry-run mode. |
| Webhook gagal diterima | Job tetap punya status send attempt; status final bisa unknown/pending. |
| Campaign perlu dihentikan | User bisa pause/cancel sebelum batch berikutnya. |

## Prinsip UX

- Preview sebelum broadcast.
- Confirm modal untuk aksi irreversible.
- Mask nomor telepon.
- Tampilkan progress campaign dan error per recipient.
- Beri penjelasan kenapa customer/segment direkomendasikan tindakan tertentu.
