# 🧠 INFERENCE — Plan Implementasi Model RetailMind

> **Scope:** Strategi mengekspos model di `model/model/retail_ai_model_assets.joblib` dan skrip di `model/modelling/` sebagai **inference service** yang menerima dataset transaksi baru dari user, mengembalikan customer analytics yang diperkaya — **tanpa melatih ulang model di hot path**.
> **Owner:** ML / Backend
> **Status:** Draft v2 — revisi setelah keputusan arsitektur.
> **Last updated:** 2026-05-23

---

## 0. TL;DR

User journey yang ditargetkan:

```
User upload clean_transactions.csv
       ↓
Service agregasi → RFM
       ↓
Baseline model (frozen) → churn risk + cluster + CLTV
       ↓
Kalibrasi per-dataset (percentile threshold + population stats)
       ↓
Enriched customer analytics + explanation kontekstual
```

**Keputusan arsitektur:** baseline model **tidak pernah di-retrain di hot path**. Yang dihitung per-upload adalah **dataset profile** (~1 KB JSON: percentile threshold + mean/std RFM) yang dipakai untuk men-tier dan menjelaskan output. Retraining model adalah operasi **offline, manual, jarang** — bukan reaksi tiap upload.

Konsekuensi:

- Latency per upload: ratusan ms, bukan puluhan detik.
- Skor lintas dataset comparable (model identik).
- Cluster label ("High Value", "At Risk", dst.) stabil — dependency hilir di `segmentService.js` & copywriter prompt aman.
- Dataset kecil (puluhan customer) tetap bisa diproses — tidak ada minimum sample untuk fit model.

---

## 1. State of Model Saat Ini

### 1.1 Aset di repo

| Path | Isi | Ukuran |
|---|---|---|
| `model/model/retail_ai_model_assets.joblib` | Bundle joblib: `scaler`, `churn_model` (IsolationForest), `segmentation_model` (KMeans), `cltv_bgf_params`, `cltv_ggf_params`, `risk_score_params`, `metadata` | ~1 MB |
| `model/modelling/cltv_risk_model.ipynb` | Notebook training utama | ~1 MB |
| `model/modelling/rfm_cohort_analysis.ipynb` | Notebook EDA / cohort | ~388 KB |
| `model/modelling/test_inference.py` | Skrip ujicoba inference (loads joblib → score dummy CSV → output enriched CSV) | ~8 KB |
| `model/modelling/generate_dummy_data.py` | Generator data sintetis | ~7 KB |
| `model/data/clean_transactions.csv` | Transaksi bersih hasil training UCI Online Retail II (805K baris) | 75 MB |
| `model/data/dummy_clean_transactions.csv` | Transaksi sintetis untuk testing pipeline (451 baris, 30 customer) | 40 KB |
| `model/data/dummy_rfm_customers.csv` | RFM pre-computed sintetis (100 customer) — bypass aggregation | 4.5 KB |
| `model/data/enriched_customer_analytics.csv` | Output pre-computed yang di-seed ke SQLite | 850 KB |

### 1.2 Bug scaler (harus diperbaiki sebelum service go-live)

`backend/docs/dummy_data_guide.md` §3 mendokumentasikan bahwa variabel `scaler` di notebook training di-fit dua kali (raw lalu log) sebelum di-serialize, sehingga scaler tersimpan hanya valid untuk K-Means. Isolation Forest yang seharusnya pakai input raw-scaled jadi rusak.

`test_inference.py` mengakali dengan rekonstruksi `StandardScaler` mentah dari mean/var hardcoded:
```python
raw_scaler.mean_  = np.array([201.331915617557, 6.289384144266758, 3018.6167366451173])
raw_scaler.scale_ = np.array([209.32089900492423, 13.008299216842431, 14736.47735182636])
```

Hack ini harus diangkat ke joblib v2 (lihat §8). Selama bug masih ada, semua konsumen joblib harus copy-paste angka di atas — rapuh.

### 1.3 Output schema yang dihasilkan inference

Untuk setiap customer:

| Kolom | Sumber | Catatan |
|---|---|---|
| `customer_id`, `Recency`, `Frequency`, `Monetary` | RFM aggregation | Input |
| `anomaly_label`, `anomaly_score` | Isolation Forest | -1 = anomali |
| `churn_risk_score` | Derivatif (0–100) | Inverted dari `decision_function` |
| `churn_risk_level` | Derivatif | CRITICAL / HIGH / MEDIUM / LOW |
| `KMeansCluster`, `KMeansSegment` | K-Means | 4 cluster: High Value, Hibernating, At Risk, New/Occasional |
| `cltv_6_months` | BG-NBD + Gamma-Gamma | Horizon 6 bulan |
| `CLTVSegment` | **Quartile binning per-dataset** | A/B/C/D/Unknown |
| `RecommendedAction` | Rule-based | Win-back Priority / Loyalty Maintenance / Low-cost Automation / Onboarding Campaign / Standard Nurture |
| `explanation` | Template **kontekstual** | Pakai stats dari dataset profile, bukan stats UCI |

Skema ini selaras dengan tabel `customer_segments` di `backend/frontend/src/db/database.js`. Itu jadi target persistensi yang natural.

---

## 2. Mengapa Tidak Retrain Tiap Upload

Untuk konteks penuh kenapa retrain ditolak sebagai default mode, lihat ringkasan trade-off:

