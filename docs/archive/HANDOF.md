# HANDOF — Resume Konteks Sesi RetailMind

> Dokumen ini merangkum konteks kerja sesi ini agar sesi berikutnya bisa lanjut dengan cepat.
> Tanggal sesi: 2026-05-24

---

## 1. Tujuan Awal

User meminta dua dokumen planning:

1. `PLANREFACTOR.md` — rencana migrasi backend database ke PostgreSQL.
2. `INFERENCE.md` — rencana implementasi model dari `model/model/` dan `model/modelling/`.

Setelah diskusi, scope berkembang menjadi:

- Menyempurnakan konsep inference agar user bisa upload dataset baru berformat standar.
- Menetapkan bahwa retrain tiap upload tidak efisien.
- Mengubah rencana inference menjadi: **baseline frozen model + per-dataset calibration profile**, bukan retrain model di hot path.
- Memulai implementasi refactor backend server dari SQLite ke PostgreSQL.

---

## 2. Dokumen yang Dibuat / Diubah

### 2.1 `PLANREFACTOR.md`

Dibuat di root repo.

Isi utama:

- Audit database sekarang: SQLite via `better-sqlite3` di `backend/frontend/src/db/database.js`.
- Target PostgreSQL:
  - `UUID`
  - `JSONB`
  - `BOOLEAN`
  - `TIMESTAMPTZ`
  - enum `campaign_status`, `campaign_job_status`
- Strategi migrasi bertahap:
  - DB pool wrapper
  - adapter / async service refactor
  - seed ulang
  - worker memakai `FOR UPDATE SKIP LOCKED`
- Risiko & mitigasi.
- Timeline migrasi.

### 2.2 `INFERENCE.md`

Awalnya dibuat dengan pendekatan inference service + kemungkinan retrain. Setelah diskusi, direwrite menjadi v2.

Keputusan utama versi akhir:

- **Tidak retrain model tiap upload.**
- Baseline model di `model/model/retail_ai_model_assets.joblib` dianggap frozen/read-only.
- User journey target:

```txt
User upload clean_transactions.csv
  -> RFM aggregation
  -> baseline model scoring
  -> per-dataset calibration profile
  -> enriched customer analytics
```

Komponen inference yang direncanakan:

- `model/inference/rfm.py`
- `model/inference/predictor.py`
- `model/inference/calibration.py`
- `model/inference/recommendations.py`
- `model/inference/app.py`

Endpoint yang direncanakan:

- `POST /score/from-transactions`
- `POST /score/from-rfm`
- `POST /calibrate`
- `POST /score/with-profile`
- `GET /health`
- `GET /metrics`

Tabel tambahan yang direncanakan untuk fase inference:

- `datasets`
- `dataset_profiles`
- tambahan kolom `customer_segments.dataset_id`

Catatan penting:

- Bug scaler di joblib masih harus difix sebelum inference service go-live.
- `test_inference.py` sekarang punya workaround scaler hardcoded; ini perlu diangkat ke joblib v2 dengan `raw_scaler` dan `log_scaler` eksplisit.

---

## 3. Keputusan Arsitektur Penting

### 3.1 Database

Backend server diputuskan pindah dari SQLite ke PostgreSQL.

Alasan:

- Worker dan webhook butuh concurrent writes.
- `campaigns.segment_filter` dan `campaign_jobs.segment_snapshot` lebih cocok jadi `JSONB`.
- Deployment lebih aman via managed Postgres.
- SQLite file tidak ideal untuk growth / multi-worker.

### 3.2 Inference

Retrain tiap upload dianggap tidak efisien karena:

- Dataset bisa kecil, misalnya `model/data/dummy_clean_transactions.csv` hanya 451 transaksi / 30 customer.
- KMeans k=4 dan BG-NBD tidak stabil untuk sample kecil.
- Cluster label bisa drift.
- Skor tidak comparable antar upload.
- UX akan lambat.

Metode yang direkomendasikan:

**Baseline frozen + calibration profile per dataset.**

Yang berubah per upload bukan model, tapi:

- CLTV percentile threshold per dataset.
- RFM mean/std per dataset.
- Cluster distribution per dataset.
- Explanation kontekstual berbasis stats dataset user.

---

## 4. Implementasi PostgreSQL yang Sudah Dilakukan

### 4.1 Dependency

Di `backend/package.json`:

- `better-sqlite3` dihapus.
- `pg` ditambahkan.

```json
"pg": "^8.21.0"
```

`backend/package-lock.json` ikut berubah.

### 4.2 Database layer

File utama yang direwrite:

```txt
backend/frontend/src/db/database.js
```

