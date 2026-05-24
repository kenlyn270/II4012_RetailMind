# 🐘 PLANREFACTOR — Migrasi Database Backend ke PostgreSQL

> **Scope:** Migrasi storage layer RetailMind dari **SQLite (better-sqlite3)** ke **PostgreSQL**, tanpa mengubah kontrak API publik dan UX dashboard.
> **Owner:** Backend / Server (`server/`)
> **Status:** Draft — siap dieksekusi bertahap.
> **Last updated:** 2026-05-23

---

## 0. TL;DR

| Aspek | Sekarang | Target |
|---|---|---|
| Engine | SQLite (file `server/data/retailmind.db`) via `better-sqlite3` | PostgreSQL 16 (managed atau self-hosted) via `pg` (node-postgres) |
| API style | Synchronous (`db.prepare(...).run()`) | Asynchronous (`await pool.query(...)`) |
| Schema | `CREATE TABLE IF NOT EXISTS` di kode (`db/database.js`) | Versioned migrations (`db/migrations/*.sql`) |
| JSON | Disimpan sebagai `TEXT` lalu `JSON.parse` manual | Native `JSONB` |
| Boolean | `INTEGER` 0/1 | `BOOLEAN` |
| Timestamp | `TEXT DEFAULT (datetime('now'))` | `TIMESTAMPTZ DEFAULT NOW()` |
| Concurrency | WAL mode, single-writer | MVCC native, multi-writer |
| Seed | `node src/db/seed.js` (parse CSV → insert) | Sama, tapi pakai `COPY FROM` untuk dataset besar |

Migrasi ini **non-trivial** karena seluruh service layer (`campaignService.js`, `segmentService.js`, `copywriterService.js`, `dispatchWorker.js`, `routes/webhooks.js`) memakai pemanggilan sinkron `db.prepare().run()/get()/all()`. Strategi: lapisi DB dengan adapter async, lalu refactor pemanggil satu per satu.

---

## 1. Motivasi

Alasan keluar dari SQLite untuk RetailMind ke depan:

1. **Concurrent writes.** Dispatch worker (`dispatchWorker.js`) menulis `campaign_jobs` setiap pesan terkirim, bersamaan dengan webhook Fonnte yang mengupdate `status`/`delivered_at`/`read_at` dari pesan yang sama. SQLite dengan WAL masih single-writer per database; PostgreSQL menangani concurrency dengan MVCC tanpa blocking reader.
2. **JSON-native query.** `campaigns.segment_filter` dan `campaign_jobs.segment_snapshot` saat ini di-stringify manual. PostgreSQL `JSONB` memungkinkan indexing & query (`segment_filter->>'segmentId' = 'high_value'`) tanpa load+parse di Node.
3. **Skala data.** `enriched_customer_analytics.csv` saat ini ~5.878 customer. Dengan target produksi (multi-tenant, multi-channel di `PLANIMPROVEMENT.md`), tabel `campaign_jobs` bisa tumbuh ke jutaan baris. PostgreSQL punya partitioning, parallel query, dan tooling backup/restore yang lebih matang.
4. **Deployability.** SQLite file butuh persistent volume di setiap deployment. PostgreSQL bisa managed (Neon/Supabase/RDS) → operasional lebih ringan, ada PITR backup.
5. **Tooling ekosistem.** Migration tool (`node-pg-migrate`, `drizzle-kit`), connection pooling (`pg-pool`, PgBouncer), observability (`pg_stat_statements`), dan extension (`pgcrypto` untuk `gen_random_uuid()`, `pg_trgm` untuk fuzzy phone search) sudah siap pakai.

---

## 2. Inventaris Permukaan Database

Hasil audit kode di `server/src/`:

### 2.1 Tabel yang dipakai

| Tabel | DDL ada di | Dipakai oleh |
|---|---|---|
| `customer_contacts` | `db/database.js`, `db/seed.js` | `seed.js`, `segmentService.js`, `dispatchWorker.js`, `routes/webhooks.js` |
| `customer_segments` | `db/database.js`, `db/seed.js` | `seed.js`, `segmentService.js`, `copywriterService.js` |
| `campaigns` | `db/database.js` | `campaignService.js`, `routes/campaigns.js`, `dispatchWorker.js` |
| `campaign_jobs` | `db/database.js` | `campaignService.js`, `dispatchWorker.js`, `routes/webhooks.js` |
| `broadcast_blacklist` | `db/database.js` | `segmentService.js`, `routes/webhooks.js` |

