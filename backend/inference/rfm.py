import pandas as pd
import numpy as np

def aggregate_rfm(transactions: pd.DataFrame, snapshot_date: pd.Timestamp = None) -> pd.DataFrame:
    """
    Cleans transactions and aggregates them into RFM features.
    Matches the logic used in the training pipeline.
    """
    df = transactions.copy()
    
    # 1. Cleaning
    # Ensure Customer ID is present
    df = df.dropna(subset=["customer_id"])
    
    # Remove cancellations (Invoices starting with 'C')
    df["Invoice"] = df["Invoice"].astype(str)
    df = df[~df["Invoice"].str.startswith("C")]
    
    # Ensure Quantity and Price are positive
    df = df[(df["Quantity"] > 0) & (df["Price"] > 0)]
    
    # Calculate TotalPrice if not present
    if "TotalPrice" not in df.columns or df["TotalPrice"].isnull().all():
        df["TotalPrice"] = df["Quantity"] * df["Price"]
        
    # Ensure InvoiceDate is datetime
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])
    
    if df.empty:
        return pd.DataFrame()

    # 2. Aggregation
    # snapshot_date is the reference point for Recency (default: max date + 1 day)
    snapshot = snapshot_date or (df["InvoiceDate"].max() + pd.Timedelta(days=1))
    
    rfm = df.groupby("customer_id").agg(
        Recency=("InvoiceDate", lambda x: (snapshot - x.max()).days),
        Frequency=("Invoice", "nunique"),
        Monetary=("TotalPrice", "sum"),
        Country=("Country", lambda x: x.mode().iat[0] if not x.mode().empty else None),
    ).reset_index()
    
    # Rename customer_id to match expected schema if needed, 
    # but schemas.py uses customer_id as field name.
    
    return rfm
