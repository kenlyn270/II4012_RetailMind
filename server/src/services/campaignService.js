/**
 * Campaign Service
 * CRUD operations for campaigns and campaign jobs.
 */
import db from "../db/database.js";
import { v4 as uuidv4 } from "uuid";
import { getEligibleCustomers } from "./segmentService.js";
import { getPromoBySegment } from "./copywriterService.js";

/**
 * Create a new campaign
 */
export function createCampaign({
  name,
  segmentFilter,
  goal,
  campaignBrief,
  messageTemplate,
  createdBy,
}) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO campaigns (id, name, segment_filter, goal, campaign_brief, message_template, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
  `);
  stmt.run(
    id,
    name,
    JSON.stringify(segmentFilter),
    goal,
    campaignBrief,
    messageTemplate || null,
    createdBy || "admin",
  );
  return getCampaignById(id);
}

/**
 * Get all campaigns
 */
export function getAllCampaigns() {
  const campaigns = db
    .prepare(
      `
    SELECT * FROM campaigns ORDER BY created_at DESC
  `,
    )
    .all();

  return campaigns.map((c) => {
    const jobStats = db
      .prepare(
        `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as "read"
      FROM campaign_jobs WHERE campaign_id = ?
    `,
      )
      .get(c.id);

    return {
      ...c,
      segment_filter: JSON.parse(c.segment_filter),
      jobs: jobStats,
    };
  });
}

/**
 * Get campaign by ID with job stats
 */
export function getCampaignById(id) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return null;

  const jobStats = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'generating' THEN 1 ELSE 0 END) as generating,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as "read",
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM campaign_jobs WHERE campaign_id = ?
  `,
    )
    .get(id);

  return {
    ...campaign,
    segment_filter: JSON.parse(campaign.segment_filter),
    jobs: jobStats,
  };
}

/**
 * Update campaign fields
 */
export function updateCampaign(id, updates) {
  const allowed = [
    "name",
    "goal",
    "campaign_brief",
    "message_template",
    "status",
    "scheduled_at",
  ];
  const sets = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) return getCampaignById(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE campaigns SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getCampaignById(id);
}

/**
 * Approve a campaign - generates jobs for all eligible customers
 */
export function approveCampaign(id) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "draft")
    throw new Error("Campaign must be in draft status to approve");

  const segmentFilter = JSON.parse(campaign.segment_filter);
  const segmentId = segmentFilter.segmentId;

  // Get eligible customers
  const customers = getEligibleCustomers(segmentId);
  if (customers.length === 0)
    throw new Error("No eligible customers found for this segment");

  // Apply max recipients limit if set
  const maxRecipients = segmentFilter.maxRecipients || customers.length;
  const targetCustomers = customers.slice(0, maxRecipients);

  // Create campaign jobs
  const insertJob = db.prepare(`
    INSERT INTO campaign_jobs (id, campaign_id, customer_id, phone, display_name, segment_snapshot, generated_message, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const createJobs = db.transaction((customers) => {
    for (const customer of customers) {
      const snapshot = JSON.stringify({
        segment: customer.segment,
        kmeansSegment: customer.kmeans_segment,
        churnRiskScore: customer.churn_risk_score,
        cltv6Months: customer.cltv_6_months,
        cltvSegment: customer.cltv_segment,
        recommendedAction: customer.recommended_action,
        recency: customer.recency,
        frequency: customer.frequency,
        monetary: customer.monetary,
      });

      const isDemoMode =
        segmentFilter.demoMode === true && segmentFilter.demoTargetPhone;
      const targetPhone = isDemoMode
        ? segmentFilter.demoTargetPhone
        : customer.phone;
      const displayName = isDemoMode
        ? `Demo ${segmentFilter.demoTargetLabel || customer.kmeans_segment || "Segment"}`
        : customer.display_name;
      const promoText = getPromoBySegment(segmentId);

      // Apply message template with token replacement
      let message = null;
      if (campaign.message_template) {
        message = campaign.message_template
          .replace(
            /\{name\}/g,
            `*${displayName || customer.display_name || "Pelanggan"}*`,
          )
          .replace(/\{last_purchase_days\}/g, customer.recency || "?")
          .replace(
            /\{segment\}/g,
            customer.kmeans_segment || customer.segment || "",
          )
          .replace(/\{promo\}/g, promoText)
          .replace(/\{cta_link\}/g, segmentFilter.ctaLink || "#");
      }

      insertJob.run(
        uuidv4(),
        id,
        customer.customer_id,
        targetPhone,
        displayName,
        snapshot,
        message,
      );
    }
  });

  createJobs(targetCustomers);

  // Update campaign status
  db.prepare(
    `
    UPDATE campaigns SET status = 'scheduled', approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(id);

  return getCampaignById(id);
}

/**
 * Trigger campaign - set to running so worker picks it up
 */
export function triggerCampaign(id) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "scheduled" && campaign.status !== "paused") {
    throw new Error("Campaign must be scheduled or paused to trigger");
  }

  db.prepare(
    `
    UPDATE campaigns SET status = 'running', started_at = COALESCE(started_at, datetime('now')), updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(id);

  return getCampaignById(id);
}

/**
 * Pause campaign
 */
export function pauseCampaign(id) {
  db.prepare(
    `
    UPDATE campaigns SET status = 'paused', updated_at = datetime('now')
    WHERE id = ? AND status = 'running'
  `,
  ).run(id);
  return getCampaignById(id);
}

/**
 * Resume campaign
 */
export function resumeCampaign(id) {
  db.prepare(
    `
    UPDATE campaigns SET status = 'running', updated_at = datetime('now')
    WHERE id = ? AND status = 'paused'
  `,
  ).run(id);
  return getCampaignById(id);
}

/**
 * Cancel campaign
 */
export function cancelCampaign(id) {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id);
  if (!campaign) throw new Error("Campaign not found");

  db.prepare(
    `
    UPDATE campaigns SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?
  `,
  ).run(id);

  // Mark pending jobs as cancelled (using failed status)
  db.prepare(
    `
    UPDATE campaign_jobs SET status = 'failed', error_message = 'Campaign cancelled'
    WHERE campaign_id = ? AND status IN ('pending', 'generating', 'queued')
  `,
  ).run(id);

  return getCampaignById(id);
}

/**
 * Get jobs for a campaign
 */
export function getCampaignJobs(
  campaignId,
  { limit = 50, offset = 0, status } = {},
) {
  let query = "SELECT * FROM campaign_jobs WHERE campaign_id = ?";
  const params = [campaignId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at ASC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/**
 * Test send - send to a specific number without creating a real job
 */
export function createTestJob(campaignId, phone, message) {
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO campaign_jobs (id, campaign_id, customer_id, phone, display_name, segment_snapshot, generated_message, status)
    VALUES (?, ?, 'TEST', ?, 'Test User', '{}', ?, 'pending')
  `,
  ).run(id, campaignId, phone, message);
  return id;
}
