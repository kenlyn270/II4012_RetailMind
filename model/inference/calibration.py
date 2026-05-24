import numpy as np
import pandas as pd
from datetime import datetime, timezone

# Baseline churn thresholds
DEFAULT_CHURN_LEVELS = {"critical": 75, "high": 50, "medium": 25}

def build_profile(scored_df: pd.DataFrame, dataset_id: str, model_version: str) -> dict:
    """
    Builds a calibration profile based on the current dataset's score distribution.
    """
    if scored_df.empty:
        return {}

    cltv = scored_df["cltv_6_months"]
    cltv_positive = cltv[cltv > 0]

    # Calculate CLTV Quartile thresholds
    # Fallback to training set values if dataset is too small
    if len(cltv_positive) >= 8:
        q25, q50, q75 = np.percentile(cltv_positive, [25, 50, 75])
    else:
        # Fallback values from UCI dataset training
        q25, q50, q75 = 175.928, 439.131, 966.696

    profile = {
        "dataset_id": dataset_id,
        "model_version": model_version,
        "calibrated_at": datetime.now(timezone.utc).isoformat(),
        "n_customers": int(len(scored_df)),
        "rfm_stats": {
            "recency":   {"mean": float(scored_df["Recency"].mean()),   "std": float(scored_df["Recency"].std() or 0)},
            "frequency": {"mean": float(scored_df["Frequency"].mean()), "std": float(scored_df["Frequency"].std() or 0)},
            "monetary":  {"mean": float(scored_df["Monetary"].mean()),  "std": float(scored_df["Monetary"].std() or 0)},
        },
        "cltv_thresholds": {"q25": float(q25), "q50": float(q50), "q75": float(q75)},
        "churn_levels": DEFAULT_CHURN_LEVELS,
        "cluster_distribution": (
            scored_df["KMeansSegment"].value_counts(normalize=True).round(3).to_dict()
        ),
    }
    return profile

def apply_profile(scored_df: pd.DataFrame, profile: dict) -> pd.DataFrame:
    """
    Applies the calibration profile to assign tiers and risk levels.
    """
    if scored_df.empty or not profile:
        return scored_df
        
    df = scored_df.copy()
    t = profile["cltv_thresholds"]

    # Assign CLTV Segments (A, B, C, D)
    df["CLTVSegment"] = np.select(
        [
            df["cltv_6_months"] >= t["q75"],
            df["cltv_6_months"] >= t["q50"],
            df["cltv_6_months"] >= t["q25"],
            df["cltv_6_months"] > 0
        ],
        ["A", "B", "C", "D"],
        default="Unknown",
    )

    # Assign Churn Risk Levels
    levels = profile["churn_levels"]
    df["churn_risk_level"] = np.select(
        [
            df["churn_risk_score"] > levels["critical"],
            df["churn_risk_score"] > levels["high"],
            df["churn_risk_score"] > levels["medium"]
        ],
        ["CRITICAL", "HIGH", "MEDIUM"],
        default="LOW",
    )
    return df
