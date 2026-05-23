/*
 * Webhooks API Routes
 * Handles Fonnte status callbacks and inbound messages (opt-out detection).
 */
import { Router } from "express";
import { queryOne, withTransaction } from "../db/database.js";

const router = Router();

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

const OPT_OUT_KEYWORDS = ["stop", "berhenti", "unsubscribe", "jangan kirim"];

router.get("/", (req, res) => {
  res.json({ status: "ok", service: "RetailMind Fonnte Webhook" });
});

router.post("/", async (req, res) => {
  try {
    const { sender, message } = req.body;
    console.log(`📩 Incoming message from ${sender}: ${message}`);

    if (!sender || !message) {
      return res.status(400).json({ error: "Missing sender or message" });
    }

    const normalizedMessage = message.trim().toLowerCase();
    const isOptOut = OPT_OUT_KEYWORDS.some((kw) => normalizedMessage.includes(kw));

    if (isOptOut) {
      const phone = sender.replace(/^\+/, "");
      await withTransaction(async (client) => {
        await client.query(`
          INSERT INTO broadcast_blacklist (phone, reason, source)
          VALUES ($1, 'Customer opted out via reply', 'inbound_webhook')
          ON CONFLICT (phone) DO NOTHING
        `, [phone]);
        await client.query(`
          UPDATE customer_contacts SET whatsapp_opt_in = FALSE
          WHERE phone = $1
        `, [phone]);
        await client.query(`
          UPDATE campaign_jobs SET status = 'failed', error_message = 'Customer opted out'
          WHERE phone = $1 AND status IN ('pending', 'queued')
        `, [phone]);
      });
      console.log(`🚫 Opt-out processed for ${phone}`);
      return res.json({ ok: true, optOut: true, phone });
    }

    res.json({ ok: true, optOut: false });
  } catch (error) {
    console.error("Inbound webhook error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/connect", (req, res) => {
  res.json({ status: "ok", service: "RetailMind Fonnte Connect Webhook" });
});

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

router.get("/message-status", (req, res) => {
  res.json({ status: "ok", service: "RetailMind Fonnte Message Status Webhook" });
});

router.post("/message-status", async (req, res) => {
  try {
    const { id, status, state } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing message id" });
    }

    const job = await queryOne("SELECT * FROM campaign_jobs WHERE fonnte_message_id = $1", [String(id)]);

    if (!job) {
      return res.json({ ok: true, matched: false });
    }

    let newStatus = null;
    if (state && FONNTE_STATE_MAP[state]) {
      newStatus = FONNTE_STATE_MAP[state];
    } else if (status && FONNTE_STATUS_MAP[status]) {
      newStatus = FONNTE_STATUS_MAP[status];
    }

    if (!newStatus) {
      return res.json({ ok: true, matched: true, updated: false });
    }

    const timestampField = `${newStatus}_at`;
    const validFields = ["sent_at", "delivered_at", "read_at", "failed_at"];

    if (validFields.includes(timestampField)) {
      await queryOne(`
        UPDATE campaign_jobs
        SET status = $1, ${timestampField} = NOW()
        WHERE id = $2 AND fonnte_message_id = $3
        RETURNING id
      `, [newStatus, job.id, String(id)]);
    } else {
      await queryOne("UPDATE campaign_jobs SET status = $1 WHERE id = $2 RETURNING id", [newStatus, job.id]);
    }

    res.json({ ok: true, matched: true, updated: true, newStatus });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
