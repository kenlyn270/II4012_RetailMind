import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from backend.inference.app import app
import os
import pandas as pd

@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_lifespan():
    # Explicitly trigger lifespan for tests
    from backend.inference.app import lifespan
    async with lifespan(app):
        yield

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "model_version" in response.json()

@pytest.mark.asyncio
async def test_score_from_rfm(client):
    payload = {
        "dataset_id": "test_ds",
        "customers": [
            {"Customer ID": "C1", "Recency": 10, "Frequency": 5, "Monetary": 1000},
            {"Customer ID": "C2", "Recency": 100, "Frequency": 2, "Monetary": 100}
        ]
    }
    response = await client.post("/score/from-rfm", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["dataset_id"] == "test_ds"
    assert "profile" in data
    assert len(data["customers"]) == 2
    assert "churn_risk_score" in data["customers"][0]
    assert "KMeansSegment" in data["customers"][0]

@pytest.mark.asyncio
async def test_score_from_transactions(client):
    payload = {
        "dataset_id": "test_ds_tx",
        "transactions": [
            {"Customer ID": "C1", "Invoice": "1001", "InvoiceDate": "2025-01-01T10:00:00", "Quantity": 2, "Price": 50.0},
            {"Customer ID": "C1", "Invoice": "1002", "InvoiceDate": "2025-01-10T10:00:00", "Quantity": 1, "Price": 100.0},
            {"Customer ID": "C2", "Invoice": "1003", "InvoiceDate": "2025-01-05T10:00:00", "Quantity": 5, "Price": 10.0}
        ]
    }
    response = await client.post("/score/from-transactions", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data["customers"]) == 2 # C1 and C2
    assert "profile" in data
    
@pytest.mark.asyncio
async def test_calibrate(client):
    payload = {
        "dataset_id": "test_ds",
        "customers": [
            {"Customer ID": "C1", "Recency": 10, "Frequency": 5, "Monetary": 1000},
            {"Customer ID": "C2", "Recency": 100, "Frequency": 2, "Monetary": 100}
        ]
    }
    response = await client.post("/calibrate", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert "cltv_thresholds" in data
    assert data["n_customers"] == 2
