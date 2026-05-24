# RetailMind AI Pipeline Documentation

> **Project:** RetailMind – Intelligent Customer Analytics Platform  
> **Version:** 1.0  
> **Last Updated:** 2026-05-16  
> **Author:** RetailMind Engineering Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Pipeline Model (Training Pipeline)](#2-pipeline-model-training-pipeline)
   - 2.1 [Data Pipeline](#21-data-pipeline)
   - 2.2 [Feature Engineering: RFM Analysis](#22-feature-engineering-rfm-analysis)
   - 2.3 [Model 1: Isolation Forest (Churn Risk Scoring)](#23-model-1-isolation-forest-churn-risk-scoring)
   - 2.4 [Model 2: K-Means Clustering (Customer Segmentation)](#24-model-2-k-means-clustering-customer-segmentation)
   - 2.5 [Model 3: BG-NBD + Gamma-Gamma (CLTV Prediction)](#25-model-3-bg-nbd--gamma-gamma-cltv-prediction)
   - 2.6 [Integration Layer](#26-integration-layer)
   - 2.7 [Model Artifact Export](#27-model-artifact-export)
3. [Pipeline Inference (Quick Wins — Immediately Deployable)](#3-pipeline-inference-quick-wins--immediately-deployable)
   - 3.1 [Inference Design Principles](#31-inference-design-principles)
   - 3.2 [Input Requirements](#32-input-requirements)
   - 3.3 [Preprocessing Steps](#33-preprocessing-steps)
   - 3.4 [Scoring & Prediction Flow](#34-scoring--prediction-flow)
   - 3.5 [Interpretability: How Each Score Is Explained](#35-interpretability-how-each-score-is-explained)
   - 3.6 [Output Schema](#36-output-schema)
   - 3.7 [Business Logic: Recommended Actions (Transparent & Configurable)](#37-business-logic-recommended-actions-transparent--configurable)
   - 3.8 [Quick Wins Deployment Checklist](#38-quick-wins-deployment-checklist)
4. [Pipeline Deployment — Sustainability Roadmap](#4-pipeline-deployment--sustainability-roadmap)
   - 4.1 [Why a Roadmap Is Needed](#41-why-a-roadmap-is-needed)
   - 4.2 [Phase 1: Shadow Deployment (Month 1–2)](#42-phase-1-shadow-deployment-month-12)
   - 4.3 [Phase 2: Champion-Challenger Evaluation (Month 3)](#43-phase-2-champion-challenger-evaluation-month-3)
   - 4.4 [Phase 3: Feedback Loop & Supervised Transition (Month 4+)](#44-phase-3-feedback-loop--supervised-transition-month-4)
   - 4.5 [Model Evaluation for Unsupervised Models](#45-model-evaluation-for-unsupervised-models)
   - 4.6 [Monitoring & Retraining](#46-monitoring--retraining)
5. [Risks & Mitigations](#5-risks--mitigations)
6. [Appendix](#6-appendix)

---

## 1. Overview

RetailMind is an AI-powered customer analytics system built on the **UCI Online Retail II** dataset. The system combines multiple unsupervised and probabilistic models to deliver:

- **Churn Risk Scoring** (0–100 scale) via Isolation Forest
- **Customer Segmentation** via K-Means Clustering on RFM features
- **Customer Lifetime Value (CLTV) Prediction** via BG-NBD + Gamma-Gamma models
- **Automated Marketing Action Recommendations** via rule-based business logic

The pipeline is structured in three major phases:
1. **Training Pipeline** – Data ingestion, preprocessing, feature engineering, model training, and artifact export
2. **Inference Pipeline** – Loading trained models, scoring new/existing customers, and generating recommendations
3. **Deployment Pipeline** – Strategy for production rollout, monitoring, and continuous improvement

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    RAW DATA SOURCE                       │
│              (online_retail_II.csv)                      │
│         ~1,067,371 rows, 8 columns                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               DATA CLEANING PIPELINE                     │
│  • Drop missing Customer ID (~243K rows)                │
│  • Remove cancelled invoices (prefix 'C')               │
│  • Filter Quantity > 0, Price > 0                       │
│  • Create TotalPrice = Quantity × Price                 │
│  Result: ~805,549 clean rows                            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│            FEATURE ENGINEERING (RFM)                      │
│  • Recency: days since last purchase                    │
│  • Frequency: number of distinct invoices               │
│  • Monetary: total spend                                │
│  • RFM Scoring (1-5 quintiles)                          │
│  • RF_Score composite                                   │
│  • Segment labels (Champions, Loyal, etc.)              │
│  Result: 5,878 unique customers                         │
└──────────┬──────────┬──────────┬────────────────────────┘
           │          │          │
           ▼          ▼          ▼
┌────────────┐ ┌───────────┐ ┌──────────────────┐
│ Isolation  │ │  K-Means  │ │ BG-NBD +         │
│ Forest     │ │ Clustering│ │ Gamma-Gamma      │
│(Churn Risk)│ │(Segments) │ │ (CLTV)           │
└─────┬──────┘ └─────┬─────┘ └────────┬─────────┘
      │              │                │
      ▼              ▼                ▼
┌─────────────────────────────────────────────────────────┐
│              INTEGRATION LAYER                           │
│  • Merge all model outputs per Customer ID              │
│  • Apply business rules → RecommendedAction             │
│  • Export: enriched_customer_analytics.csv               │
│  • Export: retail_ai_model_assets.joblib                 │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Pipeline Model (Training Pipeline)

### 2.1 Data Pipeline

#### 2.1.1 Data Source
- **Dataset:** UCI Online Retail II
- **File:** `online_retail_II.csv` (~95 MB)
- **Columns:** `Invoice`, `StockCode`, `Description`, `Quantity`, `InvoiceDate`, `Price`, `Customer ID`, `Country`
- **Raw row count:** 1,067,371
- **Unique customers:** 5,942
- **Date range:** 2009-12-01 to 2011-12-09

#### 2.1.2 Data Cleaning Steps

| Step | Description | Rows Affected |
|------|-------------|---------------|
| 1 | Drop rows with missing `Customer ID` | ~243,007 removed |
| 2 | Remove cancelled invoices (Invoice starts with 'C') | ~19,494 removed |
| 3 | Filter `Quantity > 0` AND `Price > 0` | Variable |
| 4 | Create `TotalPrice = Quantity × Price` | Computed column |

**Post-cleaning row count:** ~805,549  
**Output:** `clean_transactions.csv`

#### 2.1.3 Key Data Quality Observations
- Missing descriptions: 4,382 rows (non-critical for RFM)
- Duplicates in raw data: 34,335 rows
- Dominant market: United Kingdom (majority of revenue)
- Customer spending distribution is highly right-skewed

### 2.2 Feature Engineering: RFM Analysis

RFM (Recency, Frequency, Monetary) analysis is the foundational feature engineering step.

#### 2.2.1 Feature Definitions

| Feature | Definition | Computation |
|---------|-----------|-------------|
| **Recency** | Days since customer's last purchase | `max(InvoiceDate) - customer's last InvoiceDate` |
| **Frequency** | Number of distinct purchase occasions | `count(distinct Invoice)` per customer |
| **Monetary** | Total revenue from customer | `sum(TotalPrice)` per customer |

#### 2.2.2 RFM Scoring
Each RFM dimension is scored 1–5 using **quintile-based binning** (`pd.qcut`):
- **RecencyScore:** 5 = most recent (best), 1 = least recent
- **FrequencyScore:** 5 = highest frequency (best), 1 = lowest
- **MonetaryScore:** 5 = highest spend (best), 1 = lowest

**Composite Score:** `RF_Score = RecencyScore × 10 + FrequencyScore`

#### 2.2.3 Segment Mapping
Customers are mapped to business segments based on RF_Score ranges:

| Segment | Description |
|---------|-------------|
| Champions | High R, High F – best customers |
| Loyal Customers | Good R, Good F |
| Potential Loyalists | Recent, moderate frequency |
| New Customers | Very recent, low frequency |
| Promising | Recent but haven't bought much |
| Need Attention | Above average but trending down |
| About to Sleep | Below average R and F |
| At Risk | Used to purchase, now declining |
| Can't Loose | High value but inactive |
| Hibernating | Very low R and F |
| Lost | Lowest scores |

**Output:** `rfm_customer_table.csv`

### 2.3 Model 1: Isolation Forest (Churn Risk Scoring)

#### 2.3.1 Purpose
Detect **anomalous customer behavior** as a proxy for churn risk. Customers whose RFM profiles deviate significantly from the norm are flagged as high-risk.

#### 2.3.2 Preprocessing
```
Features: ['Recency', 'Frequency', 'Monetary']
Scaler: StandardScaler (z-score normalization)
X_scaled = StandardScaler().fit_transform(X)
```

#### 2.3.3 Model Configuration
```python
IsolationForest(
    contamination=0.05,  # Expected ~5% anomaly rate
    random_state=42
)
```

#### 2.3.4 Output Transformation
The raw `decision_function()` output is converted to a **0–100 churn risk score**:
```python
churn_risk_score = 100 × (1 - (score - min_score) / (max_score - min_score))
```
- **Higher score = higher churn risk** (inverted from Isolation Forest convention)
- Anomaly count at 5% contamination: ~294 customers flagged

> **⚠️ Important Note from AIinput.md Advisory:**  
> The Isolation Forest is an **unsupervised baseline model**. Its anomaly scores should NOT be treated as ground-truth churn labels. Using these pseudo-labels directly for supervised retraining risks creating an **echo chamber effect** where new models simply replicate the weaknesses of the baseline.

### 2.4 Model 2: K-Means Clustering (Customer Segmentation)

#### 2.4.1 Purpose
Provide data-driven customer segmentation complementary to rule-based RFM segments.

#### 2.4.2 Preprocessing
Due to the **highly skewed** distribution of RFM features:
```python
X_log = X.apply(lambda x: np.log(x + 1))  # Log transform
X_log_scaled = StandardScaler().fit_transform(X_log)
```

#### 2.4.3 Optimal K Selection
Determined via **Elbow Method** (inertia vs. k plot).  
**Selected k = 4** based on elbow observation.

#### 2.4.4 Cluster Profiles

| Cluster | Avg Recency | Avg Frequency | Avg Monetary | Count | Label |
|---------|-------------|---------------|--------------|-------|-------|
| 0 | 27.43 | 19.34 | 11,014.37 | 1,188 | High Value |
| 1 | 395.86 | 1.38 | 325.75 | 1,974 | Hibernating |
| 2 | 227.87 | 5.10 | 2,002.10 | 1,465 | At Risk |
| 3 | 28.44 | 3.04 | 865.11 | 1,251 | New/Occasional |

#### 2.4.5 Evaluation
- **Silhouette Score:** 0.365 (moderate clustering quality, acceptable for business use)

### 2.5 Model 3: BG-NBD + Gamma-Gamma (CLTV Prediction)

#### 2.5.1 Purpose
Predict **Customer Lifetime Value over 6 months** using probabilistic models from the `lifetimes` library.

#### 2.5.2 Data Preparation
Uses `summary_data_from_transaction_data()` to create the required format:

| Field | Description |
|-------|-------------|
| `frequency` | Number of repeat purchases (excludes first) |
| `recency` | Time between first and last purchase (in days) |
| `T` | Customer age (days since first purchase to observation end) |
| `monetary_value` | Average order value |

**Filter:** Only customers with `frequency > 0` (repeat buyers) and `monetary_value > 0`.

#### 2.5.3 BG-NBD Model (Purchase Frequency)
```python
BetaGeoFitter(penalizer_coef=0.001)
# Predicts: expected_purc_3_months (90-day horizon)
```
Predicts the **expected number of purchases** in a future period.

#### 2.5.4 Gamma-Gamma Model (Monetary Value)
```python
GammaGammaFitter(penalizer_coef=0.01)
# Predicts: cltv_6_months (6-month horizon, discount_rate=0.01)
```
Estimates **expected average profit per transaction**, combined with BG-NBD to produce CLTV.

#### 2.5.5 CLTV Segmentation
CLTV values are segmented into quartiles:

| Segment | Description |
|---------|-------------|
| A | Top 25% – Highest lifetime value |
| B | 50–75th percentile |
| C | 25–50th percentile |
| D | Bottom 25% – Lowest lifetime value |

Customers without CLTV data (non-repeat buyers) are labeled `Unknown`.

### 2.6 Integration Layer

All model outputs are joined on `Customer ID` to produce a unified customer profile:

```python
final_df = rfm.join(cltv_df[['cltv_6_months', 'CLTVSegment']], how='left')
final_df['cltv_6_months'] = final_df['cltv_6_months'].fillna(0)
final_df['CLTVSegment'] = final_df['CLTVSegment'].fillna('Unknown')
```

#### Final Schema

| Column | Source | Type |
|--------|--------|------|
| Recency, Frequency, Monetary | RFM Pipeline | int/float |
| RecencyScore, FrequencyScore, MonetaryScore | RFM Scoring | int (1-5) |
| RF_Score | RFM Composite | int |
| Segment | RFM Rule-based | string |
| Country | Raw Data | string |
| anomaly_label | Isolation Forest | int (-1/1) |
| anomaly_score | Isolation Forest | float |
| churn_risk_score | Derived | float (0-100) |
| KMeansCluster | K-Means | int (0-3) |
| KMeansSegment | K-Means label | string |
| cltv_6_months | BG-NBD + Gamma-Gamma | float |
| CLTVSegment | CLTV Quartile | string (A/B/C/D/Unknown) |
| RecommendedAction | Business Logic | string |

### 2.7 Model Artifact Export

All trained model objects and transformers are serialized via `joblib`:

**File:** `model/model/retail_ai_model_assets.joblib` (~1 MB)

Contents include:
- `StandardScaler` (fitted on training RFM features)
- `IsolationForest` model
- `KMeans` model
- `BetaGeoFitter` model
- `GammaGammaFitter` model
- Score normalization parameters (min/max of anomaly scores)

---

## 3. Pipeline Inference (Quick Wins — Immediately Deployable)

This section describes how the system delivers value **right now** using the trained model artifacts (`retail_ai_model_assets.joblib`). The design prioritizes **interpretability and transparency** — every score produced by the system is accompanied by a human-readable explanation so that business stakeholders can understand *why* a customer received a given recommendation, not just *what* the recommendation is.

### 3.1 Inference Design Principles

The inference pipeline is designed around three core principles for business use:

| Principle | What It Means | How It's Implemented |
|-----------|--------------|---------------------|
| **Interpretable** | Every score has a *reason* | Each customer output includes an `explanation` field describing which factors drove the score |
| **Transparent** | Business rules are visible and editable | Recommendation thresholds are defined in a configuration, not hardcoded |
| **Deterministic** | Same input → same output | No random state at inference time; all models use saved parameters |

> **Design Decision:** The system intentionally uses **simple, well-understood models** (Isolation Forest for anomaly detection, K-Means for clustering, BG-NBD/Gamma-Gamma for CLTV) rather than black-box deep learning approaches. This ensures that all outputs can be traced back to concrete customer behavior metrics (Recency, Frequency, Monetary).

### 3.2 Input Requirements

| Field | Type | Required |
|-------|------|----------|
| Customer ID | float/int | Yes |
| Invoice | string | Yes |
| InvoiceDate | datetime | Yes |
| Quantity | int | Yes |
| Price | float | Yes |
| TotalPrice | float | Computed |

### 3.3 Preprocessing Steps

1. **Data Cleaning:** Same filters as training (no nulls in Customer ID, no cancelled invoices, positive Quantity/Price)
2. **RFM Computation:** Recalculate Recency, Frequency, Monetary per customer
3. **Scaling:** Apply the **saved** `StandardScaler` via `transform()` (NOT `fit_transform()`)
4. **Log Transform:** For K-Means: `log(x+1)` then scale with saved scaler
5. **CLTV Data Prep:** Recompute `summary_data_from_transaction_data` from full transaction history

> **⚠️ Critical:** The `StandardScaler` object from training is persisted in `retail_ai_model_assets.joblib`. Inference MUST use this exact scaler to ensure consistency between training and scoring.

### 3.4 Scoring & Prediction Flow

```
Customer Transaction Data
       │
       ▼
┌──────────────────────────────────────────┐
│ 1. CLEAN & FILTER                        │
│    (same rules as training)              │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ 2. COMPUTE RFM FEATURES                  │
│    Recency · Frequency · Monetary        │
└────────────────┬─────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────────────┐
│ Churn  │ │ Customer │ │ CLTV         │
│ Risk   │ │ Segment  │ │ Prediction   │
│ Score  │ │ (K-Means)│ │ (BG-NBD+GG)  │
└───┬────┘ └────┬─────┘ └──────┬───────┘
    │           │              │
    ▼           ▼              ▼
┌──────────────────────────────────────────┐
│ 3. MERGE + EXPLAIN + RECOMMEND           │
│    → Per-customer explanation             │
│    → RecommendedAction                    │
└──────────────────────────────────────────┘
```

### 3.5 Interpretability: How Each Score Is Explained

This is the **key differentiator** for business use. Each model output is paired with a human-readable explanation.

#### Churn Risk Score — Explanation Logic

The churn risk score (0–100) is derived from Isolation Forest's anomaly detection. To explain it, the system compares each customer's RFM values against the **population average**:

```
Customer 12346:
  Churn Risk Score: 80/100 (CRITICAL)
  Reason:
    ├── Recency: 326 days (population avg: 92 days) → VERY HIGH gap
    ├── Frequency: 12 purchases (population avg: 5) → ABOVE average
    └── Monetary: £77,556 (population avg: £2,054) → FAR ABOVE average
  Summary: High-value customer who has NOT purchased in a long time.
           Despite strong historical spending, the extended absence signals high churn risk.
```

The explanation identifies **which feature deviates most** from the population norm and translates it to business language.

#### K-Means Segment — Explanation Logic

Each cluster has a pre-defined **profile description** based on its centroid characteristics:

| Cluster | Label | Profile Description |
|---------|-------|-------------------|
| 0 | High Value | Recent buyers with high frequency and high spend |
| 1 | Hibernating | Very old customers with minimal activity and low spend |
| 2 | At Risk | Moderate recency but declining engagement |
| 3 | New/Occasional | Recent but infrequent buyers with moderate spend |

#### CLTV — Explanation Logic

```
Customer 12347:
  CLTV (6 months): £2,077 (Tier A — Top 25%)
  Reason:
    ├── Expected purchases in next 3 months: 1.47
    ├── Average order value: £717
    └── Customer tenure: 405 days
  Summary: Highly engaged repeat buyer with strong predicted future value.
```

### 3.6 Output Schema

Each customer record in the output includes:

| Column | Source | Type | Business Meaning |
|--------|--------|------|------------------|
| Recency, Frequency, Monetary | RFM Pipeline | int/float | Raw customer behavior |
| RecencyScore, FrequencyScore, MonetaryScore | RFM Scoring | int (1-5) | Quintile rank |
| Segment | RFM Rule-based | string | Business segment label |
| churn_risk_score | Isolation Forest | float (0-100) | Churn probability proxy |
| churn_risk_level | Derived | string | CRITICAL / HIGH / MEDIUM / LOW |
| KMeansSegment | K-Means | string | Data-driven cluster label |
| cltv_6_months | BG-NBD + GG | float | Predicted 6-month value (£) |
| CLTVSegment | CLTV Quartile | string (A/B/C/D) | Value tier |
| RecommendedAction | Business Logic | string | Marketing action |
| **explanation** | **Explainer** | **string** | **Human-readable reasoning** |

### 3.7 Business Logic: Recommended Actions (Transparent & Configurable)

The recommendation rules are explicitly defined as a **configurable decision matrix**, making it easy for business users to review and adjust thresholds without modifying code:

#### Decision Matrix

| CLTV Tier | Churn Risk | RFM Segment | → Action | Rationale |
|-----------|-----------|-------------|----------|-----------|
| A or B | > 75 (Critical) | Any | **Win-back Priority** | High-value customer at serious risk — requires personal outreach |
| A or B | ≤ 50 (Low/Medium) | Any | **Loyalty Maintenance** | Valuable and engaged — nurture to retain |
| C or D | > 75 (Critical) | Any | **Low-cost Automation** | Low-value + high-risk — automated campaigns only |
| Any | Any | New Customers | **Onboarding Campaign** | New relationship — build engagement early |
| *else* | *else* | *else* | **Standard Nurture** | Default nurturing flow |

#### Configurable Thresholds

```python
# These thresholds are TRANSPARENT and ADJUSTABLE by business stakeholders
CHURN_RISK_LEVELS = {
    "critical": 75,   # Score > 75
    "high":     50,   # Score 50–75
    "medium":   25,   # Score 25–50
    "low":       0    # Score 0–25
}
```

> **Transparency Note:** The decision matrix above is the **complete set of rules** governing recommendations. There are no hidden rules or additional model logic — what you see is what the system uses.

### 3.8 Quick Wins Deployment Checklist

This checklist confirms what is **already available** for immediate use:

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Trained models serialized in `retail_ai_model_assets.joblib` | ✅ Ready | Contains StandardScaler, IsolationForest, KMeans, CLTV params |
| 2 | Clean transaction data (`clean_transactions.csv`) | ✅ Ready | ~805K rows, pre-cleaned |
| 3 | Pre-computed customer analytics (`enriched_customer_analytics.csv`) | ✅ Ready | 5,878 customers scored |
| 4 | RFM feature table (`rfm_customer_table.csv`) | ✅ Ready | RFM + Segment per customer |
| 5 | Recommendation logic defined | ✅ Ready | Transparent decision matrix |
| 6 | Interpretability/explanation layer | 🔧 To Build | Inference module with per-customer explanations |
| 7 | CLI/API for on-demand scoring | 🔧 To Build | Standalone `inference/` Python module |

> **Bottom Line:** The system can deliver actionable customer intelligence **today** using the pre-computed `enriched_customer_analytics.csv`. Items 6–7 are enhancements to make the system self-service and repeatable.

---

## 4. Pipeline Deployment — Sustainability Roadmap

> **Important Context:** The system described in Section 3 can deliver value **immediately** using pre-trained models and transparent business rules. However, any AI system that is deployed for real business decisions must also have a plan for **long-term sustainability** — ensuring that the models remain accurate as customer behavior evolves over time.
>
> This section documents the **planned roadmap** for maturing the system from its current state (Quick Wins) into a fully self-improving analytics platform. These steps **cannot be implemented on day one** because they require real-world observation data that only accumulates after the system has been in production for a meaningful period (typically 30–90 days).
>
> The fact that this roadmap exists demonstrates that the system has been designed with sustainability in mind — not just as a one-time analysis, but as a **living, evolving platform**.

### 4.1 Why a Roadmap Is Needed

The current system uses **unsupervised models** (Isolation Forest, K-Means) which do not require labeled "ground truth" data for training. This is a significant advantage for initial deployment — the system works without needing historical churn labels.

However, unsupervised models have inherent limitations:

| Limitation | Impact | When It Can Be Addressed |
|-----------|--------|-------------------------|
| No ground truth validation | We don't know if predicted "high risk" customers truly churn | After 30+ days of observation |
| Model drift over time | Customer behavior patterns shift seasonally/annually | After accumulating 3–6 months of data |
| Echo chamber risk | Pseudo-labels from IF could create self-reinforcing bias | Only after real feedback data exists |
| Single model perspective | Isolation Forest may miss patterns other algorithms catch | After building challenger models |

**The roadmap below addresses each of these limitations through a phased approach.**

### 4.2 Phase 1: Shadow Deployment (Month 1–2)

> **Status: 🔮 Planned — Requires production deployment first**

#### What Is Shadow Deployment?

Shadow deployment means running a **second model (Challenger)** alongside the primary model (Champion) in production. Both models score every customer, but **only the Champion's scores drive actual business decisions**. The Challenger's scores are logged silently for later comparison.

#### Why It Can't Be Done Immediately

Shadow deployment requires:
1. The **Quick Wins system (Section 3) to already be in production** and generating recommendations
2. A **Challenger model** to be trained and deployed (e.g., One-Class SVM, Local Outlier Factor)
3. An **observation period** where customer behavior is tracked against both models' predictions

#### Planned Implementation

```
┌───────────────────────────────────────────────────┐
│              PRODUCTION (Month 1–2)                │
│                                                   │
│  ┌───────────────┐      ┌───────────────┐        │
│  │   CHAMPION    │      │  CHALLENGER   │        │
│  │  (Isolation   │      │  (One-Class   │        │
│  │   Forest)     │      │    SVM)       │        │
│  └──────┬────────┘      └──────┬────────┘        │
│         │ Drives                │ Logged           │
│         │ decisions             │ silently          │
│         ▼                      ▼                  │
│  ┌─────────────────────────────────────────┐     │
│  │        SCORING LOG DATABASE              │     │
│  │  Records both models' scores per         │     │
│  │  customer for later comparison           │     │
│  └─────────────────────────────────────────┘     │
└───────────────────────────────────────────────────┘
```

#### Prerequisites Before Starting Phase 1
- [ ] Quick Wins inference pipeline running in production
- [ ] At least 2 weeks of recommendation data collected
- [ ] Challenger model (One-Class SVM or CLOF) trained on same RFM features
- [ ] Logging infrastructure to record both models' scores per scoring run

### 4.3 Phase 2: Champion-Challenger Evaluation (Month 3)

> **Status: 🔮 Planned — Requires 30+ days of Phase 1 data**

After the observation period, compare which model better predicts actual customer behavior:

#### Evaluation Method: Precision@K
1. Take the top-K customers ranked as "highest risk" by each model
2. Check how many of those customers actually failed to return within 30 days
3. The model with higher **Precision@K** wins

```
Example (K=100):
  Champion (Isolation Forest): 62 out of top-100 "high risk" actually churned → Precision = 62%
  Challenger (One-Class SVM):  71 out of top-100 "high risk" actually churned → Precision = 71%
  → Challenger is promoted to new Champion
```

#### Decision Criteria
- If Challenger outperforms Champion by ≥5% on Precision@K → **Promote Challenger**
- If difference is <5% → **Keep Champion** (stability preference)
- If Champion outperforms → **Retire Challenger**, try a different algorithm

### 4.4 Phase 3: Feedback Loop & Supervised Transition (Month 4+)

> **Status: 🔮 Planned — Requires accumulated labeled data from Phases 1–2**

This is the most significant long-term improvement. Over time, the system collects **real churn outcomes** (did the customer return or not?), which allows a gradual transition from unsupervised to supervised learning.

#### Why Not Use Pseudo-labels Immediately?

> **⚠️ Key Risk (from AIinput.md advisory):** If baseline model predictions are directly used as labels for supervised retraining, the new model will only replicate the baseline's weaknesses — an **echo chamber** effect. The supervised model would learn to mimic Isolation Forest's biases rather than learning true churn patterns.

#### The Actual Feedback Loop (Safe Approach)

```
Day 0:  Model predicts Customer X = "High Risk" (score 85)
        → Recommendation: "Win-back Priority"
        → Business team executes win-back campaign

Day 30: System checks — Did Customer X make a purchase?
        → NO  → Label as "Actually Churned"   (True Positive — model was right)
        → YES → Label as "Actually Retained"   (False Positive — model was wrong)

Month 4+: After accumulating ~1,000+ labeled examples:
        → Train a supervised classifier (e.g., Logistic Regression, Random Forest)
        → Compare supervised model vs. unsupervised Champion
        → If supervised wins → Promote to new Champion
```

This approach ensures the system evolves based on **real business outcomes**, not model-generated assumptions.

### 4.5 Model Evaluation for Unsupervised Models

Since the Quick Wins system uses unsupervised models (no initial labels), model quality is assessed via:

#### A. Stability Testing (Bootstrap)
- Randomly sample 80% of data multiple times
- Train model on each sample
- Check if customer **rankings** remain consistent across samples
- **Best model = most stable rankings**

#### B. Score Distribution Analysis
- Examine the distribution of `churn_risk_score` across all customers
- Good model: clear separation between low-risk and high-risk groups
- Bad model: scores concentrated in the middle (no discriminative power)

#### C. Business Proxy Metric (Backtesting)
Using the historical data that spans 2 years (2009–2011):
1. Use months 1–18 to train the model
2. Predict risk scores at end of month 18
3. Check actual behavior in months 19–24
4. Calculate **Precision@K**: Of top-100 highest-risk customers, how many truly did not return?

### 4.6 Monitoring & Retraining

#### Monitoring Metrics (To Be Implemented in Phase 1+)

| Metric | Frequency | Alert Threshold | Purpose |
|--------|-----------|-----------------|---------|
| Score distribution shift | Weekly | KL-divergence > 0.1 | Detect model drift |
| Prediction accuracy | Monthly | Precision@100 < 50% | Validate model quality |
| Data quality | Daily | > 5% missing rate | Catch data pipeline issues |
| Feature drift (RFM) | Weekly | Mean shift > 2σ | Detect behavioral changes |

#### Retraining Schedule (Planned)
- **Scheduled:** Monthly full retrain with latest transaction data
- **Triggered:** When monitoring alerts exceed thresholds
- **Process:** Retrain → Evaluate on holdout → Compare with current Champion → Promote if better

#### Sustainability Summary

```
Timeline:   NOW          Month 1-2         Month 3          Month 4+
            │              │                 │                │
            ▼              ▼                 ▼                ▼
         Quick Wins     Shadow            Evaluate         Feedback
         (Section 3)    Deployment        & Promote        Loop &
         ✅ Ready       🔮 Planned        🔮 Planned       Supervised
                                                           Transition
                                                           🔮 Planned

Key principle: Each phase DEPENDS on data collected in the previous phase.
              There are no shortcuts — sustainability requires patience.
```

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Echo Chamber in Pseudo-labelling** | Model replicates baseline weaknesses | Use Actual Feedback Loop with 30-day wait period |
| **Concept Drift** | Customer behavior patterns change over time | Regular retraining + monitoring |
| **Cold Start for New Customers** | No purchase history for RFM/CLTV | Use "Onboarding Campaign" default action |
| **Imbalanced Contamination Rate** | 5% contamination may over/under-detect | Tune via backtesting; try 3%, 5%, 10% |
| **CLTV Model Limitation** | BG-NBD assumes non-contractual setting | Validate assumptions; consider alternative models |
| **Scaler Inconsistency** | Different scaling between train/inference | Persist scaler objects in model artifacts |

---

## 6. Appendix

### 6.1 File Inventory

| File | Location | Purpose |
|------|----------|---------|
| `online_retail_II.csv` | `model/data/` | Raw dataset |
| `clean_transactions.csv` | `model/data/` | Cleaned transaction data |
| `rfm_customer_table.csv` | `model/data/` | RFM features per customer |
| `enriched_customer_analytics.csv` | `model/data/` | Final integrated output |
| `retail_ai_model_assets.joblib` | `model/model/` | Serialized model artifacts |
| `minggu1_data_rfm_cohort.ipynb` | `model/modelling/` | Week 1 training notebook |
| `minggu2_model_cltv_ai.ipynb` | `model/modelling/` | Week 2 training notebook |

### 6.2 Dependencies

```
pandas
numpy
matplotlib
seaborn
scikit-learn (StandardScaler, IsolationForest, KMeans)
lifetimes (BetaGeoFitter, GammaGammaFitter)
joblib
```

### 6.3 Key Hyperparameters

| Model | Parameter | Value | Rationale |
|-------|-----------|-------|-----------|
| IsolationForest | `contamination` | 0.05 | ~5% expected anomaly rate |
| IsolationForest | `random_state` | 42 | Reproducibility |
| KMeans | `n_clusters` | 4 | Elbow method |
| KMeans | `n_init` | 10 | Default, robust initialization |
| BetaGeoFitter | `penalizer_coef` | 0.001 | Regularization |
| GammaGammaFitter | `penalizer_coef` | 0.01 | Regularization |
| CLTV Prediction | `time` | 6 months | Business horizon |
| CLTV Prediction | `discount_rate` | 0.01 | Monthly discount |

### 6.4 Glossary

| Term | Definition |
|------|-----------|
| **RFM** | Recency, Frequency, Monetary – customer value framework |
| **CLTV** | Customer Lifetime Value – predicted future revenue from customer |
| **BG-NBD** | Beta-Geometric/Negative Binomial Distribution – purchase frequency model |
| **Gamma-Gamma** | Model for expected monetary value per transaction |
| **Isolation Forest** | Anomaly detection algorithm based on random partitioning |
| **Champion-Challenger** | A/B testing framework for model deployment |
| **Pseudo-labelling** | Using model predictions as training labels (risky if not validated) |
| **Feedback Loop** | Process of validating predictions with actual outcomes |

---

*End of Documentation*
