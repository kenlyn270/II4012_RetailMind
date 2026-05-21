/**
 * Webhooks API Routes
 * Handles Fonnte status callbacks and inbound messages (opt-out detection).
 */
import { Router } from "express";
import db from "../db/database.js";

const router = Router();

// Fonnte status mapping
const FONNTE_STATUS_MAP = {
  sent: "sent",
  processing: "queued",
  pending: "queued",
  waiting: "queued",
  invalid: "failed",
  failed: "failed",
  expired: "failed",
};

const FONNTE_STATE_MAP = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

// Opt-out keywords
const OPT_OUT_KEYWORDS = ["stop", "berhenti", "unsubscribe", "jangan kirim"];

// GET /webhook/fonnte - Fonnte webhook verification
router.get("/", (req, res) => {
  res.json({ status: "ok", service: "RetailMind Fonnte Webhook" });
});

// POST /webhook/fonnte - Main inbound webhook (incoming messages)
router.post("/", (req, res) => {
  try {
    const { sender, message, device } = req.body;
    console.log(`📩 Incoming message from ${sender}: ${message}`);

    if (!sender || !message) {
      return res.status(400).json({ error: "Missing sender or message" });
    }

    const normalizedMessage = message.trim().toLowerCase();
    const isOptOut = OPT_OUT_KEYWORDS.some((kw) => normalizedMessage.includes(kw));

    if (isOptOut) {
      const phone = sender.replace(/^\+/, "");
      db.prepare(`
        INSERT OR IGNORE INTO broadcast_blacklist (phone, reason, source)
        VALUES (?, 'Customer opted out via reply', 'inbound_webhook')
      `).run(phone);
      db.prepare(`
        UPDATE customer_contacts SET whatsapp_opt_in = 0, updated_at = datetime('now')
        WHERE phone = ?
      `).run(phone);
      db.prepare(`
        UPDATE campaign_jobs SET status = 'failed', error_message = 'Customer opted out'
        WHERE phone = ? AND status IN ('pending', 'queued')
      `).run(phone);
      console.log(`🚫 Opt-out processed for ${phone}`);
      return res.json({ ok: true, optOut: true, phone });
    }

    res.json({ ok: true, optOut: false });
  } catch (error) {
    console.error("Inbound webhook error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /webhook/fonnte/connect - Fonnte connect webhook verification
router.get("/connect", (req, res) => {
  res.json({ status: "ok", service: "RetailMind Fonnte Connect Webhook" });
});

// POST /webhook/fonnte/connect - Device connection status
router.post("/connect", (req, res) => {
  try {
    const { device, status } = req.body;
    console.log(`📱 Device connection status: ${device} - ${status}`);
    res.json({ ok: true, device, status });
  } catch (error) {
    console.error("Connect webhook error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /webhook/fonnte/message-status - Verification endpoint
router.get("/message-status", (req, res) => {
  res.json({ status: "ok", service: "RetailMind Fonnte Message Status Webhook" });
});

// POST /webhook/fonnte/message-status (also serves /api/webhooks/message-status)
router.post("/message-status", (req, res) => {
  try {
    const { id, status, state } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing message id" });
    }

    // Find the job by fonnte_message_id
    const job = db.prepare(
      "SELECT * FROM campaign_jobs WHERE fonnte_message_id = ?"
    ).get(String(id));

    if (!job) {
      // Not a campaign message, ignore
      return res.json({ ok: true, matched: false });
    }

    // Determine new status from Fonnte's response
    let newStatus = null;
    if (state && FONNTE_STATE_MAP[state]) {
      newStatus = FONNTE_STATE_MAP[state];
    } else if (status && FONNTE_STATUS_MAP[status]) {
      newStatus = FONNTE_STATUS_MAP[status];
    }

    if (!newStatus) {
      return res.json({ ok: true, matched: true, updated: false });
    }

    // Update job status with timestamp
    const timestampField = `${newStatus}_at`;
    const validFields = ["sent_at", "delivered_at", "read_at", "failed_at"];

    if (validFields.includes(timestampField)) {
      db.prepare(`
        UPDATE campaign_jobs 
        SET status = ?, ${timestampField} = datetime('now')
        WHERE id = ? AND fonnte_message_id = ?
      `).run(newStatus, job.id, String(id));
    } else {
      db.prepare(`
        UPDATE campaign_jobs SET status = ? WHERE id = ?
      `).run(newStatus, job.id);
    }

    res.json({ ok: true, matched: true, updated: true, newStatus });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