### 2.2 Pola SQL yang harus diterjemahkan

| Pola SQLite | Padanan PostgreSQL |
|---|---|
| `INTEGER PRIMARY KEY` (boolean 0/1) untuk `whatsapp_opt_in` | `BOOLEAN` |
| `TEXT DEFAULT (datetime('now'))` | `TIMESTAMPTZ DEFAULT NOW()` |
| `INSERT OR REPLACE INTO ... VALUES (...)` | `INSERT INTO ... VALUES (...) ON CONFLICT (pk) DO UPDATE SET ...` |
| `INSERT OR IGNORE INTO ...` | `INSERT INTO ... ON CONFLICT DO NOTHING` |
| `?` placeholder | `$1, $2, ...` |
| `db.prepare(...).run/get/all` (sync) | `await pool.query(...)` (async) |
| `db.transaction(fn)(...)` | `await client.query('BEGIN'); ... COMMIT/ROLLBACK` (lewat helper `withTransaction`) |
| `datetime('now', '-5 minutes')` | `NOW() - INTERVAL '5 minutes'` |
| `datetime('now')` di filter `WHERE last_marketing_sent_at > '...'` (string ISO) | `> NOW() - INTERVAL '7 days'` (lebih bersih) |
| `JSON.parse(c.segment_filter)` di JS | Kembalian sudah otomatis sebagai object kalau kolom `JSONB` |
| `LIMIT ? OFFSET ?` | `LIMIT $1 OFFSET $2` |
| Composite stat: `SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent` | `COUNT(*) FILTER (WHERE status = 'sent')` (lebih ringkas) |

### 2.3 Hot spot yang sensitif terhadap perubahan API DB

- `getAllCampaigns()` & `getCampaignById()` di `campaignService.js` melakukan **N+1 query** (loop campaigns → query stats). Saat refactor ke async, pertahankan perilaku tapi pertimbangkan single query dengan `LEFT JOIN LATERAL` (lihat §6).
- `approveCampaign()` memakai `db.transaction(...)` untuk memasukkan banyak job sekaligus. Versi PG harus `BEGIN ... COMMIT` di satu connection (bukan dari pool round-robin).
- Worker `dispatchWorker.js` polling sinkron `getTodaySentCount()` setiap pesan. Setelah migrasi async, hindari sequential await yang membuat throughput drop; gunakan satu query `SELECT FOR UPDATE SKIP LOCKED` (lihat §7).

---

## 3. Skema Target PostgreSQL

Semua kolom diberi tipe presisi, default sentris-DB, dan index sesuai pola query yang sudah ada.

