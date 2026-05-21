import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDatabase } from "./db/database.js";
import segmentsRouter from "./routes/segments.js";
import campaignsRouter from "./routes/campaigns.js";
import webhooksRouter from "./routes/webhooks.js";
import { startWorker } from "./workers/dispatchWorker.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Routes
app.use("/api/segments", segmentsRouter);
app.use("/api/campaigns", campaignsRouter);

// Fonnte webhook routes
// Public-facing (registered in Fonnte dashboard):
//   - POST/GET /webhook/fonnte
//   - POST/GET /webhook/fonnte/connect
//   - POST/GET /webhook/fonnte/message-status
app.use("/webhook/fonnte", webhooksRouter);

// Internal API (backward compatibility):
//   - POST /api/webhooks/fonnte/message-status
app.use("/api/webhooks/fonnte", webhooksRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 RetailMind server running on http://localhost:${PORT}`);

  // Start dispatch worker if broadcast is enabled
  if (process.env.BROADCAST_ENABLED === "true") {
    startWorker();
  }
});

export default app;
