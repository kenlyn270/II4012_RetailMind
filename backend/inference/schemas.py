from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class Transaction(BaseModel):
    customer_id: str = Field(..., alias="Customer ID")
    Invoice:     str
    InvoiceDate: datetime
    Quantity:    int
    Price:       float
    TotalPrice:  Optional[float] = None
    Country:     Optional[str] = None
    
    class Config:
        populate_by_name = True

class TransactionsRequest(BaseModel):
    dataset_id: str
    snapshot_date: Optional[datetime] = None
    transactions: List[Transaction]

class CustomerRFM(BaseModel):
    customer_id: str = Field(..., alias="Customer ID")
    Recency:    int   = Field(..., ge=0)
    Frequency:  int   = Field(..., ge=1)
    Monetary:   float = Field(..., ge=0)
    Country:    Optional[str] = None
    
    class Config:
        populate_by_name = True

class RFMRequest(BaseModel):
    dataset_id: str
    customers: List[CustomerRFM]

class DatasetProfile(BaseModel):
    dataset_id: str
    model_version: str
    calibrated_at: datetime
    n_customers: int
    rfm_stats: Dict[str, Dict[str, float]]
    cltv_thresholds: Dict[str, float]
    churn_levels: Dict[str, float]
    cluster_distribution: Dict[str, float]

class EnrichedCustomer(BaseModel):
    customer_id: str
    Recency: int
    Frequency: int
    Monetary: float
    Country: Optional[str] = None
    anomaly_label: int
    anomaly_score: float
    churn_risk_score: float
    churn_risk_level: str
    KMeansCluster: int
    KMeansSegment: str
    cltv_6_months: float
    CLTVSegment: str
    RecommendedAction: str
    explanation: str

class ScoreResponse(BaseModel):
    dataset_id: str
    profile: DatasetProfile
    customers: List[EnrichedCustomer]

class HealthResponse(BaseModel):
    status: str
    model_version: str
    trained_at: Optional[str] = None
    k_clusters: Optional[int] = None