Sekarang:

- Import `dotenv/config`.
- Menggunakan `pg.Pool`.
- Membutuhkan `DATABASE_URL`.
- Export helper:
  - `query(text, params)`
  - `queryOne(text, params)`
  - `queryMany(text, params)`
  - `withTransaction(fn)`
  - `initDatabase()`
  - `closeDatabase()`

`initDatabase()` membuat schema PostgreSQL langsung dari aplikasi.

Schema target:

- `customer_contacts`
- `customer_segments`
- `campaigns`
- `campaign_jobs`
- `broadcast_blacklist`

Dengan:

- `JSONB` untuk `segment_filter` dan `segment_snapshot`
- `BOOLEAN` untuk `whatsapp_opt_in`
- `TIMESTAMPTZ` untuk timestamp
- `UUID` untuk campaign/job id
- enum status
- trigger `updated_at`
- indexes untuk campaign/job/segment query

### 4.3 Migration SQL eksplisit

Ditambahkan:

```txt
backend/frontend/src/db/migrations/0001_init_postgres.sql
```

Isinya sama dengan schema di `initDatabase()`. Ini bisa dipakai manual via `psql` atau nanti diadaptasi ke migration runner.

### 4.4 Seed PostgreSQL

File direwrite:

```txt
backend/frontend/src/db/seed.js
```

Sekarang:

- Tidak memakai `better-sqlite3`.
- Memakai `initDatabase()`, `withTransaction()`, `queryOne()`, `closeDatabase()`.
- Membaca:

```txt
model/data/enriched_customer_analytics.csv
```

- Upsert ke:
  - `customer_contacts`
  - `customer_segments`

Menggunakan PostgreSQL:

```sql
INSERT ... ON CONFLICT (...) DO UPDATE
```

### 4.5 Services refactor ke async PostgreSQL

File yang diubah:

```txt
backend/frontend/src/services/segmentService.js
backend/frontend/src/services/campaignService.js
backend/frontend/src/services/copywriterService.js
```

Perubahan utama:

- Semua akses `db.prepare().get()/.all()/.run()` diganti `await queryOne/queryMany`.
- Placeholder SQLite `?` diganti `$1`, `$2`, dst.
- Date SQLite `datetime('now')` diganti `NOW()`.
- `campaignService.approveCampaign()` memakai `withTransaction()`.
- `getAllCampaigns()` dan `getCampaignById()` memakai query agregasi PostgreSQL dengan `FILTER`.
- `segment_filter` dan `segment_snapshot` dinormalisasi agar response API tetap object walaupun dari Postgres sudah JSON.

### 4.6 Routes refactor ke async

File yang diubah:

```txt
backend/frontend/src/routes/campaigns.js
backend/frontend/src/routes/segments.js
backend/frontend/src/routes/webhooks.js
```

Perubahan:

- Handler yang memanggil service DB jadi `async`.
- Semua service calls di-`await`.
- Webhook opt-out menggunakan transaction PostgreSQL.
- Webhook message-status update memakai query PostgreSQL dan `NOW()`.

### 4.7 Worker refactor

File yang diubah:

```txt
backend/frontend/src/workers/dispatchWorker.js
```

Perubahan:

- Async PostgreSQL.
- Daily sent count via query PostgreSQL.
- Pickup job pending memakai atomic update:

```sql
FOR UPDATE SKIP LOCKED
```

Ini membuat worker aman kalau nanti ada lebih dari satu worker.

### 4.8 Server init

File:

```txt
backend/frontend/src/index.js
```

Perubahan:

```js
await initDatabase();
```

Karena init database sekarang async.

### 4.9 Environment

File:

```txt
backend/.env.example
```

Ditambahkan:

```env
DATABASE_URL=postgres://retailmind:retailmind@localhost:5432/retailmind
PG_POOL_MAX=10
```

`backend/.env` lokal juga ditambahkan nilai yang sama, tapi file itu ignored oleh git.

### 4.10 Docker Compose

Ditambahkan:

```txt
docker-compose.dev.yml
```

Service:

- `postgres:16-alpine`
- user/password/db: `retailmind`
- port `5432:5432`
- volume `retailmind_pg_data`

---

## 5. Validasi yang Sudah Dilakukan

### 5.1 Syntax check Node.js

Command yang dijalankan:

```bash
cd server
for f in frontend/src/index.js frontend/src/db/database.js frontend/src/db/seed.js frontend/src/routes/*.js frontend/src/services/*.js frontend/src/workers/*.js; do node --check "$f" || exit 1; done
```

Hasil: berhasil, tidak ada syntax error.

