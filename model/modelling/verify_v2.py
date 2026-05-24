import joblib
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import os

def verify_v2():
    model_path = 'model/model/retail_ai_model_assets.joblib'
    print(f"Loading version 2 assets from: {model_path}...")
    assets = joblib.load(model_path)
    
    print(f"Metadata version: {assets['metadata']['version']}")
    
    # Check if raw_scaler exists
    if 'raw_scaler' not in assets:
        print("FAIL: 'raw_scaler' not found in assets.")
        return
    
    raw_scaler_v2 = assets['raw_scaler']
    
    # Hardcoded values from v1 hack
    hc_mean = np.array([201.331915617557, 6.289384144266758, 3018.6167366451173])
    hc_scale = np.array([209.32089900492423, 13.008299216842431, 14736.47735182636])
    
    print("\nComparing Raw Scaler Means:")
    print(f"  V2 Mean: {raw_scaler_v2.mean_}")
    print(f"  HC Mean: {hc_mean}")
    np.testing.assert_allclose(raw_scaler_v2.mean_, hc_mean, atol=1e-5)
    print("  -> Means match!")
    
    print("\nComparing Raw Scaler Scales:")
    print(f"  V2 Scale: {raw_scaler_v2.scale_}")
    print(f"  HC Scale: {hc_scale}")
    np.testing.assert_allclose(raw_scaler_v2.scale_, hc_scale, atol=1e-5)
    print("  -> Scales match!")
    
    # Test on some dummy data
    test_data = pd.DataFrame({
        'Recency': [10, 200, 500],
        'Frequency': [1, 5, 20],
        'Monetary': [100, 1000, 50000]
    })
    
    # Hacked scaler from v1
    hacked_scaler = StandardScaler()
    hacked_scaler.mean_ = hc_mean
    hacked_scaler.scale_ = hc_scale
    hacked_scaler.var_ = hc_scale ** 2
    hacked_scaler.n_features_in_ = 3
    
    out_v2 = raw_scaler_v2.transform(test_data)
    out_hc = hacked_scaler.transform(test_data)
    
    print("\nComparing Transformed Values:")
    np.testing.assert_allclose(out_v2, out_hc, atol=1e-5)
    print("  -> Transformed values match!")
    
    print("\nVERIFICATION SUCCESSFUL: Joblib v2 raw_scaler matches v1 hardcoded hack.")

if __name__ == '__main__':
    verify_v2()
