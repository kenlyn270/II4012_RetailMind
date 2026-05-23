import express from "express";
import { queryOne } from "../db/database.js";
import { getInferenceHealth } from "../services/inferenceService.js";

const router = express.Router();

async function checkDatabase() {
  const started = Date.now();
  try {
    const row = await queryOne("SELECT NOW() as now, current_database() as database, current_user as user");
    return {
      status: "healthy",
      latencyMs: Date.now() - started,
      database: row?.database,
      user: row?.user,
      timestamp: row?.now,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - started,
      error: error.message,
    };
  }
}

async function getCounts() {
  try {
    return await queryOne(`
      SELECT
        (SELECT COUNT(*)::int FROM customer_contacts) AS contacts,
        (SELECT COUNT(*)::int FROM customer_segments) AS segments,
        (SELECT COUNT(*)::int FROM datasets) AS datasets,
        (SELECT COUNT(*)::int FROM campaigns) AS campaigns,
        (SELECT COUNT(*)::int FROM campaign_jobs) AS campaign_jobs
    `);
  } catch (error) {
    return { error: error.message };
  }
}

async function getLatestDataset() {
  try {
    const row = await queryOne(`
      SELECT
        d.id,
        d.name,
        d.row_count,
        d.customer_count,
        d.uploaded_at,
        p.model_version,
        p.created_at AS profiled_at
      FROM datasets d
      LEFT JOIN LATERAL (
        SELECT model_version, created_at
        FROM dataset_profiles
        WHERE dataset_id = d.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON TRUE
      ORDER BY d.uploaded_at DESC
      LIMIT 1
    `);
    return row || null;
  } catch (error) {
    return { error: error.message };
  }
}

router.get("/status", async (req, res) => {
  const [database, inference, counts, latestDataset] = await Promise.all([
    checkDatabase(),
    getInferenceHealth(),
    getCounts(),
    getLatestDataset(),
  ]);

  const normalizedInference = {
    status: inference.status === "healthy" ? "healthy" : inference.status || "unhealthy",
    ...inference,
  };

  const overall = database.status === "healthy" && normalizedInference.status === "healthy"
    ? "healthy"
    : database.status === "healthy"
      ? "degraded"
      : "unhealthy";

  res.json({
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      api: { status: "healthy" },
      database,
      inference: normalizedInference,
    },
    counts,
    latestDataset,
    config: {
      broadcastEnabled: process.env.BROADCAST_ENABLED === "true",
      inferenceUrl: process.env.INFERENCE_URL || "http://localhost:8001",
    },
  });
});

export default router;