### 5.2 Cek sisa SQLite API

Command:

```bash
grep -R "better-sqlite3\|db\.prepare\|db\.transaction\|datetime('now')" -n backend/src backend/package.json --exclude-dir=node_modules
```

Hasil: tidak ada sisa referensi SQLite di source backend/package.

### 5.3 Belum bisa run integration full

Dicoba menjalankan Postgres via Docker:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

Gagal karena environment sesi tidak punya akses Docker socket:

```txt
permission denied while trying to connect to the docker API at unix:///var/run/docker.sock
```

Jadi belum bisa menjalankan:

```bash
cd server
npm run seed
npm run dev
```

terhadap PostgreSQL sungguhan dari environment ini.

---

## 6. Cara Melanjutkan / Smoke Test Manual

Di mesin dengan Docker permission:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cd server
npm run seed
npm run dev
```

Smoke test:

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/segments
curl http://localhost:3001/api/campaigns
```

Demo blast dry-run:

```bash
curl -X POST http://localhost:3001/api/campaigns/demo-blast \
  -H 'Content-Type: application/json' \
  -d '{"dryRun":true}'
```

Jika seed gagal, cek:

- Postgres container hidup.
- `backend/.env` punya `DATABASE_URL`.
- Port 5432 tidak bentrok.
- CSV `model/data/enriched_customer_analytics.csv` tersedia.

---

## 7. Status Git / File yang Berubah

Modified:

```txt
backend/.env.example
backend/package-lock.json
backend/package.json
backend/frontend/src/db/database.js
backend/frontend/src/db/seed.js
backend/frontend/src/index.js
backend/frontend/src/routes/campaigns.js
backend/frontend/src/routes/segments.js
backend/frontend/src/routes/webhooks.js
backend/frontend/src/services/campaignService.js
backend/frontend/src/services/copywriterService.js
backend/frontend/src/services/segmentService.js
backend/frontend/src/workers/dispatchWorker.js
```

Untracked / added:

```txt
PLANREFACTOR.md
INFERENCE.md
HANDOF.md
```

Juga ditambahkan:

```txt
docker-compose.dev.yml
backend/frontend/src/db/migrations/0001_init_postgres.sql
```

Catatan: `backend/.env` diubah lokal untuk menambahkan `DATABASE_URL`, tapi ignored oleh `.gitignore`.

---

## 8. Hal yang Perlu Diperhatikan di Sesi Berikutnya

### 8.1 Potential runtime validation

Karena belum bisa run Postgres integration, sesi berikutnya sebaiknya dimulai dengan menjalankan:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cd server
npm run seed
npm run dev
```

Lalu perbaiki kalau muncul error runtime SQL.

### 8.2 Campaign service detail

`getAllCampaigns()` dan `getCampaignById()` sekarang memakai lateral aggregate dan alias `"read"`. Perlu diuji langsung di PostgreSQL.

### 8.3 Seed CSV parser masih sederhana

`seed.js` masih memakai parser CSV sederhana `split(',')`, sama seperti versi lama. Karena file current tampaknya aman, ini belum diubah. Untuk robust production, sebaiknya pakai package CSV parser (`csv-parse`) nanti.

### 8.4 Migrate existing SQLite data belum dibuat

Implementasi saat ini memprioritaskan clean PostgreSQL + seed dari CSV. Belum ada script `migrate-from-sqlite.js`. Kalau perlu preserve campaign history dari `backend/data/retailmind.db`, buat script migrasi terpisah.

### 8.5 Fase inference belum diimplementasi

`INFERENCE.md` sudah siap sebagai rencana, tapi belum ada kode:

- `model/inference/`
- FastAPI service
- migration `0002_inference.sql`
- endpoint upload dataset di Node.js

Saran urutan setelah PostgreSQL smoke test hijau:

1. Buat migration `0002_inference.sql`:
   - `datasets`
   - `dataset_profiles`
   - `customer_segments.dataset_id`
2. Buat skeleton `model/inference/`.
3. Implement `rfm.py` dan test terhadap `model/data/dummy_clean_transactions.csv`.

---

## 9. Ringkasan Keputusan untuk Dilanjutkan

- Database: PostgreSQL only, no dual-driver.
- SQLite dependency sudah dihapus.
- App auto-init schema lewat `initDatabase()`, plus SQL migration file tersedia.
- Inference: baseline frozen + calibration profile; no retrain per upload.
- Retrain hanya offline/manual jika drift signifikan atau dataset training baru tersedia.
- Next immediate step: run Postgres smoke test di environment dengan Docker/Postgres aktif.
