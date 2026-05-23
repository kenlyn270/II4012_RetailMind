/**
 * Inference Service
 * Client for the Python-based RetailMind Inference microservice.
 */
import dotenv from "dotenv";

dotenv.config();

const INFERENCE_URL = process.env.INFERENCE_URL || "http://localhost:8001";

/**
 * Perform scoring from a list of transactions.
 * Returns enriched customer data and a calibration profile.
 */
export async function scoreFromTransactions({ datasetId, transactions, snapshotDate }) {
  const payload = {
    dataset_id: datasetId,
    snapshot_date: snapshotDate instanceof Date ? snapshotDate.toISOString() : snapshotDate,
    transactions: transactions.map(tx => ({
      "Customer ID": tx.customer_id,
      "Invoice":     tx.Invoice,
      "InvoiceDate": tx.InvoiceDate instanceof Date ? tx.InvoiceDate.toISOString() : tx.InvoiceDate,
      "Quantity":    tx.Quantity,
      "Price":       tx.Price,
      "TotalPrice":  tx.TotalPrice,
      "Country":     tx.Country
    }))
  };

  const response = await fetch(`${INFERENCE_URL}/score/from-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inference service error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Perform scoring from pre-computed RFM data.
 */
export async function scoreFromRFM({ datasetId, customers }) {
  const payload = {
    dataset_id: datasetId,
    customers: customers.map(c => ({
      "Customer ID": c.customer_id,
      "Recency":    c.Recency,
      "Frequency":  c.Frequency,
      "Monetary":   c.Monetary,
      "Country":    c.Country
    }))
  };

  const response = await fetch(`${INFERENCE_URL}/score/from-rfm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Inference service error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get health status of the inference service.
 */
export async function getInferenceHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${INFERENCE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return { status: "unhealthy", code: response.status };
    return response.json();
  } catch (error) {
    return { status: "offline", error: error.message };
  }
}
