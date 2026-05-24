import joblib
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from lifetimes import BetaGeoFitter, GammaGammaFitter
import os

def test_inference(rfm_dummy_path='model/data/dummy_rfm_customers.csv', 
                   model_path='model/model/retail_ai_model_assets.joblib',
                   output_path='model/data/dummy_enriched_customer_analytics.csv'):
    
    print("\n" + "="*60)
    print("      RETAILMIND MODEL INFERENCE & TESTING PIPELINE")
    print("="*60)
    
    # 1. Load Serialized Model Assets
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model assets not found at: {model_path}")
        
    print(f"Loading serialized model assets from: {model_path}...")
    assets = joblib.load(model_path)
    
    # Extract assets
    log_scaler = assets['log_scaler'] if 'log_scaler' in assets else assets['scaler']
    iso_forest = assets['churn_model']
    kmeans     = assets['segmentation_model']
    bgf_params = assets['cltv_bgf_params']
    ggf_params = assets['cltv_ggf_params']
    min_score  = assets['risk_score_params']['min_score']
    max_score  = assets['risk_score_params']['max_score']
    
    print(" -> Models loaded successfully!")
    print(f" -> Metadata: {assets['metadata']}")
    
    # 2. Instantiate and Reconstruct Lifetimes Models
    bgf = BetaGeoFitter()
    bgf.params_ = bgf_params
    bgf.predict = bgf.conditional_expected_number_of_purchases_up_to_time
    
    ggf = GammaGammaFitter()
    ggf.params_ = ggf_params
    
    # 3. Resolve Raw Scaler for Isolation Forest
    if 'raw_scaler' in assets:
        print(" -> Using v2 raw_scaler from joblib.")
        raw_scaler = assets['raw_scaler']
    else:
        # Fallback hack for joblib v1 (deprecated)
        print(" -> WARNING: raw_scaler not found. Using v1 hardcoded fallback.")
        raw_scaler = StandardScaler()
        raw_scaler.mean_ = np.array([201.331915617557, 6.289384144266758, 3018.6167366451173])
        raw_scaler.scale_ = np.array([209.32089900492423, 13.008299216842431, 14736.47735182636])
        raw_scaler.var_ = raw_scaler.scale_ ** 2
        raw_scaler.n_features_in_ = 3
    
    # 4. Load Dummy Data
    if not os.path.exists(rfm_dummy_path):
        raise FileNotFoundError(f"Dummy RFM data not found at: {rfm_dummy_path}")
        
    print(f"\nLoading dummy RFM customer data from: {rfm_dummy_path}...")
    df = pd.read_csv(rfm_dummy_path)
    print(f"Loaded {len(df)} customer records for testing.")
    
    # 5. Execute Pipeline Components
    print("\nRunning model inference on dummy data...")
    
    # Prepare features
    X = df[['Recency', 'Frequency', 'Monetary']]
    
    # --- Churn Risk Prediction (Isolation Forest) ---
    X_raw_scaled = raw_scaler.transform(X)
    anomaly_scores = iso_forest.decision_function(X_raw_scaled)
    anomaly_labels = iso_forest.predict(X_raw_scaled)
    
    # Map to 0-100 Churn Risk Score
    df['anomaly_label'] = anomaly_labels
    df['anomaly_score'] = anomaly_scores
    df['churn_risk_score'] = 100 * (1 - (anomaly_scores - min_score) / (max_score - min_score))
    
    # Set Risk Levels
    def get_risk_level(score):
        if score > 75: return 'CRITICAL'
        elif score > 50: return 'HIGH'
        elif score > 25: return 'MEDIUM'
        else: return 'LOW'
    df['churn_risk_level'] = df['churn_risk_score'].apply(get_risk_level)
    
    # --- Customer Segmentation (K-Means) ---
    # Log transform and scale with saved log scaler
    X_log = np.log(X + 1)
    X_log_scaled = log_scaler.transform(X_log)
    df['KMeansCluster'] = kmeans.predict(X_log_scaled)
    
    # Map K-Means clusters to business labels
    cluster_map = {
        0: 'High Value',
        1: 'Hibernating',
        2: 'At Risk',
        3: 'New/Occasional'
    }
    df['KMeansSegment'] = df['KMeansCluster'].map(cluster_map)
    
    # --- CLTV Prediction (BG-NBD + Gamma-Gamma) ---
    # In transactional lifetimes, Recency is (age at last purchase), T is (customer age).
    # Since our dummy dataset has RFM precomputed, let's approximate lifetimes inputs:
    # We will assume a customer tenure of T = Recency + 30 * Frequency.
    # Note: For pure lifetimes testing, one can also run on transactional dummy.
    # Here, we will map standard RFM features to predicted CLTV:
    df['cltv_6_months'] = ggf.customer_lifetime_value(
        bgf,
        df['Frequency'] - 1, # frequency of repeat purchases (approximated)
        df['Recency'], # time since last purchase
        df['Recency'] + (30 * df['Frequency']), # approximate T
        df['Monetary'] / df['Frequency'], # monetary value per transaction
        time=6,
        discount_rate=0.01
    )
    df['cltv_6_months'] = df['cltv_6_months'].fillna(0).clip(lower=0)
    
    # Quantile Tiering based on historical thresholds
    # Thresholds: [175.93, 439.13, 966.70]
    def get_cltv_segment(val):
        if val >= 966.696: return 'A'
        elif val >= 439.131: return 'B'
        elif val >= 175.928: return 'C'
        elif val > 0: return 'D'
        else: return 'Unknown'
    df['CLTVSegment'] = df['cltv_6_months'].apply(get_cltv_segment)
    
    # --- Rule-Based Marketing Recommendations & Explanations ---
    actions = []
    explanations = []
    
    # Reference averages for explanation
    avg_recency = 201.3
    avg_frequency = 6.3
    avg_monetary = 3018.6
    
    for idx, row in df.iterrows():
        # Action Logic
        cltv_seg = row['CLTVSegment']
        risk_score = row['churn_risk_score']
        
        # Approximate rule-based RFM segment based on raw Recency & Frequency scores
        r_score = 5 if row['Recency'] < 15 else (4 if row['Recency'] < 50 else (3 if row['Recency'] < 150 else (2 if row['Recency'] < 300 else 1)))
        f_score = 1 if row['Frequency'] <= 2 else (2 if row['Frequency'] <= 5 else (3 if row['Frequency'] <= 10 else (4 if row['Frequency'] <= 20 else 5)))
        
        is_new = (r_score >= 4 and f_score <= 2)
        
        if cltv_seg in ['A', 'B'] and risk_score > 75:
            action = 'Win-back Priority'
        elif cltv_seg in ['A', 'B'] and risk_score <= 50:
            action = 'Loyalty Maintenance'
        elif cltv_seg in ['C', 'D'] and risk_score > 75:
            action = 'Low-cost Automation'
        elif is_new:
            action = 'Onboarding Campaign'
        else:
            action = 'Standard Nurture'
            
        actions.append(action)
        
        # Build Explanation
        factors = []
        if row['Recency'] > avg_recency * 1.5:
            factors.append(f"Inactivity of {int(row['Recency'])} days is significantly above standard limit.")
        elif row['Recency'] < avg_recency * 0.3:
            factors.append(f"Very recent interaction ({int(row['Recency'])} days ago).")
            
        if row['Frequency'] > avg_frequency * 2:
            factors.append(f"High historical engagement with {int(row['Frequency'])} distinct transactions.")
        elif row['Frequency'] <= 2:
            factors.append("Low repeat purchase rate.")
            
        if row['Monetary'] > avg_monetary * 2:
            factors.append(f"Extremely high historical spend of £{row['Monetary']:,.2f}.")
        elif row['Monetary'] < avg_monetary * 0.2:
            factors.append(f"Low transaction value (£{row['Monetary']:,.2f}).")
            
        factors_str = " ".join(factors) if factors else "Standard activity patterns."
        
        exp = (
            f"Customer categorized as '{row['KMeansSegment']}' with Churn Risk level: {row['churn_risk_level']} "
            f"({risk_score:.1f}/100) and CLTV Tier: {cltv_seg}. Key drivers: {factors_str} "
            f"Action: {action}."
        )
        explanations.append(exp)
        
    df['RecommendedAction'] = actions
    df['explanation'] = explanations
    
    # 6. Save Enriched Table
    df.to_csv(output_path, index=False)
    print(f"\n -> Successfully saved enriched dummy results to: {output_path}")
    
    # 7. Print Demonstration Report
    print("\n" + "-"*50)
    print("      SAMPLE SCORING REPORT (FIRST 5 CUSTOMERS)")
    print("-"*50)
    
    cols_to_print = ['Customer ID', 'Recency', 'Frequency', 'Monetary', 'churn_risk_score', 'churn_risk_level', 'KMeansSegment', 'cltv_6_months', 'CLTVSegment', 'RecommendedAction']
    print(df[cols_to_print].head(5).to_string(index=False))
    
    print("\n" + "-"*50)
    print("      EXPLANATION SAMPLES")
    print("-"*50)
    for i in range(5):
        print(f"Customer {df.iloc[i]['Customer ID']:.0f}: {df.iloc[i]['explanation']}\n")
        
    print("="*60)
    print("      END OF REPORT")
    print("="*60)

if __name__ == '__main__':
    test_inference()
