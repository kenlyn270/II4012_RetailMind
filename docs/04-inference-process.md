# 04 — Inference Process dan Pipeline ML

## Lokasi Kode dan Artifact

```text
model/inference/app.py          FastAPI service
model/inference/rfm.py          Agregasi transaksi ke RFM
model/inference/predictor.py    Load model dan scoring
model/inference/calibration.py  Dataset profile dan tier calibration
model/inference/recommendations.py RecommendedAction + explanation
model/inference/schemas.py      Request/response schema
model/model/retail_ai_model_assets.joblib
model/model/MODEL_CARD.md
model/modelling/                Notebook/script training/testing
model/data/                     CSV raw, processed, dummy
```

## Model Suite

RetailMind memakai bundle model `joblib`:

| Komponen | Library/Model | Fungsi |
| --- | --- | --- |
| `raw_scaler` | `StandardScaler` | Scaling fitur RFM mentah untuk Isolation Forest. |
| `log_scaler` | `StandardScaler` | Scaling fitur RFM log-transformed untuk K-Means. |
| `churn_model` | `IsolationForest` | Skor anomali sebagai proxy churn risk. |
| `segmentation_model` | `KMeans` | Segmentasi 4 cluster bisnis. |
| `cltv_bgf_params` | `BetaGeoFitter` | Prediksi frekuensi transaksi. |
| `cltv_ggf_params` | `GammaGammaFitter` | Prediksi monetary value/CLTV. |

Model card baseline saat ini: `model/model/MODEL_CARD.md`, versi 2.0.0.

## Endpoint Inference

### `GET /health`

Mengembalikan status service dan metadata model.

### `POST /score/from-transactions`

Input: list transaksi. Flow:

```text
TransactionsRequest
  ↓
DataFrame
  ↓
aggregate_rfm()
  ↓
predictor.score(rfm)
  ↓
build_profile()
  ↓
apply_profile()
  ↓
build_action() + build_explanation()
  ↓
ScoreResponse
```

### `POST /score/from-rfm`

Input: customer RFM yang sudah precomputed. Flow sama, tetapi melewati agregasi transaksi.

### `POST /calibrate`

Dry-run untuk melihat dataset profile/tier tanpa enrichment penuh.

## Training/Data Pipeline Historis

Dataset utama historis adalah UCI Online Retail II:

- Raw file: `online_retail_II.csv`.
- Setelah cleaning: sekitar 805.549 transaksi valid.
- Customer unik: sekitar 5.878.
- Periode snapshot: 2009-12-01 s/d 2011-12-09.

Cleaning utama:

1. Drop missing `Customer ID`.
2. Remove invoice cancelled prefix `C`.
3. Filter `Quantity > 0` dan `Price > 0`.
4. Buat `TotalPrice = Quantity × Price`.

## RFM Feature Engineering

| Feature | Definisi |
| --- | --- |
| Recency | Hari sejak pembelian terakhir. |
| Frequency | Jumlah invoice/purchase distinct. |
| Monetary | Total spend customer. |

RFM juga dapat diberi score quintile 1–5 untuk rule-based segment seperti Champions, Loyal, At Risk, Hibernating, Lost, dan lain-lain.

## Churn Risk Scoring

- Model: `IsolationForest(contamination=0.05, random_state=42)`.
- Input: `Recency`, `Frequency`, `Monetary` mentah yang di-scale.
- Output model diubah menjadi skor 0–100.
- Interpretasi: skor lebih tinggi = risiko churn lebih tinggi.

Peringatan penting: churn risk ini adalah proxy unsupervised, bukan label churn ground truth. Jangan melatih supervi
￼
sed model langsung menggunakan pseudo-label ini tanpa backtesting/feedback aktual.

## K-Means Segmentation

- Input: RFM yang di-log transform `log(x + 1)` lalu scale.
- K optimal historis: 4.
- Label bisnis baseline:
  - `High Value`
  - `Hibernating`
  - `At Risk`
  - `New/Occasional`

## CLTV

- BG-NBD memprediksi expected purchase frequency.
- Gamma-Gamma memprediksi expected average monetary value.
- CLTV dikelompokkan ke tier A/B/C/D; customer yang tidak cukup data repeat dapat menjadi `Unknown`.

## Calibration dan Recommendation

Setelah scoring baseline, sistem membangun profile dataset:

- distribusi churn risk,
- segment mix,
- CLTV tier,
- thresholds yang relatif terhadap dataset yang diupload.

Lalu setiap customer diberi:

- `RecommendedAction`, misalnya Win-back, Loyalty Maintenance, Reactivation.
- `explanation`, penjelasan human-readable berdasarkan segment, risk, CLTV, dan driver RFM.

## Synthetic Test Data

Generator dummy data tersedia untuk validasi tanpa dataset besar/sensitif:

```bash
/home/ikhbar/miniconda3/envs/basicneeds/bin/python model/modelling/generate_dummy_data.py
/home/ikhbar/miniconda3/envs/basicneeds/bin/python model/modelling/test_inference.py
```

Output contoh:

- `model/data/dummy_rfm_customers.csv`
- `model/data/dummy_clean_transactions.csv`
- `model/data/dummy_enriched_customer_analytics.csv`

Persona synthetic mencakup Champions, At Risk, New, Hibernating, dan Normal.

## Validasi Model yang Disarankan

- **Stability/bootstrap:** skor/ranking tidak berubah drastis saat sampling data mirip.
- **Score distribution:** model mampu memisahkan ekstrem risiko rendah dan tinggi.
- **Backtesting:** prediksi akhir periode dibandingkan dengan pembelian aktual periode berikutnya.
- **Precision@K:** dari top K risk tertinggi, berapa yang benar-benar tidak kembali.
- **Champion-challenger:** jalankan model baseline dan kandidat secara shadow mode sebelum mengganti champion.