| Aspek | Retrain tiap upload | **Baseline + kalibrasi per-dataset** ⭐ |
|---|---|---|
| Latency upload | 5–30 detik (fit BG-NBD + KMeans) | <500 ms (scoring + percentile) |
| Min dataset size | ~500 customer (KMeans stabil) | 1 customer (untuk scoring); 30 untuk tier A/B/C/D |
| Skor comparable lintas upload | Tidak (model berubah) | Ya |
| Cluster label stabil | Tidak — KMeans cluster 0 bisa = "High Value" hari ini, "Hibernating" besok | Ya (model frozen) |
| Tier A/B/C/D relevan untuk dataset user | Ya | Ya (dari percentile dataset) |
| Storage per upload | 1 MB joblib | ~1 KB JSON profile |
| Reproducibility | Buruk | Bagus (model deterministik) |
| Risiko regresi | Tinggi (overfit ke dataset kecil) | Tidak ada |
| Dependency hilir (`segmentService`, copywriter) | Bisa rusak (label tertukar) | Aman |

Bottom line: **bentuk model** (Isolation Forest, KMeans 4-cluster, BG-NBD) bersifat universal untuk RFM. **Yang dataset-spesifik** hanya threshold dan stats untuk interpretasi. Sehingga refresh layer interpretasi sudah cukup — tidak perlu refit model.

Retrain tetap ada di toolkit (lihat §8.4) sebagai operasi offline untuk maintainer ML, bukan untuk user.

---

## 3. Pilihan Arsitektur Compute

Ada empat opsi serius. Saya rekomendasikan **Opsi B (Python microservice)**.

### Opsi A — Embed Python lewat `child_process`

Server Node.js spawn `python score.py` per request.

- ✅ Tidak perlu service tambahan.
- ❌ Cold start 2–5 detik per panggilan (load joblib).
- ❌ Tidak ada cache model state antar panggilan.

**Verdict:** hanya cocok untuk CLI ad-hoc, bukan production.

### Opsi B — Python microservice (FastAPI) ⭐ direkomendasikan

Service Python berdiri di port `:8000`, expose HTTP. Node.js panggil via `fetch`.

- ✅ Joblib dimuat sekali, dipakai banyak request.
- ✅ `lifetimes` + sklearn jalan native.
- ✅ Bisa di-containerize terpisah, scale independen.
- ❌ Tambah satu service untuk dijaga.

**Verdict:** trade-off paling masuk akal untuk RetailMind.

### Opsi C — Convert ke ONNX, jalankan di Node

- ❌ `lifetimes.BetaGeoFitter` + `GammaGammaFitter` tidak ter-support ONNX. CLTV jadi blocker.

### Opsi D — Port semua model ke pure JS

- ❌ BG-NBD MLE + Gamma-Gamma reimplementation di JS = berbulan-bulan kerja, risiko drift.

---

## 4. Arsitektur Target

```
┌──────────────────────────────────────────────────────────────────┐
│                   RetailMind Topology                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   React Dashboard (5173)                                          │
│        │ HTTP                                                      │
│        ▼                                                           │
│   Node.js API (backend/, :3001)                                    │
│        │                                                           │
│        ├──► PostgreSQL (:5432)   (lihat PLANREFACTOR.md)          │
│        │      ├─ customer_segments                                │
│        │      ├─ datasets              ◄── NEW                    │
│        │      └─ dataset_profiles      ◄── NEW                    │
│        │                                                           │
│        └──► Inference Service (Python FastAPI, :8000) ◄── NEW     │
│                  │                                                 │
│                  ├─ loads retail_ai_model_assets.joblib (once)    │
│                  ├─ POST /score/from-transactions                 │
│                  ├─ POST /score/from-rfm                          │
│                  ├─ POST /calibrate                               │
│                  ├─ GET  /health, /metrics                        │
│                  └─ NO training endpoints (offline only)          │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 Layout direktori baru

```
backend/
├── model/
│   ├── retail_ai_model_assets.joblib     # baseline frozen, tidak ditimpa di runtime
│   └── MODEL_CARD.md                      # baru — ringkasan model & metadata
├── modelling/
│   ├── cltv_risk_model.ipynb
│   ├── rfm_cohort_analysis.ipynb
│   ├── generate_dummy_data.py
│   ├── test_inference.py
│   ├── train_pipeline.py                 # baru — script retrain offline (manual)
│   └── retrain.sh                        # baru — runbook retrain bulanan
└── inference/                             # baru
    ├── app.py                             # FastAPI app
    ├── predictor.py                       # Predictor class (load joblib once)
    ├── rfm.py                             # baru — RFM aggregation dari transaksi
    ├── calibration.py                     # baru — dataset profile builder
    ├── recommendations.py                 # rule-based action + explanation
    ├── schemas.py                         # Pydantic input/output
    ├── config.py
    ├── tests/
    │   ├── test_predictor.py
    │   ├── test_rfm.py
    │   ├── test_calibration.py
    │   └── test_api.py
    ├── pyproject.toml
    └── Dockerfile
