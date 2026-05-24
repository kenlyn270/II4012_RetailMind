# 🃏 Model Card — RetailMind Customer Analytics

## 1. Identitas Model
*   **Nama Model:** RetailMind Analytical Suite
*   **Versi:** 2.0.0
*   **Tanggal Export:** 2026-05-24
*   **Developer:** ML / RetailMind Team
*   **Status:** Frozen Baseline (Production Ready)

## 2. Arsitektur Model
Model ini adalah bundle aset `joblib` yang berisi beberapa komponen:

| Komponen | Library/Model | Fungsi |
|---|---|---|
| `raw_scaler` | `StandardScaler` | Scaling fitur RFM mentah (untuk Isolation Forest) |
| `log_scaler` | `StandardScaler` | Scaling fitur RFM log-transformed (untuk K-Means) |
| `churn_model` | `IsolationForest` | Deteksi anomali perilaku & scoring churn risk |
| `segmentation_model` | `KMeans` | Pengelompokan customer ke dalam 4 segmen bisnis |
| `cltv_bgf_params` | `BetaGeoFitter` | Parameter probabilitas retensi & frekuensi transaksi |
| `cltv_ggf_params` | `GammaGammaFitter` | Parameter prediksi monetary value masa depan |

## 3. Training Data
*   **Dataset:** UCI Online Retail II (Cleaned)
*   **Jumlah Baris Transaksi:** 805,549
*   **Jumlah Customer:** 5,878
*   **Snapshot Period:** 2009-12-01 s/d 2011-12-09

## 4. Metadata Fitur
*   **Fitur Utama:** `Recency`, `Frequency`, `Monetary`
*   **Normalisasi Churn Risk:**
    *   `min_score`: -0.428 (threshold training)
    *   `max_score`: 0.182 (threshold training)
*   **Cluster Labels:**
    *   0: `High Value`
    *   1: `Hibernating`
    *   2: `At Risk`
    *   3: `New/Occasional`

## 5. Changelog
*   **v1.0.0:** Initial release (Bug: scaler overwriting).
*   **v2.0.0:** Fix scaler bug. Ditambahkan `raw_scaler` dan `log_scaler` secara eksplisit. Ditambahkan metadata versi dan feature stats.

## 6. Penggunaan (Inference)
Gunakan `model/inference/predictor.py` untuk memuat aset ini. Jangan melakukan fit ulang (*retrain*) pada model ini di jalur distribusi aplikasi.
