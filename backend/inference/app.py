from fastapi import FastAPI, HTTPException
import pandas as pd
import os
from contextlib import asynccontextmanager
from typing import Dict, Any

from .schemas import (
    TransactionsRequest, RFMRequest, ScoreResponse, 
    HealthResponse, DatasetProfile
)
from .rfm import aggregate_rfm
from .predictor import Predictor
from .calibration import build_profile, apply_profile
from .recommendations import build_action, build_explanation

# Global predictor instance
predictor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global predictor
    model_path = os.getenv("MODEL_PATH", "backend/model/retail_ai_model_assets.joblib")
    print(f"Loading model from {model_path}...")
    try:
        predictor = Predictor(model_path)
        print(f"Model loaded: version {predictor.metadata.get('version')}")
    except Exception as e:
        print(f"CRITICAL: Failed to load model: {e}")
    yield

app = FastAPI(title="RetailMind Inference Service", lifespan=lifespan)

@app.get("/health", response_model=HealthResponse)
async def health():
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {
        "status": "healthy",
        "model_version": predictor.metadata.get("version", "unknown"),
        "trained_at": predictor.metadata.get("export_date"),
        "k_clusters": predictor.metadata.get("k_clusters")
    }

@app.post("/score/from-transactions", response_model=ScoreResponse)
async def score_from_transactions(req: TransactionsRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # 1. Convert request to DataFrame (use internal field names)
    df_tx = pd.DataFrame([t.model_dump() for t in req.transactions])
    if df_tx.empty:
        raise HTTPException(status_code=422, detail="Empty transaction list")
        
    # 2. Aggregate RFM
    try:
        rfm = aggregate_rfm(df_tx, snapshot_date=req.snapshot_date)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"RFM Aggregation failed: {e}")
        
    if rfm.empty:
        raise HTTPException(status_code=422, detail="No valid customers found after cleaning")

    # 3. Score with Baseline
    scored = predictor.score(rfm)
    
    # 4. Calibrate (Build Profile)
    profile_dict = build_profile(
        scored, 
        dataset_id=req.dataset_id, 
        model_version=predictor.metadata.get("version", "unknown")
    )
    
    # 5. Apply Profile (Tiers)
    enriched = apply_profile(scored, profile_dict)
    
    # 6. Recommendations
    enriched["RecommendedAction"] = enriched.apply(build_action, axis=1)
    enriched["explanation"]       = enriched.apply(lambda r: build_explanation(r, profile_dict), axis=1)
    
    return {
        "dataset_id": req.dataset_id,
        "profile": profile_dict,
        "customers": enriched.to_dict(orient="records")
    }

@app.post("/score/from-rfm", response_model=ScoreResponse)
async def score_from_rfm(req: RFMRequest):
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Use internal field names
    rfm = pd.DataFrame([c.model_dump() for c in req.customers])
    if rfm.empty:
        raise HTTPException(status_code=422, detail="Empty customer list")
    
    # 3. Score with Baseline
    scored = predictor.score(rfm)
    
    # 4. Calibrate
    profile_dict = build_profile(
        scored, 
        dataset_id=req.dataset_id, 
        model_version=predictor.metadata.get("version", "unknown")
    )
    
    # 5. Apply Profile
    enriched = apply_profile(scored, profile_dict)
    
    # 6. Recommendations
    enriched["RecommendedAction"] = enriched.apply(build_action, axis=1)
    enriched["explanation"]       = enriched.apply(lambda r: build_explanation(r, profile_dict), axis=1)
    
    return {
        "dataset_id": req.dataset_id,
        "profile": profile_dict,
        "customers": enriched.to_dict(orient="records")
    }

@app.post("/calibrate")
async def calibrate(req: RFMRequest):
    """
    Dry-run endpoint to see the profile without full enrichment.
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
        
    rfm = pd.DataFrame([c.model_dump() for c in req.customers])
    scored = predictor.score(rfm)
    profile_dict = build_profile(scored, req.dataset_id, predictor.metadata.get("version", "unknown"))
    
    return profile_dict
