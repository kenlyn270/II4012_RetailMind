import pandas as pd
import numpy as np
import datetime as dt
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from lifetimes import BetaGeoFitter, GammaGammaFitter
from lifetimes.utils import summary_data_from_transaction_data
import os

# Paths
RFM_PATH = 'backend/modelling/rfm_customer_table.csv'
TRANSACTIONS_PATH = 'backend/data/clean_transactions.csv'
MODEL_EXPORT_PATH = 'backend/model/retail_ai_model_assets.joblib'

def train_and_export():
    print("Loading data...")
    if not os.path.exists(RFM_PATH):
        print(f"Error: {RFM_PATH} not found.")
        return
    if not os.path.exists(TRANSACTIONS_PATH):
        print(f"Error: {TRANSACTIONS_PATH} not found.")
        return

    rfm = pd.read_csv(RFM_PATH, index_col='Customer ID')
    df_clean = pd.read_csv(TRANSACTIONS_PATH, parse_dates=['InvoiceDate'])
    
    FEATURES = ['Recency', 'Frequency', 'Monetary']
    X = rfm[FEATURES]
    
    # 1. Train Raw Scaler and Isolation Forest (Churn Risk)
    print("Training Isolation Forest...")
    raw_scaler = StandardScaler()
    X_raw_scaled = raw_scaler.fit_transform(X)
    
    iso_forest = IsolationForest(contamination=0.05, random_state=42)
    iso_forest.fit(X_raw_scaled)
    
    anomaly_scores = iso_forest.decision_function(X_raw_scaled)
    min_score = anomaly_scores.min()
    max_score = anomaly_scores.max()
    
    # 2. Train Log Scaler and K-Means (Segmentation)
    print("Training K-Means...")
    X_log = np.log(X + 1)
    log_scaler = StandardScaler()
    X_log_scaled = log_scaler.fit_transform(X_log)
    
    K_OPTIMAL = 4
    kmeans = KMeans(n_clusters=K_OPTIMAL, random_state=42, n_init=10)
    kmeans.fit(X_log_scaled)
    
    # 3. Train CLTV Models (BG/NBD + Gamma-Gamma)
    print("Training CLTV models...")
    observation_end = df_clean['InvoiceDate'].max() + dt.timedelta(days=1)
    
    cltv_df = summary_data_from_transaction_data(
        df_clean,
        customer_id_col='Customer ID',
        datetime_col='InvoiceDate',
        monetary_value_col='TotalPrice',
        observation_period_end=observation_end
    )
    
    # Filter for repeat customers with positive monetary value (matches notebook)
    cltv_df = cltv_df[(cltv_df['frequency'] > 0) & (cltv_df['monetary_value'] > 0)]
    
    bgf = BetaGeoFitter(penalizer_coef=0.001)
    bgf.fit(cltv_df['frequency'], cltv_df['recency'], cltv_df['T'])
    
    ggf = GammaGammaFitter(penalizer_coef=0.01)
    ggf.fit(cltv_df['frequency'], cltv_df['monetary_value'])
    
    # 4. Export Assets
    print(f"Exporting assets to {MODEL_EXPORT_PATH}...")
    deployment_assets = {
        'raw_scaler':         raw_scaler,
        'log_scaler':         log_scaler,
        'scaler':             log_scaler, # for backward compatibility (K-Means used this)
        'churn_model':        iso_forest,
        'segmentation_model': kmeans,
        'cltv_bgf_params':    bgf.params_,
        'cltv_ggf_params':    ggf.params_,
        'risk_score_params': {
            'min_score': float(min_score),
            'max_score': float(max_score)
        },
        'metadata': {
            'version': '2.0.0',
            'export_date': dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'feature_names': FEATURES,
            'k_clusters': K_OPTIMAL,
            'training_dataset': 'UCI Online Retail II',
            'feature_means': raw_scaler.mean_.tolist(),
            'feature_scales': raw_scaler.scale_.tolist(),
            'cluster_labels': {0: 'High Value', 1: 'Hibernating', 2: 'At Risk', 3: 'New/Occasional'}
        }
    }
    
    os.makedirs(os.path.dirname(MODEL_EXPORT_PATH), exist_ok=True)
    joblib.dump(deployment_assets, MODEL_EXPORT_PATH)
    print("Training and export completed successfully (v2.0.0).")

if __name__ == '__main__':
    train_and_export()