```sql
-- 0001_init.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ── customer_contacts ────────────────────────────────────────────────
CREATE TABLE customer_contacts (
  customer_id            TEXT PRIMARY KEY,
  phone                  TEXT NOT NULL,
  display_name           TEXT,
  whatsapp_opt_in        BOOLEAN     NOT NULL DEFAULT FALSE,
  opt_in_source          TEXT,
  opt_in_at              TIMESTAMPTZ,
  last_marketing_sent_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_customer_contacts_phone ON customer_contacts(phone);

-- ── customer_segments ────────────────────────────────────────────────
CREATE TABLE customer_segments (
  customer_id        TEXT PRIMARY KEY REFERENCES customer_contacts(customer_id) ON DELETE CASCADE,
  recency            INTEGER,
  frequency          INTEGER,
  monetary           NUMERIC(14,2),
  recency_score      SMALLINT,
  frequency_score    SMALLINT,
  monetary_score     SMALLINT,
  rf_score           SMALLINT,
  segment            TEXT,
  country            TEXT,
  anomaly_label      SMALLINT,
  anomaly_score      DOUBLE PRECISION,
  churn_risk_score   DOUBLE PRECISION,
  kmeans_cluster     SMALLINT,
  kmeans_segment     TEXT,
  cltv_6_months      NUMERIC(14,2),
  cltv_segment       TEXT,
  recommended_action TEXT
);
CREATE INDEX idx_customer_segments_segment        ON customer_segments(segment);
CREATE INDEX idx_customer_segments_kmeans         ON customer_segments(kmeans_segment);
CREATE INDEX idx_customer_segments_action         ON customer_segments(recommended_action);
CREATE INDEX idx_customer_segments_churn_risk     ON customer_segments(churn_risk_score);

-- ── campaigns ────────────────────────────────────────────────────────
CREATE TYPE campaign_status AS ENUM
  ('draft','scheduled','running','paused','completed','cancelled');

CREATE TABLE campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT            NOT NULL,
  segment_filter    JSONB           NOT NULL,
  goal              TEXT            NOT NULL,
  campaign_brief    TEXT            NOT NULL,
  message_template  TEXT,
  status            campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at      TIMESTAMPTZ,
  approved_at       TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaigns_status         ON campaigns(status);
CREATE INDEX idx_campaigns_segment_id     ON campaigns ((segment_filter->>'segmentId'));

-- ── campaign_jobs ────────────────────────────────────────────────────
CREATE TYPE campaign_job_status AS ENUM
  ('pending','generating','queued','sent','delivered','read','failed');

CREATE TABLE campaign_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL,
  phone               TEXT NOT NULL,
  display_name        TEXT,
  segment_snapshot    JSONB NOT NULL,
  generated_message   TEXT,
  status              campaign_job_status NOT NULL DEFAULT 'pending',
  fonnte_message_id   TEXT,
  fonnte_request_id   TEXT,
  error_message       TEXT,
  generated_at        TIMESTAMPTZ,
  queued_at           TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_campaign_jobs_campaign_id ON campaign_jobs(campaign_id);
CREATE INDEX idx_campaign_jobs_status      ON campaign_jobs(status);
CREATE INDEX idx_campaign_jobs_phone       ON campaign_jobs(phone);
CREATE INDEX idx_campaign_jobs_fonnte_id   ON campaign_jobs(fonnte_message_id);
-- Untuk worker: pickup pending per campaign cepat
CREATE INDEX idx_campaign_jobs_pending     ON campaign_jobs(campaign_id, created_at)
  WHERE status = 'pending';

-- ── broadcast_blacklist ──────────────────────────────────────────────
CREATE TABLE broadcast_blacklist (
  phone           TEXT PRIMARY KEY,
  customer_id     TEXT,
  reason          TEXT NOT NULL,
  source          TEXT NOT NULL,
  blacklisted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── auto-update updated_at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contacts_updated  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Catatan keputusan:**
- Pakai `UUID` untuk `campaigns.id` dan `campaign_jobs.id`. `uuid` Node yang sudah ada di service tetap kompatibel (`uuidv4()`), tapi untuk insert baru di SQL pure bisa pakai `gen_random_uuid()`.
- Pakai `ENUM` untuk status agar nilai liar tertolak di level DB. Trade-off: penambahan status butuh migration `ALTER TYPE ... ADD VALUE`. Alternatif: kolom `TEXT` + `CHECK` constraint.
- `JSONB` (bukan `JSON`) supaya bisa diindex dan diquery cepat.
- FK `campaign_jobs.campaign_id → campaigns(id)` dengan `ON DELETE CASCADE` agar cancel/delete bersih.

---

## 4. Strategi Migrasi (Bertahap)

Migrasi besar gampang tergelincir. Pendekatan yang dianjurkan: **lapisan abstraksi dulu, lalu swap engine, lalu refactor caller**.

### Fase A — Persiapan (tanpa downtime)

1. **Tambah dependency** di `server/package.json`:
   ```json
   "pg": "^8.13.0",
   "node-pg-migrate": "^7.6.1"   // dev
   ```
2. **Buat connection pool wrapper** baru `server/src/db/pool.js`:
   ```js
   import pg from "pg";
   const { Pool } = pg;
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: parseInt(process.env.PG_POOL_MAX) || 10,
     idleTimeoutMillis: 30_000,
   });
   export async function query(text, params) {
     return pool.query(text, params);
   }
   export async function withTransaction(fn) {
     const client = await pool.connect();
     try {
       await client.query("BEGIN");
       const result = await fn(client);
       await client.query("COMMIT");
       return result;
     } catch (err) {
       await client.query("ROLLBACK");
       throw err;
     } finally {
       client.release();
     }
   }
   export default pool;
   ```
3. **Buat folder migrations** `server/src/db/migrations/` dengan file `0001_init.sql` (skema dari §3).
4. **Tambah env** di `server/.env.example`:
   ```bash
   DATABASE_URL=postgres://retailmind:retailmind@localhost:5432/retailmind
   PG_POOL_MAX=10
   DB_DRIVER=sqlite        # sementara; akan di-flip ke 'postgres'
   ```
5. **Tambah service compose** untuk dev:
   ```yaml
   # docker-compose.dev.yml (baru)
   services:
     postgres:
       image: postgres:16-alpine
       ports: ["5432:5432"]
       environment:
         POSTGRES_USER: retailmind
         POSTGRES_PASSWORD: retailmind
         POSTGRES_DB: retailmind
       volumes:
         - pg_data:/var/lib/postgresql/data
   volumes: { pg_data: {} }
   ```

### Fase B — Adapter Pattern (dual-driver)

Bungkus akses DB di balik antarmuka tipis sehingga service layer tidak perlu tahu driver-nya.

`server/src/db/index.js`:
```js
import * as sqliteAdapter from "./adapters/sqliteAdapter.js";
import * as pgAdapter from "./adapters/pgAdapter.js";