```

### 4.2 Component responsibilities

| Komponen | Tanggung jawab | Output |
|---|---|---|
| `rfm.py` | Bersihkan transaksi + agregasi per customer | DataFrame Recency/Frequency/Monetary |
| `predictor.py` | Load baseline joblib sekali; scoring (anomaly, cluster, CLTV raw) | DataFrame skor mentah |
| `calibration.py` | Hitung percentile thresholds + RFM stats dari hasil scoring | DatasetProfile (~1 KB JSON) |
| `recommendations.py` | Apply rules untuk action + explanation kontekstual | string fields |
| `app.py` | HTTP routing & validation | JSON response |

Pemisahan ini penting: tiap modul punya unit test sendiri, dan urutan pipeline mudah di-trace.

---

## 5. Pipeline Transaksi → Enriched Analytics

### 5.1 RFM aggregation (`rfm.py`)

Input: DataFrame transaksi dengan kolom standar **identik** dengan `clean_transactions.csv`:

| Kolom | Tipe | Wajib |
|---|---|---|
| `Customer ID` | float/int/string | Ya |
| `Invoice` | string | Ya |
| `InvoiceDate` | datetime parseable | Ya |
| `Quantity` | int | Ya |
| `Price` | float | Ya |
| `TotalPrice` | float | Tidak (auto = Quantity × Price) |
| `Country` | string | Tidak (untuk dimensi) |

Logika sama dengan training (`backend/docs/pipeline_documentation.md` §2.1.2):

```python
def aggregate_rfm(transactions: pd.DataFrame, snapshot_date: pd.Timestamp | None = None) -> pd.DataFrame:
    df = transactions.copy()
    df = df.dropna(subset=["Customer ID"])
    df = df[~df["Invoice"].astype(str).str.startswith("C")]
    df = df[(df["Quantity"] > 0) & (df["Price"] > 0)]
    df["TotalPrice"] = df.get("TotalPrice", df["Quantity"] * df["Price"])
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])

    snapshot = snapshot_date or (df["InvoiceDate"].max() + pd.Timedelta(days=1))

    rfm = df.groupby("Customer ID").agg(
        Recency=("InvoiceDate", lambda x: (snapshot - x.max()).days),
        Frequency=("Invoice", "nunique"),
        Monetary=("TotalPrice", "sum"),
        Country=("Country", lambda x: x.mode().iat[0] if not x.mode().empty else None),
    ).reset_index()
    return rfm
```

Edge case: customer dengan `Frequency=1` tetap di-keep (CLTV BG-NBD akan return 0, di-handle dengan `Unknown` di `CLTVSegment`).

### 5.2 Baseline scoring (`predictor.py`)

Refactor `test_inference.py` jadi class yang load sekali, predict berkali-kali. Threshold dan population stats **dilepas** dari class — disuplai dari luar (calibration profile).

```python
# model/inference/predictor.py
import joblib, numpy as np, pandas as pd
from sklearn.preprocessing import StandardScaler
from lifetimes import BetaGeoFitter, GammaGammaFitter

CLUSTER_LABELS = {0: "High Value", 1: "Hibernating", 2: "At Risk", 3: "New/Occasional"}

class Predictor:
    """Frozen baseline scoring. Returns raw scores; NO tier binning."""

    def __init__(self, model_path: str):
        assets = joblib.load(model_path)
        self.log_scaler = assets["scaler"]
        self.iso_forest = assets["churn_model"]
        self.kmeans     = assets["segmentation_model"]

        self.bgf = BetaGeoFitter()
        self.bgf.params_ = assets["cltv_bgf_params"]
        self.ggf = GammaGammaFitter()
        self.ggf.params_ = assets["cltv_ggf_params"]

        self.min_score = assets["risk_score_params"]["min_score"]
        self.max_score = assets["risk_score_params"]["max_score"]
        self.metadata  = assets.get("metadata", {})

        self.raw_scaler = self._resolve_raw_scaler(assets)

    @staticmethod
    def _resolve_raw_scaler(assets):
        if "raw_scaler" in assets:
            return assets["raw_scaler"]                # joblib v2 (target)
        # Fallback hack untuk joblib v1 — rekonstruksi mean/var dari training UCI
        s = StandardScaler()
        s.mean_ = np.array([201.331915617557, 6.289384144266758, 3018.6167366451173])
        s.scale_ = np.array([209.32089900492423, 13.008299216842431, 14736.47735182636])
        s.var_   = s.scale_ ** 2
        s.n_features_in_ = 3
        return s

    def score(self, rfm: pd.DataFrame) -> pd.DataFrame:
        """Skor per-customer pakai baseline. Tidak melakukan tier/binning."""
        X = rfm[["Recency", "Frequency", "Monetary"]]

        # Churn risk
        x_raw = self.raw_scaler.transform(X)
        anomaly_scores = self.iso_forest.decision_function(x_raw)
        anomaly_labels = self.iso_forest.predict(x_raw)
        churn_risk = 100 * (1 - (anomaly_scores - self.min_score) / (self.max_score - self.min_score))
        churn_risk = np.clip(churn_risk, 0, 100)

        # KMeans
        x_log = self.log_scaler.transform(np.log(X + 1))
        cluster = self.kmeans.predict(x_log)

        # CLTV (raw, tanpa tier)
        cltv = self.ggf.customer_lifetime_value(
            self.bgf,
            (X["Frequency"] - 1).clip(lower=0),
            X["Recency"],
            X["Recency"] + 30 * X["Frequency"],
            (X["Monetary"] / X["Frequency"]).replace([np.inf, -np.inf], 0),
            time=6, discount_rate=0.01,
        ).fillna(0).clip(lower=0)

        out = rfm.copy()
        out["anomaly_label"]    = anomaly_labels
        out["anomaly_score"]    = anomaly_scores
        out["churn_risk_score"] = churn_risk
        out["KMeansCluster"]    = cluster
        out["KMeansSegment"]    = pd.Series(cluster).map(CLUSTER_LABELS).values
        out["cltv_6_months"]    = cltv
        return out
