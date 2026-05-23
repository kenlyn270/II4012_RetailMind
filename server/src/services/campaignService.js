/*
 * Campaign Service
 * CRUD operations for campaigns and campaign jobs.
 */
import { queryMany, queryOne, withTransaction } from "../db/database.js";
import { v4 as uuidv4 } from "uuid";
import { getEligibleCustomers } from "./segmentService.js";
import { getPromoBySegment } from "./copywriterService.js";

function normalizeCampaign(campaign) {
  if (!campaign) return null;
  return {
    ...campaign,
    segment_filter: typeof campaign.segment_filter === "string"
      ? JSON.parse(campaign.segment_filter)
      : campaign.segment_filter,
  };
}

function normalizeJob(job) {
  if (!job) return null;
  return {
    ...job,
    segment_snapshot: typeof job.segment_snapshot === "string"
      ? JSON.parse(job.segment_snapshot)
      : job.segment_snapshot,
  };
}

export async function createCampaign({
  name,
  segmentFilter,
  goal,
  campaignBrief,
  messageTemplate,
  createdBy,
}) {
  const id = uuidv4();
  await queryOne(`
    INSERT INTO campaigns (id, name, segment_filter, goal, campaign_brief, message_template, status, created_by)
    VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'draft', $7)
    RETURNING id
  `, [id, name, JSON.stringify(segmentFilter), goal, campaignBrief, messageTemplate || null, createdBy || "admin"]);
  return getCampaignById(id);
}

export async function getAllCampaigns() {
  const campaigns = await queryMany(`
    SELECT
      c.*,
      COALESCE(js.total, 0)::int as jobs_total,
      COALESCE(js.pending, 0)::int as jobs_pending,
      COALESCE(js.sent, 0)::int as jobs_sent,
      COALESCE(js.delivered, 0)::int as jobs_delivered,
      COALESCE(js.failed, 0)::int as jobs_failed,
      COALESCE(js.read, 0)::int as jobs_read
    FROM campaigns c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'read') as "read"
      FROM campaign_jobs WHERE campaign_id = c.id
    ) js ON TRUE
    ORDER BY c.created_at DESC
  `);

  return campaigns.map((c) => {
    const normalized = normalizeCampaign(c);
    return {
      ...normalized,
      jobs: {
        total: c.jobs_total,
        pending: c.jobs_pending,
        sent: c.jobs_sent,
        delivered: c.jobs_delivered,
        failed: c.jobs_failed,
        read: c.jobs_read,
      },
    };
  });
}

export async function getCampaignById(id) {
  const campaign = await queryOne(`
    SELECT
      c.*,
      COALESCE(js.total, 0)::int as jobs_total,
      COALESCE(js.pending, 0)::int as jobs_pending,
      COALESCE(js.generating, 0)::int as jobs_generating,
      COALESCE(js.queued, 0)::int as jobs_queued,
      COALESCE(js.sent, 0)::int as jobs_sent,
      COALESCE(js.delivered, 0)::int as jobs_delivered,
      COALESCE(js.read, 0)::int as jobs_read,
      COALESCE(js.failed, 0)::int as jobs_failed
    FROM campaigns c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'generating') as generating,
        COUNT(*) FILTER (WHERE status = 'queued') as queued,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'read') as "read",
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM campaign_jobs WHERE campaign_id = c.id
    ) js ON TRUE
    WHERE c.id = $1
  `, [id]);

  if (!campaign) return null;
  const normalized = normalizeCampaign(campaign);
  return {
    ...normalized,
    jobs: {
      total: campaign.jobs_total,
      pending: campaign.jobs_pending,
      generating: campaign.jobs_generating,
      queued: campaign.jobs_queued,
      sent: campaign.jobs_sent,
      delivered: campaign.jobs_delivered,
      read: campaign.jobs_read,
      failed: campaign.jobs_failed,
    },
  };
}

