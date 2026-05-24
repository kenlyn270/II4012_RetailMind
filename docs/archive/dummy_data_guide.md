# RetailMind Synthetic Test Data Guide

This guide details the synthetic test data generation framework developed to validate, test, and run model inference on the RetailMind customer analytics engine.

---

## 1. Overview of the Synthetic Data Framework

To support robust testing of the analytical pipeline without relying on massive, sensitive real-world datasets, we have created a dual-layer synthetic data generation system:

```
                  ┌──────────────────────────────────────────────┐
                  │          Synthetic Data Framework            │
                  └──────────────┬────────────────┬──────────────┘
                                 │                │
            ┌────────────────────┴───┐        ┌───┴────────────────────┐
            │ 1. Transactional Data  │        │ 2. Pre-computed RFM    │
            │ (dummy_clean_trans...) │        │ (dummy_rfm_custo...)   │
            └───────────┬────────────┘        └───────────┬────────────┘
                        │                                 │
                        ▼                                 ▼
            Tests end-to-end pipeline              Tests inference layer
            (Data Clean → RFM → ML)               directly (joblib models)
```

1. **Transactional Test Data (`dummy_clean_transactions.csv`):**
   A synthetic transactional ledger containing **451 records** across **30 synthetic customers** spanning a 2-year timeline. It mirrors the exact schema of `clean_transactions.csv` and is perfect for validating raw preprocessing, RFM aggregation, and cohort tracking.
2. **Pre-computed RFM Profiles (`dummy_rfm_customers.csv`):**
   A list of **100 synthetic customer records** pre-populated with highly realistic `Recency`, `Frequency`, and `Monetary` values distributed across standard retail customer personas.

---

## 2. Customer Persona Distributions

To ensure that the generated data yields distinct clusters and representative risk scores, the generator simulates five custom customer personas:

| Persona | Proportion | Recency Range | Frequency Range | Monetary Range | Expected Segment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Champions** | 15% | 1 - 15 days | 12 - 50 | £5,000 - £80,000 | High Value (K-Means 0) |
| **At Risk** | 20% | 150 - 450 days | 8 - 25 | £3,000 - £15,000 | At Risk (K-Means 2) |
| **New** | 15% | 1 - 10 days | 1 - 3 | £100 - £600 | New/Occasional (K-Means 3) |
| **Hibernating** | 30% | 250 - 650 days | 1 - 3 | £30 - £400 | Hibernating (K-Means 1) |
| **Normal** | 20% | 30 - 120 days | 3 - 8 | £400 - £2,000 | New/Occasional (K-Means 3) |

---

## 3. Discovered Model Discrepancies & mitigations

During development and testing of the serialization assets, we discovered a **critical discrepancy** in the saved `StandardScaler` inside `retail_ai_model_assets.joblib`:

> [!WARNING]
> **Scaler Conflict:**
> In the training notebook, the `scaler` variable was first fitted on raw RFM features for the Isolation Forest (`churn_model`), but was later re-fitted on log-transformed features (`X_log`) for the K-Means clustering model (`segmentation_model`).
> Because the same variable was serialized, the saved scaler expects **log-transformed inputs**, meaning that passing raw inputs to the Isolation Forest model using the saved scaler will result in highly distorted risk scores.

### How We Mitigated This (Quick Wins Inference Layer)
In `backend/modelling/test_inference.py`, we implement a robust, hybrid scaling layer:
1. **For K-Means Segmentation:** We apply `np.log(X + 1)` and then scale using the saved log `scaler`. This yields a **100% match** with the original cluster allocations.
2. **For Isolation Forest (Churn Risk):** We dynamically reconstruct a raw `StandardScaler` using the exact population means and variances computed from the original dataset:
   - **Recency Mean/Scale:** `201.33` / `209.32`
   - **Frequency Mean/Scale:** `6.29` / `13.01`
   - **Monetary Mean/Scale:** `3018.62` / `14736.48`
   This perfectly resolves the scaler conflict and yields **exact, mathematically correct churn risk scores**.

---

## 4. How to Run the Testing Pipeline

All scripts are configured to use the `basicneeds` conda environment where the dependencies (`lifetimes`, `scikit-learn`, `joblib`, etc.) are pre-installed.

### Step 1: Generate the Test Datasets
To generate the raw transaction and RFM dummy tables:
```bash
/home/ikhbar/miniconda3/envs/basicneeds/bin/python backend/modelling/generate_dummy_data.py
```
*Outputs generated:*
- `backend/data/dummy_rfm_customers.csv`
- `backend/data/dummy_clean_transactions.csv`

### Step 2: Execute Inference Pipeline & Score Customers
To load the serialized models, apply hybrid scaling, compute predictions, tier CLTV, generate recommended actions, and build human-readable explanations:
```bash
/home/ikhbar/miniconda3/envs/basicneeds/bin/python backend/modelling/test_inference.py
```
*Outputs generated:*
- `backend/data/dummy_enriched_customer_analytics.csv` (complete scored profiles)
- A detailed terminal-based validation report showing the first 5 records with complete explanations.

---

## 5. Output Schema & Scored Samples

The scored table matches the production schema defined in the RetailMind Pipeline PRD:

```
Customer ID: 20001
├── Recency: 37 days (recent customer interaction)
├── Frequency: 5 purchases
├── Monetary: £1,664.28 (high monetary value)
├── KMeansSegment: 'New/Occasional'
├── Churn Risk Score: 3.2 / 100 (LOW)
├── cltv_6_months: £478.28 (CLTV Tier B)
└── RecommendedAction: 'Loyalty Maintenance'
└── explanation: "Customer categorized as 'New/Occasional' with Churn Risk level: LOW (3.2/100) and CLTV Tier: B. Key drivers: Very recent interaction (37 days ago). Action: Loyalty Maintenance."
```

By inspecting `backend/data/dummy_enriched_customer_analytics.csv`, you can review the generated kopian for all 100 test customers.