const driver = process.env.DB_DRIVER === "postgres" ? pgAdapter : sqliteAdapter;
export const { query, queryOne, queryMany, withTransaction, init } = driver;
```

Konvensi:
- `query(text, params)` → array of rows.
- `queryOne(text, params)` → row pertama atau `null`.
- `withTransaction(fn)` → callback `(client) => Promise`.

> SQLite adapter tetap **synchronous** secara internal tapi **bungkus dengan `async`/`await`** sehingga signature seragam. Ini langkah kunci agar refactor caller bisa dilakukan **sekali**, bukan dua kali.

### Fase C — Refactor Caller ke async/await

Urutan PR (kecil-kecil supaya mudah review):

1. `routes/segments.js` + `services/segmentService.js` (baca-mostly, paling aman).
2. `services/copywriterService.js` (hanya `getSegmentStats`).
3. `routes/campaigns.js` + `services/campaignService.js` (banyak transaksi).
4. `workers/dispatchWorker.js` (paling kritikal — pakai `SELECT FOR UPDATE SKIP LOCKED`).
5. `routes/webhooks.js`.

Setiap PR:
- Tetap pakai `DB_DRIVER=sqlite`. Adapter sqlite tetap berjalan, jadi tidak ada regresi.
- Tambah test integrasi (lihat §8).

### Fase D — Data Migration + Cutover

1. **Sekali-jalan importer** `server/src/db/migrate-from-sqlite.js`:
   - Buka SQLite read-only.
   - Untuk tiap tabel: `SELECT *` → batch `INSERT ... ON CONFLICT DO UPDATE`.
   - Konversi tipe: `0/1` → `false/true`, ISO string → `TIMESTAMPTZ`, `TEXT JSON` → `JSONB::text::jsonb`.
   - Validasi: `SELECT COUNT(*)` di kedua sisi harus sama.
2. **Cutover**:
   - Set `BROADCAST_ENABLED=false` di env (worker mati).
   - Run importer.
   - Set `DB_DRIVER=postgres`. Restart server.
   - Smoke test: `/api/health`, list segments, list campaigns, send test message.
   - Set `BROADCAST_ENABLED=true`.
3. **Window:** ~30 menit. Karena demo blast hanya 4 nomor dan campaign kecil, downtime aman.

### Fase E — Cleanup

- Hapus `sqliteAdapter.js` dan dependency `better-sqlite3` setelah 1–2 minggu stabil.
- Hapus file `retailmind.db*` dari `.gitignore`/repo.
- Update `README` & dokumentasi setup.

---

## 5. Re-seeding di PostgreSQL

`server/src/db/seed.js` saat ini parse CSV + insert satu-satu. Untuk dataset besar (`enriched_customer_analytics.csv` 850 KB, atau `clean_transactions.csv` 75 MB), gunakan `COPY FROM`:

```js
// pseudocode pakai pg-copy-streams
import { from as copyFrom } from "pg-copy-streams";
import { createReadStream } from "fs";