```

Penting: method `score()` mengembalikan churn_risk_score, cluster, dan cltv mentah. **Tier A/B/C/D dan churn_risk_level CRITICAL/HIGH/...** tidak dihitung di sini — itu tugas calibration layer.

### 5.3 Dataset profile / calibration (`calibration.py`)

Setelah scoring mentah, hitung profile dataset.

```python
# model/inference/calibration.py
import numpy as np, pandas as pd
from datetime import datetime, timezone

DEFAULT_CHURN_LEVELS = {"critical": 75, "high": 50, "medium": 25}  # baseline thresholds

def build_profile(scored: pd.DataFrame, dataset_id: str, model_version: str) -> dict:
    cltv = scored["cltv_6_months"]
    cltv_positive = cltv[cltv > 0]

    # Quartile thresholds CLTV — NaN-safe dengan fallback baseline UCI
    if len(cltv_positive) >= 8:
        q25, q50, q75 = np.percentile(cltv_positive, [25, 50, 75])
    else:
        q25, q50, q75 = 175.928, 439.131, 966.696   # fallback UCI

    return {
        "dataset_id": dataset_id,
        "model_version": model_version,
        "calibrated_at": datetime.now(timezone.utc).isoformat(),
        "n_customers": int(len(scored)),
        "rfm_stats": {
            "recency":   {"mean": float(scored["Recency"].mean()),   "std": float(scored["Recency"].std() or 0)},
            "frequency": {"mean": float(scored["Frequency"].mean()), "std": float(scored["Frequency"].std() or 0)},
            "monetary": {"mean": float(scored["Monetary"].mean()),  "std": float(scored["Monetary"].std() or 0)},
        },
        "cltv_thresholds": {"q25": float(q25), "q50": float(q50), "q75": float(q75)},
        "churn_levels": DEFAULT_CHURN_LEVELS,        # bisa di-override per tenant
        "cluster_distribution": (
            scored["KMeansSegment"].value_counts(normalize=True).round(3).to_dict()
        ),
    }


def apply_profile(scored: pd.DataFrame, profile: dict) -> pd.DataFrame:
    out = scored.copy()
    t = profile["cltv_thresholds"]

    out["CLTVSegment"] = np.select(
        [out["cltv_6_months"] >= t["q75"],
         out["cltv_6_months"] >= t["q50"],
         out["cltv_6_months"] >= t["q25"],
         out["cltv_6_months"] > 0],
        ["A", "B", "C", "D"],
        default="Unknown",
    )

    levels = profile["churn_levels"]
    out["churn_risk_level"] = np.select(
        [out["churn_risk_score"] >  levels["critical"],
         out["churn_risk_score"] >  levels["high"],
         out["churn_risk_score"] >  levels["medium"]],
        ["CRITICAL", "HIGH", "MEDIUM"],
        default="LOW",
    )
    return out
```

Karakteristik penting profile:

- **Deterministik:** input sama → profile sama.
- **Compact:** ~1 KB JSON, ringan disimpan ke Postgres.
- **Cacheable:** hash dari `(dataset_content_hash, model_version)` → kalau user upload dataset sama dua kali, reuse profile.
- **Decoupled:** model frozen tidak tahu profile ada. Calibration bisa di-tweak (ganti threshold scheme) tanpa retraining.

Fallback ke threshold UCI saat n < 8 menjaga supaya dataset super kecil tidak menghasilkan tier yang noisy.

### 5.4 Recommendation + Explanation kontekstual (`recommendations.py`)

Logic action sama dengan `test_inference.py`. Yang berubah: explanation pakai `profile.rfm_stats`, bukan konstanta UCI.

```python
def build_explanation(row, profile):
    rfm = profile["rfm_stats"]
    factors = []

    if row["Recency"] > rfm["recency"]["mean"] * 1.5:
        factors.append(
            f"Recency {int(row['Recency'])} hari, jauh di atas rata-rata dataset "
            f"({rfm['recency']['mean']:.0f} hari)."
        )
    elif row["Recency"] < rfm["recency"]["mean"] * 0.3:
        factors.append(f"Interaksi sangat baru ({int(row['Recency'])} hari).")

    if row["Frequency"] > rfm["frequency"]["mean"] * 2:
        factors.append(f"Frequency {int(row['Frequency'])}, di atas rata-rata dataset ({rfm['frequency']['mean']:.1f}).")
    elif row["Frequency"] <= 2:
        factors.append("Repeat purchase rendah.")

    if row["Monetary"] > rfm["monetary"]["mean"] * 2:
        factors.append(f"Spend {row['Monetary']:,.0f}, jauh di atas rata-rata dataset.")
    elif row["Monetary"] < rfm["monetary"]["mean"] * 0.2:
        factors.append(f"Spend rendah ({row['Monetary']:,.0f}).")

    factors_str = " ".join(factors) if factors else "Pola aktivitas standar untuk dataset ini."
    return (
        f"Customer terkategori '{row['KMeansSegment']}' dengan churn risk "
        f"{row['churn_risk_level']} ({row['churn_risk_score']:.1f}/100) dan CLTV Tier "
        f"{row['CLTVSegment']}. Faktor utama: {factors_str} "
        f"Rekomendasi: {row['RecommendedAction']}."
    )
