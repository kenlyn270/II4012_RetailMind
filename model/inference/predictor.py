import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from lifetimes import BetaGeoFitter, GammaGammaFitter
import os

CLUSTER_LABELS = {0: "High Value", 1: "Hibernating", 2: "At Risk", 3: "New/Occasional"}

class Predictor:
    """
    Predictor class for RetailMind models.
    Loads frozen baseline model assets once and performs scoring.
    """
    
    def __init__(self, model_path: str):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model assets not found at: {model_path}")
            
        assets = joblib.load(model_path)
        
        # Models & Scalers
        self.raw_scaler = assets.get("raw_scaler")
        self.log_scaler = assets.get("log_scaler", assets.get("scaler"))
        self.iso_forest = assets.get("churn_model")
        self.kmeans     = assets.get("segmentation_model")
        
        # CLTV Parameters
        self.bgf = BetaGeoFitter()
        self.bgf.params_ = assets.get("cltv_bgf_params")
        self.bgf.predict = self.bgf.conditional_expected_number_of_purchases_up_to_time
        self.ggf = GammaGammaFitter()
        self.ggf.params_ = assets.get("cltv_ggf_params")
        
        # Risk Score Normalization
        self.min_score = assets.get("risk_score_params", {}).get("min_score", -0.5)
        self.max_score = assets.get("risk_score_params", {}).get("max_score", 0.5)
        
        # Metadata
        self.metadata = assets.get("metadata", {"version": "unknown"})
        
        # Fallback for raw_scaler if missing (deprecated v1 support)
        if self.raw_scaler is None:
            self.raw_scaler = StandardScaler()
            self.raw_scaler.mean_ = np.array([201.331915617557, 6.289384144266758, 3018.6167366451173])
            self.raw_scaler.scale_ = np.array([209.32089900492423, 13.008299216842431, 14736.47735182636])
            self.raw_scaler.var_   = self.raw_scaler.scale_ ** 2
            self.raw_scaler.n_features_in_ = 3

    def score(self, rfm: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates raw scores using baseline models.
        Does NOT perform dataset-specific calibration/binning.
        """
        if rfm.empty:
            return pd.DataFrame()
            
        df = rfm.copy()
        X = df[["Recency", "Frequency", "Monetary"]]
        
        # 1. Churn Risk (Isolation Forest)
        # Use raw features scaled with raw_scaler
        X_raw_scaled = self.raw_scaler.transform(X)
        anomaly_scores = self.iso_forest.decision_function(X_raw_scaled)
        anomaly_labels = self.iso_forest.predict(X_raw_scaled)
        
        # Map to 0-100 score
        churn_risk = 100 * (1 - (anomaly_scores - self.min_score) / (self.max_score - self.min_score))
        churn_risk = np.clip(churn_risk, 0, 100)
        
        df["anomaly_label"]    = anomaly_labels
        df["anomaly_score"]    = anomaly_scores
        df["churn_risk_score"] = churn_risk
        
        # 2. KMeans Segmentation
        # Use log-transformed features scaled with log_scaler
        X_log = np.log(X + 1)
        X_log_scaled = self.log_scaler.transform(X_log)
        clusters = self.kmeans.predict(X_log_scaled)
        
        df["KMeansCluster"] = clusters
        df["KMeansSegment"] = pd.Series(clusters).map(CLUSTER_LABELS).values
        
        # 3. CLTV (BG-NBD + Gamma-Gamma)
        # BG/NBD frequency is repeat purchases (Frequency - 1)
        cltv = self.ggf.customer_lifetime_value(
            self.bgf,
            (df["Frequency"] - 1).clip(lower=0),
            df["Recency"],
            df["Recency"] + 30 * df["Frequency"], # Approximation of T
            (df["Monetary"] / df["Frequency"]).replace([np.inf, -np.inf], 0),
            time=6,
            discount_rate=0.01
        ).fillna(0).clip(lower=0)
        
        df["cltv_6_months"] = cltv
        
        return df