await withTransaction(async (client) => {
  await client.query("TRUNCATE customer_segments CASCADE");
  const stream = client.query(copyFrom(`
    COPY customer_segments (
      customer_id, recency, frequency, monetary,
      recency_score, frequency_score, monetary_score, rf_score,
      segment, country, anomaly_label, anomaly_score,
      churn_risk_score, kmeans_cluster, kmeans_segment,
      cltv_6_months, cltv_segment, recommended_action
    ) FROM STDIN WITH (FORMAT csv, HEADER true)
  `));
  await pipeline(createReadStream(CSV_PATH), stream);
});
```

`customer_contacts` (phone palsu + display name palsu) tetap di-generate di Node seperti sekarang.

---

## 6. Contoh Konversi Query (Before → After)

### 6.1 Stats agregasi

**Sebelum** (`campaignService.js`):
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'sent'    THEN 1 ELSE 0 END) as sent,
  ...
FROM campaign_jobs WHERE campaign_id = ?
```

**Sesudah** (lebih ringkas):
```sql
SELECT
  COUNT(*)                                   AS total,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'sent')    AS sent,
  COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
  COUNT(*) FILTER (WHERE status = 'read')    AS "read",
  COUNT(*) FILTER (WHERE status = 'failed')  AS failed
FROM campaign_jobs WHERE campaign_id = $1
```

### 6.2 Upsert kontak (seed)

**Sebelum:**
```sql
INSERT OR REPLACE INTO customer_contacts (customer_id, phone, ...) VALUES (?, ?, ...)
```

**Sesudah:**
```sql
INSERT INTO customer_contacts (customer_id, phone, display_name, whatsapp_opt_in, opt_in_source, opt_in_at)
VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (customer_id) DO UPDATE SET
  phone           = EXCLUDED.phone,
  display_name    = EXCLUDED.display_name,
  whatsapp_opt_in = EXCLUDED.whatsapp_opt_in,
  opt_in_source   = EXCLUDED.opt_in_source,
  opt_in_at       = EXCLUDED.opt_in_at,
  updated_at      = NOW();
```

### 6.3 Frequency cap filter

**Sebelum** (string interpolation tanggal — riskan):
```js
const capDate = new Date(...).toISOString();
db.prepare(`... WHERE cc.last_marketing_sent_at > '${capDate}'`).all();
```

**Sesudah** (paramater + interval):
```sql
... WHERE cc.last_marketing_sent_at > NOW() - ($1 || ' days')::INTERVAL
```
```js
await query(sql, [String(frequencyCapDays)]);
```

### 6.4 Worker pickup (anti race condition)

**Sebelum** (`dispatchWorker.js`):
```sql
SELECT * FROM campaign_jobs
WHERE campaign_id = ? AND status = 'pending'
ORDER BY created_at ASC LIMIT ?
```
Kalau multiple worker berjalan, dua worker bisa ambil job yang sama.