```

Beda kunci dari versi `test_inference.py`: stats reference dari **dataset user**, bukan hardcoded UCI 201.3 / 6.3 / 3018.6. Penjelasan jadi konsisten dengan apa yang user lihat di dashboard.

### 5.5 End-to-end flow di FastAPI

```python
# model/inference/app.py
@app.post("/score/from-transactions", response_model=ScoreResponse)
def score_from_transactions(req: TransactionsRequest):
    df_tx = pd.DataFrame([t.model_dump() for t in req.transactions])
    rfm   = aggregate_rfm(df_tx, snapshot_date=req.snapshot_date)

    if len(rfm) == 0:
        raise HTTPException(422, "No customers after cleaning")

    scored  = predictor.score(rfm)
    profile = build_profile(scored, dataset_id=req.dataset_id,
                            model_version=predictor.metadata.get("version", "unknown"))
    enriched = apply_profile(scored, profile)
    enriched["RecommendedAction"] = enriched.apply(build_action, axis=1)
    enriched["explanation"]       = enriched.apply(lambda r: build_explanation(r, profile), axis=1)

    return {
        "dataset_id": req.dataset_id,
        "profile": profile,
        "customers": enriched.to_dict(orient="records"),
    }
```

Endpoint kompanyon:

| Endpoint | Use case |
|---|---|
| `POST /score/from-transactions` | Path utama. Input transaksi → output enriched + profile. |
| `POST /score/from-rfm` | Untuk caller yang sudah punya RFM jadi (testing, integrasi pihak ke-3). |
| `POST /calibrate` | Hanya hitung profile, tidak return per-customer. Untuk preview/dry-run. |
| `POST /score/with-profile` | Pakai profile yang sudah ada (mis. profile bulan lalu) untuk skor batch baru. Opsional, untuk konsistensi tier antar bulan. |
| `GET /health` | Termasuk `model_version` & `model_metadata`. |
| `GET /metrics` | Prometheus exposition. |

---

## 6. Schema Kontrak (Pydantic)

```python
# model/inference/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class Transaction(BaseModel):
    customer_id: str = Field(..., alias="Customer ID")
    Invoice:     str
    InvoiceDate: datetime
    Quantity:    int
    Price:       float
    TotalPrice:  Optional[float] = None
    Country:     Optional[str] = None
    class Config: populate_by_name = True

class TransactionsRequest(BaseModel):
    dataset_id: str
    snapshot_date: Optional[datetime] = None     # default = max(InvoiceDate) + 1 day
    transactions: List[Transaction]

class CustomerRFM(BaseModel):
    customer_id: str = Field(..., alias="Customer ID")
    Recency:    int   = Field(..., ge=0)
    Frequency:  int   = Field(..., ge=1)
    Monetary:   float = Field(..., ge=0)
    Country:    Optional[str] = None
    class Config: populate_by_name = True

class RFMRequest(BaseModel):
    dataset_id: str
    customers: List[CustomerRFM]

class DatasetProfile(BaseModel):
    dataset_id: str
    model_version: str
    calibrated_at: datetime
    n_customers: int
    rfm_stats: Dict[str, Dict[str, float]]
    cltv_thresholds: Dict[str, float]
    churn_levels: Dict[str, float]
    cluster_distribution: Dict[str, float]

class EnrichedCustomer(BaseModel):
    customer_id: str
    Recency: int
    Frequency: int
    Monetary: float
    churn_risk_score: float
    churn_risk_level: str
    KMeansCluster: int
    KMeansSegment: str
    cltv_6_months: float
    CLTVSegment: str
    RecommendedAction: str
    explanation: str

class ScoreResponse(BaseModel):
    dataset_id: str
    profile: DatasetProfile
    customers: List[EnrichedCustomer]
```

Contoh request body `/score/from-transactions`:

```json
{
  "dataset_id": "demo_2026_05",
  "transactions": [
    {"Customer ID":"20001","Invoice":"500001","InvoiceDate":"2025-12-15T10:00:00Z","Quantity":2,"Price":12.5,"Country":"United Kingdom"},
    {"Customer ID":"20001","Invoice":"500002","InvoiceDate":"2026-01-05T11:00:00Z","Quantity":1,"Price":4.95},
    {"Customer ID":"20002","Invoice":"500003","InvoiceDate":"2025-11-20T09:00:00Z","Quantity":5,"Price":1.65}
  ]
}
```

---

## 7. Integrasi dari Node.js

### 7.1 Tabel Postgres (komplemen ke `PLANREFACTOR.md`)

```sql
-- 0002_inference.sql
CREATE TABLE datasets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  source        TEXT NOT NULL,                 -- 'upload' | 'seed' | 'api'
  content_hash  TEXT NOT NULL UNIQUE,          -- sha256 transaksi
  row_count     INTEGER NOT NULL,
  customer_count INTEGER NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by   TEXT
);

CREATE TABLE dataset_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id    UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  profile       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_id, model_version)
);

ALTER TABLE customer_segments
  ADD COLUMN dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL;

