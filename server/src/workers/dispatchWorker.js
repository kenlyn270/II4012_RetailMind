/**
 * Dispatch Worker
 * Polling-based worker that processes pending campaign jobs.
 * Sends messages via Fonnte with rate limiting and delay.
 */
import db from "../db/database.js";
import { sendWhatsAppMessage, dryRunSend } from "../services/fonnteService.js";

const BATCH_SIZE = parseInt(process.env.BROADCAST_BATCH_SIZE) || 10;
const MIN_DELAY = parseInt(process.env.BROADCAST_MIN_DELAY_SEC) || 8;
const MAX_DELAY = parseInt(process.env.BROADCAST_MAX_DELAY_SEC) || 20;
const DAILY_LIMIT = parseInt(process.env.BROADCAST_DAILY_LIMIT) || 100;
const POLL_INTERVAL_MS = 30000; // 30 seconds

let isRunning = false;
let pollTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return (MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)) * 1000;
}

/**
 * Get today's sent count to enforce daily limit
 */
function getTodaySentCount() {
  const today = new Date().toISOString().split("T")[0];
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM campaign_jobs
    WHERE sent_at IS NOT NULL AND sent_at >= ?
  `).get(today);
  return result.count;
}

/**
 * Process a single batch of pending jobs
 */
async function processBatch() {
  // Check daily limit
  const sentToday = getTodaySentCount();
  if (sentToday >= DAILY_LIMIT) {
    console.log(`⚠️  Daily limit reached (${sentToday}/${DAILY_LIMIT}). Skipping batch.`);
    return;
  }

  // Get running campaigns
  const runningCampaigns = db.prepare(`
    SELECT id FROM campaigns WHERE status = 'running'
  `).all();

  if (runningCampaigns.length === 0) return;

  for (const campaign of runningCampaigns) {
    // Re-check campaign status (might have been paused/cancelled)
    const current = db.prepare("SELECT status FROM campaigns WHERE id = ?").get(campaign.id);
    if (!current || current.status !== "running") continue;

    // Fetch pending jobs for this campaign
    const remainingCapacity = DAILY_LIMIT - getTodaySentCount();
    const batchSize = Math.min(BATCH_SIZE, remainingCapacity);
    if (batchSize <= 0) break;

    const jobs = db.prepare(`
      SELECT * FROM campaign_jobs
      WHERE campaign_id = ? AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(campaign.id, batchSize);

    if (jobs.length === 0) {
      // Check if all jobs are done
      const pending = db.prepare(`
        SELECT COUNT(*) as count FROM campaign_jobs
        WHERE campaign_id = ? AND status IN ('pending', 'generating', 'queued')
      `).get(campaign.id);

      if (pending.count === 0) {
        db.prepare(`
          UPDATE campaigns SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(campaign.id);
        console.log(`✅ Campaign ${campaign.id} completed`);
      }
      continue;
    }

    console.log(`📤 Processing ${jobs.length} jobs for campaign ${campaign.id}`);

    for (const job of jobs) {
      // Re-check campaign status before each send
      const check = db.prepare("SELECT status FROM campaigns WHERE id = ?").get(campaign.id);
      if (!check || check.status !== "running") {
        console.log(`⏸️  Campaign ${campaign.id} no longer running. Stopping batch.`);
        break;
      }

      // Check if message exists
      if (!job.generated_message) {
        db.prepare(`
          UPDATE campaign_jobs SET status = 'failed', error_message = 'No message generated', failed_at = datetime('now')
          WHERE id = ?
        `).run(job.id);
        continue;
      }

      try {
        // Mark as queued
        db.prepare(`
          UPDATE campaign_jobs SET status = 'queued', queued_at = datetime('now') WHERE id = ?
        `).run(job.id);

        // Send via Fonnte (or dry-run if no token)
        let result;
        if (!process.env.FONNTE_TOKEN) {
          result = dryRunSend({ target: job.phone, message: job.generated_message });
        } else {
          result = await sendWhatsAppMessage({ target: job.phone, message: job.generated_message });
        }

        // Mark as sent
        db.prepare(`
          UPDATE campaign_jobs 
          SET status = 'sent', 
              fonnte_message_id = ?, 
              fonnte_request_id = ?,
              sent_at = datetime('now')
          WHERE id = ?
        `).run(result.messageId, result.requestId, job.id);

        // Update last_marketing_sent_at on contact
        db.prepare(`
          UPDATE customer_contacts SET last_marketing_sent_at = datetime('now'), updated_at = datetime('now')
          WHERE customer_id = ?
        `).run(job.customer_id);

        console.log(`  ✓ Sent to ${job.phone} (job ${job.id.slice(0, 8)})`);
      } catch (error) {
        db.prepare(`
          UPDATE campaign_jobs 
          SET status = 'failed', error_message = ?, failed_at = datetime('now')
          WHERE id = ?
        `).run(error.message, job.id);
        console.error(`  ✗ Failed ${job.phone}: ${error.message}`);

        // Auto-pause if too many failures (>20% of batch)
        const failedInBatch = db.prepare(`
          SELECT COUNT(*) as count FROM campaign_jobs
          WHERE campaign_id = ? AND status = 'failed' AND failed_at >= datetime('now', '-5 minutes')
        `).get(campaign.id);

        if (failedInBatch.count > batchSize * 0.2) {
          console.log(`🛑 Too many failures. Auto-pausing campaign ${campaign.id}`);
          db.prepare(`UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?`).run(campaign.id);
          break;
        }
      }

      // Delay between messages
      await sleep(randomDelay());
    }
  }
}

/**
 * Start the dispatch worker
 */
export function startWorker() {
  if (isRunning) return;
  isRunning = true;

  console.log("🔄 Dispatch worker started (polling every 30s)");

  const poll = async () => {
    if (!isRunning) return;
    try {
      await processBatch();
    } catch (error) {
      console.error("Worker error:", error.message);
    }
    if (isRunning) {
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  poll();
}

/**
 * Stop the dispatch worker
 */
export function stopWorker() {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log("⏹️  Dispatch worker stopped");
}

export { processBatch };
