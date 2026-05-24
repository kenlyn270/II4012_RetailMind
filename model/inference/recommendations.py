import pandas as pd

def build_action(row: pd.Series) -> str:
    """
    Assigns a recommended marketing action based on CLTV, Risk, and RFM scores.
    """
    cltv_seg = row['CLTVSegment']
    risk_score = row['churn_risk_score']
    
    # Heuristic RF scores for "is_new" check
    r_score = 5 if row['Recency'] < 15 else (4 if row['Recency'] < 50 else (3 if row['Recency'] < 150 else (2 if row['Recency'] < 300 else 1)))
    f_score = 1 if row['Frequency'] <= 2 else (2 if row['Frequency'] <= 5 else (3 if row['Frequency'] <= 10 else (4 if row['Frequency'] <= 20 else 5)))
    
    is_new = (r_score >= 4 and f_score <= 2)
    
    if cltv_seg in ['A', 'B'] and risk_score > 75:
        return 'Win-back Priority'
    elif cltv_seg in ['A', 'B'] and risk_score <= 50:
        return 'Loyalty Maintenance'
    elif cltv_seg in ['C', 'D'] and risk_score > 75:
        return 'Low-cost Automation'
    elif is_new:
        return 'Onboarding Campaign'
    else:
        return 'Standard Nurture'

def build_explanation(row: pd.Series, profile: dict) -> str:
    """
    Builds a contextual human-readable explanation using dataset-specific stats.
    """
    rfm_stats = profile.get("rfm_stats", {})
    factors = []
    
    rec_mean = rfm_stats.get("recency", {}).get("mean", 200)
    freq_mean = rfm_stats.get("frequency", {}).get("mean", 6)
    mon_mean  = rfm_stats.get("monetary", {}).get("mean", 3000)

    # Recency check
    if row['Recency'] > rec_mean * 1.5:
        factors.append(f"Inactivity of {int(row['Recency'])} days is significantly above dataset average ({rec_mean:.0f} days).")
    elif row['Recency'] < rec_mean * 0.3:
        factors.append(f"Very recent interaction ({int(row['Recency'])} days ago).")
        
    # Frequency check
    if row['Frequency'] > freq_mean * 2:
        factors.append(f"High historical engagement with {int(row['Frequency'])} distinct transactions (Dataset avg: {freq_mean:.1f}).")
    elif row['Frequency'] <= 2:
        factors.append("Low repeat purchase rate.")
        
    # Monetary check
    if row['Monetary'] > mon_mean * 2:
        factors.append(f"High historical spend, significantly above dataset average.")
    elif row['Monetary'] < mon_mean * 0.2:
        factors.append(f"Low transaction value ({row['Monetary']:,.2f}).")
        
    factors_str = " ".join(factors) if factors else "Standard activity patterns for this dataset."
    
    return (
        f"Customer categorized as '{row['KMeansSegment']}' with Churn Risk level: {row['churn_risk_level']} "
        f"({row['churn_risk_score']:.1f}/100) and CLTV Tier: {row['CLTVSegment']}. Key drivers: {factors_str} "
        f"Action: {row['RecommendedAction']}."
    )