CREATE INDEX idx_customer_segments_dataset ON customer_segments(dataset_id);
```

Catatan:
- `customer_segments` tetap satu baris per `customer_id`. Kolom `dataset_id` mengikat baris ke dataset asalnya — kalau user upload dataset baru, baris diupdate dan `dataset_id` ikut berubah.
- Profile disimpan terpisah dari `customer_segments` supaya bisa di-load ringan untuk frontend (tampilkan threshold di tooltip, dll).

### 7.2 Node.js wrapper (`backend/frontend/src/services/inferenceService.js`)

```js
const INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:8000";

export async function scoreFromTransactions({ datasetId, transactions, snapshotDate }) {
  const r = await fetch(`${INFERENCE_URL}/score/from-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      snapshot_date: snapshotDate?.toISOString(),
      transactions,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Inference failed (${r.status}): ${err}`);
  }
  return r.json();
}

export async function inferenceHealth() {
  const r = await fetch(`${INFERENCE_URL}/health`, { signal: AbortSignal.timeout(2000) });
  if (!r.ok) throw new Error(`Inference unhealthy (${r.status})`);
  return r.json();
}
```

### 7.3 Endpoint user-facing baru

| Endpoint | Aksi |
|---|---|
| `POST /api/datasets` (multipart) | Terima upload CSV. Validasi schema (kolom). Hitung `content_hash`. Kalau hash sudah ada, return existing `dataset_id` (idempoten). Selain itu, parse → store metadata → return `dataset_id`. |
| `POST /api/datasets/:id/score` | Trigger scoring: ambil transaksi (dari blob storage atau in-memory cache), panggil inference, persist hasil ke `customer_segments` (UPSERT) + `dataset_profiles`. Sync (kecil) atau async via worker (besar). |
| `GET /api/datasets/:id` | Metadata + link ke profile. |
| `GET /api/datasets/:id/profile` | Profile JSON terbaru. Untuk dashboard tooltip. |
| `GET /api/datasets/:id/customers` | List enriched customers (paginated). |

### 7.4 User journey utuh

```
1. Admin di dashboard:
   [Upload clean_transactions.csv]
       ↓
2. Frontend → POST /api/datasets (multipart)
       ↓ (10–500 ms)
   ← { datasetId: "..." }
       ↓
3. Frontend → POST /api/datasets/:id/score
       ↓
   Node.js validasi → load transaksi → fetch ke
       ↓
   Python POST /score/from-transactions
       ↓ (100–800 ms untuk dataset ≤ 5K customer)
   Response: { profile, customers }
       ↓
   Node.js: UPSERT customer_segments (dengan dataset_id)
            INSERT dataset_profiles
       ↓
   ← { ok: true, profileSummary: {...} }
       ↓
4. Frontend redirect ke dashboard dataset:
   - Tampilkan tier distribution (dari profile.cluster_distribution)
   - Tampilkan top-N customer per segment
   - Tooltip "Threshold Tier A: ≥ Rp X" dari profile.cltv_thresholds.q75
```

Async variant untuk dataset besar (>10K customer) mengikuti pola yang sudah ada di `dispatchWorker.js`: insert job ke tabel `inference_jobs`, worker pick up, status diupdate.

### 7.5 Cache by content hash

`POST /api/datasets` menghitung sha256 dari transaksi → upsert ke `datasets` dengan UNIQUE constraint. Kalau user upload file yang sama dua kali, cuma satu row. `POST /api/datasets/:id/score` cek apakah sudah ada `dataset_profiles` untuk `(dataset_id, model_version)`; kalau ada, kembalikan tanpa panggil Python.

Hemat compute untuk demo berulang dan iterasi UI.

---

## 8. Lifecycle Baseline Model

### 8.1 Frozen by default

`retail_ai_model_assets.joblib` di-mount **read-only** ke container inference. Service tidak punya endpoint write. Satu-satunya jalur ganti model: deploy ulang container dengan file joblib baru.

### 8.2 Bug fix scaler (prerequisite go-live)

Sebelum service di-promote ke production, joblib harus diregenerasi v2 dengan scaler yang benar (lihat `backend/docs/dummy_data_guide.md` §3).

Langkah:
1. Buka `cltv_risk_model.ipynb`.
2. Pisahkan dua scaler:
   ```python
   raw_scaler = StandardScaler().fit(X)             # untuk Isolation Forest
   log_scaler = StandardScaler().fit(np.log(X+1))  # untuk K-Means
   ```
3. Latih ulang Isolation Forest pada `raw_scaler.transform(X)` (sebelumnya keliru pakai log). Verifikasi bahwa skor numerik tetap konsisten dengan output `test_inference.py` saat ini (yang sudah memakai workaround).
4. Export joblib v2:
   ```python
   joblib.dump({
       "raw_scaler":         raw_scaler,
       "log_scaler":         log_scaler,
       "scaler":             log_scaler,            # alias backward-compat
       "churn_model":        iso_forest,
       "segmentation_model": kmeans,
       "cltv_bgf_params":    bgf.params_,
       "cltv_ggf_params":    ggf.params_,
       "risk_score_params":  {"min_score": ..., "max_score": ...},
       "metadata": {
           "version":         "2.0.0",
           "trained_at":      datetime.utcnow().isoformat(),
           "training_rows":   len(X),
           "training_dataset": "UCI Online Retail II",
           "feature_means":   raw_scaler.mean_.tolist(),
           "feature_scales": raw_scaler.scale_.tolist(),
           "cluster_labels": {0: "High Value", 1: "Hibernating", 2: "At Risk", 3: "New/Occasional"},
       },
   }, "model/model/retail_ai_model_assets.joblib")
   ```
5. Jalankan ulang `test_inference.py` → bandingkan output dengan baseline. Skor numerik harus persis sama (workaround sebelumnya memang merefleksikan mean/var asli).
6. Hapus blok hardcoded `_resolve_raw_scaler` fallback di `predictor.py` setelah dua sprint stabil.

### 8.3 Versioning

| Aspek | Strategi |
|---|---|
| Model version | `metadata.version` di joblib. Service expose di `/health` dan menyimpannya di setiap `dataset_profile`. |
| Filename | Pertahankan `retail_ai_model_assets.joblib` (path stabil). Snapshot historis di `model/model/archive/v{X}_{YYYYMMDD}.joblib`. |
| Metadata stamp | Setiap row di `customer_segments` & `dataset_profiles` punya `model_version` — auditable. |

### 8.4 Kapan retrain offline boleh dilakukan

Retrain bukan reaksi atas upload user. Retrain dijadwalkan kalau:

- **Drift signifikan** terdeteksi: PSI (Population Stability Index) RFM baseline vs aggregate semua dataset terbaru > 0.25.
- **Cluster degradation:** distribusi cluster di-aggregate semua dataset menyimpang > 30% dari baseline.
- **Feedback bisnis:** rekomendasi action konsisten salah > 20% (butuh ground truth dari konversi campaign — future work).
- **Dataset training baru** (misalnya UCI 2026) tersedia dan stakeholder approve.

Pelaksanaan via `model/modelling/train_pipeline.py` (manual, di lingkungan training, bukan service):

```bash
python -m backend.modelling.train_pipeline \
    --transactions data/clean_transactions_2026.csv \
    --output model/model/retail_ai_model_assets.joblib \
    --version 3.0.0
