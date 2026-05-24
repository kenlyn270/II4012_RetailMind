/*
 * Dispatch Worker
 * Polling-based worker that processes pending campaign jobs.
 * Sends messages via Fonnte with rate limiting and delay.
 */
import { queryMany, queryOne } from "../db/database.js";
import { sendWhatsAppMessage, dryRunSend } from "../services/fonnteService.js";

const BATCH_SIZE = parseInt(process.env.BROADCAST_BATCH_SIZE, 10) || 10;
const MIN_DELAY = parseInt(process.env.BROADCAST_MIN_DELAY_SEC, 10) || 8;
const MAX_DELAY = parseInt(process.env.BROADCAST_MAX_DELAY_SEC, 10) || 20;
const DAILY_LIMIT = parseInt(process.env.BROADCAST_DAILY_LIMIT, 10) || 100;
const POLL_INTERVAL_MS = 30000;
const QUEUED_STALE_MINUTES = parseInt(process.env.BROADCAST_QUEUED_STALE_MINUTES, 10) || 15;

let isRunning = false;
let pollTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return (MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)) * 1000;
}

async function getTodaySentCount() {
  const today = new Date().toISOString().split("T")[0];
  const result = await queryOne(`
    SELECT COUNT(*)::int as count FROM campaign_jobs
    WHERE sent_at IS NOT NULL AND sent_at >= $1::date
  `, [today]);
  return result.count;
}

async function releaseQueuedJobs(jobIds, reason = "released") {
  if (!jobIds.length) return;
  await queryOne(`
    UPDATE campaign_jobs
    SET status = 'pending', queued_at = NULL, error_message = NULL
    WHERE id = ANY($1::uuid[]) AND status = 'queued'
    RETURNING id
  `, [jobIds]);
  console.log(`↩️  Released ${jobIds.length} queued jobs back to pending (${reason})`);
}

async function resetStaleQueuedJobs() {
  const result = await queryOne(`
    WITH reset AS (
      UPDATE campaign_jobs cj
      SET status = 'pending', queued_at = NULL, error_message = 'Reset stale queued job'
      FROM campaigns c
      WHERE cj.campaign_id = c.id
        AND cj.status = 'queued'
        AND c.status = 'running'
        AND cj.queued_at < NOW() - ($1 || ' minutes')::INTERVAL
      RETURNING cj.id
    )
    SELECT COUNT(*)::int as count FROM reset
  `, [String(QUEUED_STALE_MINUTES)]);

  if (result.count > 0) {
    console.log(`♻️  Reset ${result.count} stale queued jobs to pending`);
  }
}

export async function processBatch() {
  await resetStaleQueuedJobs();

  const sentToday = await getTodaySentCount();
  if (sentToday >= DAILY_LIMIT) {
    console.log(`⚠️  Daily limit reached (${sentToday}/${DAILY_LIMIT}). Skipping batch.`);
    return;
  }

  const runningCampaigns = await queryMany("SELECT id FROM campaigns WHERE status = 'running'");
  if (runningCampaigns.length === 0) return;

  for (const campaign of runningCampaigns) {
    const current = await queryOne("SELECT status FROM campaigns WHERE id = $1", [campaign.id]);
    if (!current || current.status !== "running") continue;

    const remainingCapacity = DAILY_LIMIT - await getTodaySentCount();
    const batchSize = Math.min(BATCH_SIZE, remainingCapacity);
    if (batchSize <= 0) break;

    // Atomic pickup. Safe if multiple workers are ever started.
    const jobs = await queryMany(`
      UPDATE campaign_jobs
      SET status = 'queued', queued_at = NOW()
      WHERE id IN (
        SELECT id FROM campaign_jobs
        WHERE campaign_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `, [campaign.id, batchSize]);

    if (jobs.length === 0) {
      const pending = await queryOne(`
        SELECT COUNT(*)::int as count FROM campaign_jobs
        WHERE campaign_id = $1 AND status IN ('pending', 'generating', 'queued')
      `, [campaign.id]);

      if (pending.count === 0) {
        await queryOne(`
          UPDATE campaigns SET status = 'completed', completed_at = NOW()
          WHERE id = $1 RETURNING id
        `, [campaign.id]);
        console.log(`✅ Campaign ${campaign.id} completed`);
      }
      continue;
    }

    console.log(`📤 Processing ${jobs.length} jobs for campaign ${campaign.id}`);

    const remainingQueuedJobIds = jobs.map((job) => job.id);

    for (const job of jobs) {
      const check = await queryOne("SELECT status FROM campaigns WHERE id = $1", [campaign.id]);
      if (!check || check.status !== "running") {
        console.log(`⏸️  Campaign ${campaign.id} no longer running. Releasing remaining queued jobs.`);
        await releaseQueuedJobs(remainingQueuedJobIds, "campaign stopped");
        break;
      }

      remainingQueuedJobIds.shift();

      if (!job.generated_message) {
        await queryOne(`
          UPDATE campaign_jobs SET status = 'failed', error_message = 'No message generated', failed_at = NOW()
          WHERE id = $1 RETURNING id
        `, [job.id]);
        continue;
      }

      try {
        let result;
        if (!process.env.FONNTE_TOKEN) {
          result = dryRunSend({ target: job.phone, message: job.generated_message });
        } else {
          result = await sendWhatsAppMessage({ target: job.phone, message: job.generated_message });
        }

        await queryOne(`
          UPDATE campaign_jobs
          SET status = 'sent',
              fonnte_message_id = $1,
              fonnte_request_id = $2,
              sent_at = NOW()
          WHERE id = $3 RETURNING id
        `, [result.messageId, result.requestId, job.id]);

        await queryOne(`
          UPDATE customer_contacts SET last_marketing_sent_at = NOW()
          WHERE customer_id = $1 RETURNING customer_id
        `, [job.customer_id]);

        console.log(`  ✓ Sent to ${job.phone} (job ${job.id.slice(0, 8)})`);
      } catch (error) {
        await queryOne(`
          UPDATE campaign_jobs
          SET status = 'failed', error_message = $1, failed_at = NOW()
          WHERE id = $2 RETURNING id
        `, [error.message, job.id]);
        console.error(`  ✗ Failed ${job.phone}: ${error.message}`);

        const failedInBatch = await queryOne(`
          SELECT COUNT(*)::int as count FROM campaign_jobs
          WHERE campaign_id = $1 AND status = 'failed' AND failed_at >= NOW() - INTERVAL '5 minutes'
        `, [campaign.id]);

        if (failedInBatch.count > batchSize * 0.2) {
          console.log(`🛑 Too many failures. Auto-pausing campaign ${campaign.id}`);
          await queryOne("UPDATE campaigns SET status = 'paused' WHERE id = $1 RETURNING id", [campaign.id]);
          break;
        }
      }

      await sleep(randomDelay());
    }
  }
}

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

export function stopWorker() {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log("⏹️  Dispatch worker stopped");
}
