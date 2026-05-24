# 09 — Roadmap, Risiko, dan Improvement

## Risiko Utama

### 1. Churn Risk adalah Proxy

Isolation Forest menghasilkan anomali RFM, bukan label churn aktual. Risiko: tim menganggap skor sebagai kebenaran absolut.

Mitigasi:

- tampilkan explanation dan confidence secara hati-hati,
- lakukan backtesting,
- gunakan feedback pembelian aktual setelah campaign.

### 2. Echo Chamber Pseudo-label

Melatih model supervised dari pseudo-label baseline dapat membuat model baru hanya meniru kelemahan baseline.

Mitigasi:

- champion-challenger shadow mode,
- evaluasi dengan outcome aktual,
- gunakan label dari perilaku customer setelah periode observasi.

### 3. WhatsApp Spam/Ban

Broadcast tanpa guardrail dapat dianggap spam atau melanggar aturan gateway.

Mitigasi:

- opt-in/opt-out,
- throttling,
- template approval untuk Cloud API,
- batch sending,
- monitoring complaint/reply.

### 4. Data Privacy

Nomor telepon dan transaksi adalah data sensitif.

Mitigasi:

- masking di UI/log,
- secret management,
- minimisasi data,
- access control.

## Roadmap Produk

### Phase 1 — MVP Stabil

- Rapikan dokumentasi ke `docs/`.
- Pastikan upload dataset → scoring → dashboard stabil.
- Demo blast aman dengan dry-run dan nomor representative.
- Health status model/inference jelas.

### Phase 2 — Campaign Production Readiness

- Queue batch yang lebih robust.
- Campaign monitoring lengkap.
- Retry/backoff/idempotency.
- Pause/cancel per batch.
- Audit log delivery dan webhook.
- Opt-out management.

### Phase 3 — AI Copy Multi-channel

- Structured JSON output untuk WhatsApp, Instagram, Email.
- Copy-to-clipboard Instagram.
- Email provider integration.
- Discount recommendation berbasis CLTV/ROI.

### Phase 4 — Model Evaluation & Feedback Loop

- Simpan event campaign, reply, dan conversion.
- Backtesting churn prediction.
- Precision@K untuk top risk.
- Champion-challenger model evaluation.
- Drift monitoring.

### Phase 5 — Production Platform

- Auth/role management.
- Tenant/account separation.
- Managed database.
- Secret manager.
- Observability.
- WhatsApp Cloud API migration jika volume naik.

## Backlog Teknis

- Replace root README template menjadi ringkasan RetailMind.
- Tambahkan test script untuk backend dan inference.
- Validasi CSV lebih informatif.
- Dokumentasikan schema database.
- Tambahkan sample request/response API.
- Tambahkan OpenAPI/Swagger untuk Express atau dokumentasi endpoint detail.

## Evaluasi Model yang Disarankan

| Evaluasi | Tujuan |
| --- | --- |
| Bootstrap stability | Cek ranking customer stabil di sampling berbeda. |
| Score distribution | Cek apakah skor memisahkan risiko rendah/tinggi. |
| Backtesting | Cek apakah high risk benar-benar tidak belanja di periode berikutnya. |
| Precision@K | Mengukur kualitas top K target win-back. |
| Champion-challenger | Bandingkan baseline vs model kandidat tanpa langsung mengganti produksi. |