**Sesudah** (atomic pickup, future-proof multi-worker):
```sql
UPDATE campaign_jobs
SET status = 'queued', queued_at = NOW()
WHERE id IN (
  SELECT id FROM campaign_jobs
  WHERE campaign_id = $1 AND status = 'pending'
  ORDER BY created_at ASC
  LIMIT $2
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

---

## 7. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kolom `TEXT JSON` di SQLite (e.g., `segment_snapshot`) tidak valid JSON saat migrasi | Insert ke `JSONB` gagal | Importer wraps dengan `try/catch` per baris; default ke `'{}'::jsonb` jika parse error, log row untuk audit |
| `INTEGER 0/1` jadi `BOOLEAN` | Service yang masih cek `=== 1` → bug logic | Adapter sqlite di Fase B sudah normalize boolean; lakukan grep `whatsapp_opt_in === 1` dan ganti ke `=== true` sebelum cutover |
| `datetime('now')` interpretasi UTC vs lokal | Frequency cap salah selisih jam | `TIMESTAMPTZ` selalu UTC; pastikan client (Node) juga pakai `new Date().toISOString()` ketika kirim explicit |
| Async I/O di worker bikin throughput drop karena delay seri | Lebih sedikit pesan terkirim per polling cycle | Pickup batch atomic (§6.4), sequential send tetap (rate limit Fonnte memang butuh delay), parallelize hanya status update via `Promise.all` |
| Connection pool exhaustion saat traffic spike | API timeout 503 | Set `max: 10` cukup untuk MVP; tambah monitoring `pool.totalCount` & `pool.idleCount` |
| Migration script dijalankan dua kali | Data dobel | Importer pakai `ON CONFLICT DO UPDATE`; idempoten by design |
| Test di CI tidak punya Postgres | PR gagal | GitHub Actions `services: postgres:16-alpine`, atau `pg-mem` untuk unit test ringan |
| Dashboard frontend bergantung respon `segment_filter` sebagai object | Saat sqlite, kita `JSON.parse` manual; di pg sudah object | Tetap object di response — tidak ada perubahan kontrak |
| Penghapusan `better-sqlite3` membuat pengembangan lokal butuh Postgres | Onboarding dev lebih ribet | Sediakan `docker-compose.dev.yml` + `npm run db:up`/`db:reset` |

---

## 8. Strategi Testing

1. **Unit test adapter** (`db/index.test.js`): pastikan `query`, `queryOne`, `withTransaction` mengembalikan bentuk konsisten antara sqlite & postgres.
2. **Integrasi service** (`*.integration.test.js`): jalankan terhadap Postgres ephemeral (Testcontainers atau service di CI). Test minimal:
   - `createCampaign` → `approveCampaign` → cek `campaign_jobs` count == eligible customers.
   - `processBatch()` worker → mock Fonnte → cek status transitions.
   - Webhook `message-status` → cek timestamp field terupdate.
3. **Migration test**: di CI, run `migrate-from-sqlite.js` terhadap `retailmind.db` snapshot, lalu `SELECT COUNT(*) FROM ...` cocok.
4. **Smoke test cutover** (manual checklist):
   - [ ] `GET /api/health` 200
   - [ ] `GET /api/segments` mengembalikan 4 segmen dengan count > 0
   - [ ] `POST /api/campaigns/demo-blast { dryRun: true }` 4 hasil ok
   - [ ] Worker logs: "Dispatch worker started"
   - [ ] `INSERT/UPDATE` real dari webhook callback Fonnte berhasil

---

## 9. Timeline Estimasi (Solo Engineer)

| Hari | Aktivitas |
|---|---|
| 1 | Fase A: tooling, pool wrapper, migration `0001_init.sql`, docker-compose |
| 2 | Fase B: adapter sqlite + adapter pg, switch via env |
| 3–4 | Fase C: refactor `segmentService` & `copywriterService` (read-mostly) |
| 5–6 | Fase C: refactor `campaignService` & route handlers |
| 7 | Fase C: refactor `dispatchWorker` (pakai `SKIP LOCKED`) + webhook |
| 8 | Fase D: importer + dry-run terhadap snapshot |
| 9 | Cutover + monitoring |
| 10 | Fase E: cleanup, hapus `better-sqlite3`, update README |

Total ~2 minggu kalender, asumsi tanpa interupsi besar.

---

## 10. Checklist Eksekusi

- [ ] Postgres dev container jalan (`docker compose up postgres`)
- [ ] `0001_init.sql` apply tanpa error
- [ ] `pool.js` + adapter pattern merged
- [ ] `seed.js` versi pg menggunakan `COPY FROM` jalan pada dataset enriched
- [ ] Semua service & route refactor ke async, test hijau
- [ ] Worker memakai `FOR UPDATE SKIP LOCKED`, tidak ada job yang dikerjakan dua kali
- [ ] `migrate-from-sqlite.js` terbukti idempoten (jalan dua kali, hasil sama)
- [ ] Smoke test pasca-cutover semua hijau
- [ ] `better-sqlite3` dihapus dari dependency
- [ ] README & `.env.example` di-update

---

## 11. Out of Scope (Future Work)

- Multi-tenant schema (saat ini single-tenant; nanti tambah `tenant_id` di setiap tabel).
- Read replica / connection routing (R/W split).
- Materialized view untuk dashboard agregat (`segment counts per hour`, `campaign delivery funnel`).
- Backup & restore policy production (PITR via Neon/Supabase).
- Row-level security untuk akses dashboard per role.
- Kompatibilitas Drizzle/Prisma ORM — saat ini stay raw SQL untuk kontrol penuh.
