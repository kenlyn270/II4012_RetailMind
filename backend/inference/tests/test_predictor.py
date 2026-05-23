import pandas as pd
import numpy as np
from backend.inference.predictor import Predictor
from backend.inference.rfm import aggregate_rfm
from backend.inference.calibration import build_profile, apply_profile
import os

def test_inference_logic():
    model_path = 'backend/model/retail_ai_model_assets.joblib'
    predictor = Predictor(model_path)
    
    # Create dummy RFM data
    rfm_data = pd.DataFrame({
        'customer_id': ['C1', 'C2', 'C3'],
        'Recency': [5, 100, 500],
        'Frequency': [20, 5, 1],
        'Monetary': [10000, 1000, 50],
        'Country': ['UK', 'UK', 'FR']
    })
    
    # 1. Score
    scored = predictor.score(rfm_data)
    assert not scored.empty
    assert 'churn_risk_score' in scored
    assert 'KMeansSegment' in scored
    assert 'cltv_6_months' in scored
    
    print("Scoring successful.")
    
    # 2. Profile
    profile = build_profile(scored, "test_ds", predictor.metadata['version'])
    assert profile['n_customers'] == 3
    assert 'cltv_thresholds' in profile
    
    print("Profile building successful.")
    
    # 3. Apply
    enriched = apply_profile(scored, profile)
    assert 'CLTVSegment' in enriched
    assert 'churn_risk_level' in enriched
    
    print("Calibration application successful.")
    print("\nSample Enriched Data:")
    print(enriched[['customer_id', 'churn_risk_score', 'churn_risk_level', 'KMeansSegment', 'CLTVSegment']])

if __name__ == "__main__":
    test_inference_logic()