```

Output joblib v3 di-deploy ke service via image rebuild. Profile dataset lama tetap valid (tapi tidak comparable dengan profile pasca-deploy karena `model_version` beda).

### 8.5 Tidak ada warm-start / fine-tune

Pertimbangkan pertanyaan "kenapa tidak warm-start KMeans dengan centroid baseline lalu fit di dataset baru?" — itu adalah retrain yang disamarkan, dengan semua kelemahan retrain (label drift, sample size kecil, output non-deterministik). Kalau benar-benar butuh model per-tenant, itu pekerjaan terpisah dengan governance khusus (out of scope).

---

## 9. Validasi Dataset Masuk

`POST /api/datasets` melakukan validasi bertahap. Kalau gagal, return `422 Unprocessable Entity` dengan reason yang spesifik.

| Lapis | Cek | Failure mode |
|---|---|---|
| Schema | Kolom wajib ada (Customer ID, Invoice, InvoiceDate, Quantity, Price) | "Missing required column: ..." |
| Tipe | InvoiceDate parseable, Quantity & Price numeric | "Invalid type at row N" |
| Sanity | Total row ≥ 10, customer count ≥ 5 | "Dataset too small for meaningful scoring" |
| Range tanggal | Span ≥ 30 hari (untuk CLTV BG-NBD reasonable) | Warning, bukan hard fail (CLTV akan banyak yang `Unknown`) |
| Outlier | Quantity > 0, Price > 0 sebanyak ≥ 80% baris | Warning |
| Duplikat | Hash transaksi exact-duplicate < 5% | Warning |

Validasi adalah **gate akses ke service Python**, bukan tugas service Python sendiri (Python tetap defensive tapi tidak duplikasi semua aturan).

---

## 10. Testing

### 10.1 Python (`model/inference/tests/`)

| Test | Cakupan |
|---|---|
| `test_predictor.py` | Load joblib snapshot. Score 5 persona dummy (Champion, At Risk, New, Hibernating, Normal). Assert range churn_risk ∈ [0,100], cluster ∈ {0..3}, cltv ≥ 0. |
| `test_predictor.py::test_regression` | Bandingkan output `Predictor.score()` dengan `test_inference.py` lama pada `dummy_rfm_customers.csv`. `pd.testing.assert_frame_equal(atol=1e-6)`. |
| `test_rfm.py` | Aggregasi `dummy_clean_transactions.csv` (30 customer, 451 transaksi) → cek count = 30, semua kolom RFM positif. |
| `test_calibration.py` | Profile dari dataset 100 customer → cek `cltv_thresholds` monotonic q25 < q50 < q75. Profile dari 5 customer → cek fallback ke threshold UCI. |
| `test_calibration.py::test_apply_profile` | `apply_profile` deterministic; CLTV 1000 dengan q75=900 → tier "A". |
| `test_recommendations.py` | Cover semua jalur decision matrix (`pipeline_documentation.md` §3.7). |
| `test_api.py` | `httpx.AsyncClient` + lifespan FastAPI. Cover `/score/from-transactions`, `/score/from-rfm`, `/calibrate`, `/health`, validasi 422. |

### 10.2 Node.js

- `inferenceService.test.js`: mock `fetch`, test happy path + timeout + 5xx.
- Integration: docker-compose up Python → upload `dummy_clean_transactions.csv` via `POST /api/datasets` → score → assert `customer_segments` punya 30 baris dengan `dataset_id` terisi.

### 10.3 End-to-end smoke

1. `python generate_dummy_data.py` → produces `dummy_clean_transactions.csv`.
2. Upload via dashboard.
3. Skor.
4. Cek dashboard menampilkan 30 customer dengan tier A/B/C/D bervariasi (bukan semua "Unknown").
5. Cek explanation menyebut stats dataset (mean recency, dst.), bukan stats UCI.

---

## 11. Deployment

### 11.1 Local dev

```yaml
# docker-compose.dev.yml (tambahan)
services:
  inference:
    build: ./backend/inference
    ports: ["8000:8000"]
    environment:
      MODEL_PATH: /app/model/retail_ai_model_assets.joblib
    volumes:
      - ./backend/model:/app/model:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