export async function updateCampaign(id, updates) {
  const allowed = ["name", "goal", "campaign_brief", "message_template", "status", "scheduled_at"];
  const sets = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      values.push(value);
      sets.push(`${key} = $${values.length}`);
    }
  }

  if (sets.length === 0) return getCampaignById(id);

  values.push(id);
  await queryOne(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING id`, values);
  return getCampaignById(id);
}

export async function approveCampaign(id) {
  const campaign = await queryOne("SELECT * FROM campaigns WHERE id = $1", [id]);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft") throw new Error("Campaign must be in draft status to approve");

  const segmentFilter = typeof campaign.segment_filter === "string" ? JSON.parse(campaign.segment_filter) : campaign.segment_filter;
  const segmentId = segmentFilter.segmentId;

  const customers = await getEligibleCustomers(segmentId);
  if (customers.length === 0) throw new Error("No eligible customers found for this segment");

  const maxRecipients = segmentFilter.maxRecipients || customers.length;
  const targetCustomers = customers.slice(0, maxRecipients);

  await withTransaction(async (client) => {
    for (const customer of targetCustomers) {
      const snapshot = {
        segment: customer.segment,
        kmeansSegment: customer.kmeans_segment,
        churnRiskScore: customer.churn_risk_score,
        cltv6Months: customer.cltv_6_months,
        cltvSegment: customer.cltv_segment,
        recommendedAction: customer.recommended_action,
        recency: customer.recency,
        frequency: customer.frequency,
        monetary: customer.monetary,
      };

      const isDemoMode = segmentFilter.demoMode === true && segmentFilter.demoTargetPhone;
      const targetPhone = isDemoMode ? segmentFilter.demoTargetPhone : customer.phone;
      const displayName = isDemoMode
        ? `Demo ${segmentFilter.demoTargetLabel || customer.kmeans_segment || "Segment"}`
        : customer.display_name;
      const promoText = getPromoBySegment(segmentId);

      let message = null;
      if (campaign.message_template) {
        message = campaign.message_template
          .replace(/\{name\}/g, `*${displayName || customer.display_name || "Pelanggan"}*`)
          .replace(/\{last_purchase_days\}/g, customer.recency || "?")
          .replace(/\{segment\}/g, customer.kmeans_segment || customer.segment || "")
          .replace(/\{promo\}/g, promoText)
          .replace(/\{cta_link\}/g, segmentFilter.ctaLink || "#");
      }

      await client.query(`
        INSERT INTO campaign_jobs (id, campaign_id, customer_id, phone, display_name, segment_snapshot, generated_message, status)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'pending')
      `, [uuidv4(), id, customer.customer_id, targetPhone, displayName, JSON.stringify(snapshot), message]);
    }

    await client.query(`
      UPDATE campaigns SET status = 'scheduled', approved_at = NOW()
      WHERE id = $1
    `, [id]);
  });

  return getCampaignById(id);
}

export async function triggerCampaign(id) {
  const campaign = await queryOne("SELECT * FROM campaigns WHERE id = $1", [id]);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "scheduled" && campaign.status !== "paused") {
    throw new Error("Campaign must be scheduled or paused to trigger");
  }

  await queryOne(`
    UPDATE campaigns SET status = 'running', started_at = COALESCE(started_at, NOW())
    WHERE id = $1 RETURNING id
  `, [id]);
  return getCampaignById(id);
}

export async function pauseCampaign(id) {
  await queryOne("UPDATE campaigns SET status = 'paused' WHERE id = $1 AND status = 'running' RETURNING id", [id]);
  return getCampaignById(id);
}

export async function resumeCampaign(id) {
  await queryOne("UPDATE campaigns SET status = 'running' WHERE id = $1 AND status = 'paused' RETURNING id", [id]);
  return getCampaignById(id);
}

export async function cancelCampaign(id) {
  const campaign = await queryOne("SELECT * FROM campaigns WHERE id = $1", [id]);
  if (!campaign) throw new Error("Campaign not found");

  await withTransaction(async (client) => {
    await client.query("UPDATE campaigns SET status = 'cancelled' WHERE id = $1", [id]);
    await client.query(`
      UPDATE campaign_jobs SET status = 'failed', error_message = 'Campaign cancelled'
      WHERE campaign_id = $1 AND status IN ('pending', 'generating', 'queued')
    `, [id]);
  });

  return getCampaignById(id);
}

export async function getCampaignJobs(campaignId, { limit = 50, offset = 0, status } = {}) {
  const params = [campaignId];
  let where = "campaign_id = $1";

  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }

  params.push(limit, offset);
  const rows = await queryMany(`
    SELECT * FROM campaign_jobs
    WHERE ${where}
    ORDER BY created_at ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return rows.map(normalizeJob);
}

export async function createTestJob(campaignId, phone, message) {
  const id = uuidv4();
  await queryOne(`
    INSERT INTO campaign_jobs (id, campaign_id, customer_id, phone, display_name, segment_snapshot, generated_message, status)
    VALUES ($1, $2, 'TEST', $3, 'Test User', '{}'::jsonb, $4, 'pending')
    RETURNING id
  `, [id, campaignId, phone, message]);
  return id;
}