```

`Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

### 11.2 Production

- Deploy bersamaan dengan API Node.js (sidecar) atau service container terpisah (Cloud Run / ECS Fargate).
- Min instance 1 untuk hindari cold start. Resource: 1 vCPU, 1 GB RAM cukup untuk dataset ≤ 10K customer.
- Behind reverse proxy dengan rate limit (`/score/*` per-IP 30 rpm — scoring relatif mahal).
- Mount `model/model/` read-only.

### 11.3 Observability

- `/metrics`: histogram `score_duration_seconds{endpoint=...}`, counter `score_errors_total{type=...}`, gauge `model_version_info`.
- Log JSON: `{dataset_id, n_customers, model_version, duration_ms, request_id}`.
- Alert: error rate > 1% selama 5 menit; p95 latency `/score/from-transactions` > 2s.

---

## 12. Roadmap Eksekusi

### Sprint 1 (1 minggu) — Foundation
- [ ] Fix scaler bug → re-export joblib v2 dengan `raw_scaler` + `log_scaler` eksplisit.
- [ ] Verifikasi parity: output `test_inference.py` v1+hack vs v2 native identik.
- [ ] Tambah `MODEL_CARD.md` di `model/model/`.
- [ ] Convert notebook training jadi `train_pipeline.py` (CLI, untuk retrain offline).

### Sprint 2 (1 minggu) — Inference Service Core
- [ ] Skeleton `model/inference/` (FastAPI hello world).
- [ ] Implementasi `Predictor` class.
- [ ] Implementasi `rfm.py` aggregation.
- [ ] Implementasi `calibration.py` (build_profile + apply_profile).
- [ ] Implementasi `recommendations.py` (action + explanation kontekstual).
- [ ] Endpoints `/score/from-transactions`, `/score/from-rfm`, `/calibrate`, `/health`.
- [ ] Pydantic schemas + validasi.
- [ ] Unit test ≥ 80% coverage; regression test parity dengan `test_inference.py`.

### Sprint 3 (1 minggu) — Integrasi Node.js
- [ ] Migration Postgres `0002_inference.sql` (tabel `datasets`, `dataset_profiles`, kolom `customer_segments.dataset_id`).
- [ ] `backend/frontend/src/services/inferenceService.js` (Node client).
- [ ] Endpoints `POST /api/datasets`, `POST /api/datasets/:id/score`, `GET /api/datasets/:id/profile`, `GET /api/datasets/:id/customers`.
- [ ] Validasi schema CSV di `backend/frontend/src/services/datasetValidator.js`.
- [ ] Cache by content hash (idempoten upload).

### Sprint 4 (1 minggu) — Dashboard & Hardening
- [ ] Dashboard upload UI + tampilan profile.
- [ ] Dockerfile + docker-compose.
- [ ] Prometheus metrics + structured logging.
- [ ] CI workflow: build, test, smoke test stack.
- [ ] Run end-to-end dengan `dummy_clean_transactions.csv`.
- [ ] Dokumentasi runbook (deploy, retrain offline, troubleshooting).

Total: **4 minggu** kalender solo. Dapat dipersingkat ke 2–3 minggu kalau pair-up dan scaler bug sudah jadi sebelumnya.

---

## 13. Out of Scope

- **Retrain otomatis di hot path.** Sengaja dihindari (lihat §2 dan §8.5).
- **Online learning / streaming.** Saat ini batch + on-demand cukup.
- **A/B model serving.** Champion-challenger di `pipeline_documentation.md` Phase 2 — butuh routing layer.
- **Multi-tenant model per-tenant.** Single baseline global. Multi-tenant retrain butuh governance khusus.
- **SHAP explainability formal.** Saat ini explanation rule-based; SHAP per-prediksi mahal compute dan output sulit ditampilkan ringkas.
- **Personalisasi produk / rekomendasi SKU.** Roadmap di `PLANIMPROVEMENT.md`.
- **Drift detection otomatis.** Hanya manual / scheduled review dulu (§8.4).
- **Realtime under 50 ms.** Target sekarang p95 < 1s untuk dataset ≤ 5K customer.

---

## 14. Pertanyaan Terbuka

1. Apakah upload dataset disimpan persisten (S3/GCS) atau hanya in-memory selama request? Berdampak pada re-score capability.
2. Berapa retention `dataset_profiles`? Forever, atau auto-archive setelah N hari?
3. Apakah threshold UCI di-fallback masih relevan untuk pasar Indonesia, atau perlu fallback alternatif (mis. dari currency-adjusted)?
4. Apakah `customer_segments` boleh ditimpa antar upload (current design), atau perlu menyimpan history per-dataset untuk perbandingan time-series?
5. Bagaimana otorisasi multi-user? Saat ini single-tenant; kalau dataset milik admin A tidak boleh dilihat admin B, butuh tenant scoping di tabel `datasets`.
