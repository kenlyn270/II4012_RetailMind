/*
 * Segment Resolver Service
 * Queries customer_segments + customer_contacts to resolve eligible audiences.
 */
import { queryMany, queryOne } from "../db/database.js";

// 4 K-Means segments per backend/docs/pipeline_documentation.md (Section 2.4.4)
const SEGMENT_DEFINITIONS = {
  high_value: {
    label: "High Value",
    description: "Frequent, high-spending customers (Avg Recency 27h, Frequency 19, Monetary 11K)",
    query: `
      SELECT cs.* FROM customer_segments cs
      WHERE cs.kmeans_segment = 'High Value'
    `,
  },
  at_risk: {
    label: "At Risk",
    description: "Mid-value customers slipping away (Avg Recency 228h, Frequency 5, Monetary 2K)",
    query: `
      SELECT cs.* FROM customer_segments cs
      WHERE cs.kmeans_segment = 'At Risk'
    `,
  },
  hibernating: {
    label: "Hibernating",
    description: "Long-inactive low-value customers (Avg Recency 396h, Frequency 1.4, Monetary 326)",
    query: `
      SELECT cs.* FROM customer_segments cs
      WHERE cs.kmeans_segment = 'Hibernating'
    `,
  },
  new_occasional: {
    label: "New / Occasional",
    description: "Recent but infrequent buyers (Avg Recency 28h, Frequency 3, Monetary 865)",
    query: `
      SELECT cs.* FROM customer_segments cs
      WHERE cs.kmeans_segment IN ('New / Occasional', 'New/Occasional', 'New/Ocassional')
    `,
  },
};

export async function getAllSegments() {
  const results = [];
  for (const [id, def] of Object.entries(SEGMENT_DEFINITIONS)) {
    const row = await queryOne(`SELECT COUNT(*)::int as total FROM (${def.query}) seg`);
    results.push({
      id,
      label: def.label,
      description: def.description,
      totalCustomers: row.total,
    });
  }
  return results;
}

export async function getSegmentPreview(segmentId, limit = 10) {
  const def = SEGMENT_DEFINITIONS[segmentId];
  if (!def) return null;

  const frequencyCapDays = parseInt(process.env.BROADCAST_FREQUENCY_CAP_DAYS, 10) || 7;

  const { total: totalModelMatches } = await queryOne(`SELECT COUNT(*)::int as total FROM (${def.query}) seg`);

  const { total: missingPhone } = await queryOne(`
    SELECT COUNT(*)::int as total FROM (${def.query}) seg
    LEFT JOIN customer_contacts cc ON cc.customer_id = seg.customer_id
    WHERE cc.phone IS NULL
  `);

  const { total: notOptedIn } = await queryOne(`
    SELECT COUNT(*)::int as total FROM (${def.query}) seg
    JOIN customer_contacts cc ON cc.customer_id = seg.customer_id
    WHERE cc.whatsapp_opt_in = FALSE
  `);

  const { total: blacklisted } = await queryOne(`
    SELECT COUNT(*)::int as total FROM (${def.query}) seg
    JOIN customer_contacts cc ON cc.customer_id = seg.customer_id
    JOIN broadcast_blacklist bl ON bl.phone = cc.phone
  `);

  const { total: frequencyCapped } = await queryOne(`
    SELECT COUNT(*)::int as total FROM (${def.query}) seg
    JOIN customer_contacts cc ON cc.customer_id = seg.customer_id
    WHERE cc.whatsapp_opt_in = TRUE
      AND cc.last_marketing_sent_at IS NOT NULL
      AND cc.last_marketing_sent_at > NOW() - ($1 || ' days')::INTERVAL
  `, [String(frequencyCapDays)]);

  const eligibleContacts = totalModelMatches - missingPhone - notOptedIn - blacklisted - frequencyCapped;

  const sample = await queryMany(`
    SELECT
      seg.customer_id,
      cc.display_name,
      cc.phone,
      seg.segment,
      seg.churn_risk_score,
      seg.cltv_6_months,
      seg.kmeans_segment,
      seg.recommended_action
    FROM (${def.query}) seg
    JOIN customer_contacts cc ON cc.customer_id = seg.customer_id
    LEFT JOIN broadcast_blacklist bl ON bl.phone = cc.phone
    WHERE cc.whatsapp_opt_in = TRUE
      AND bl.phone IS NULL
      AND (cc.last_marketing_sent_at IS NULL OR cc.last_marketing_sent_at <= NOW() - ($1 || ' days')::INTERVAL)
    LIMIT $2
  `, [String(frequencyCapDays), limit]);

  const maskedSample = sample.map((s) => ({
    customerId: s.customer_id,
    displayName: s.display_name,
    phoneMasked: s.phone ? s.phone.slice(0, 5) + "****" + s.phone.slice(-3) : null,
    segment: s.segment,
    kmeansSegment: s.kmeans_segment,
    churnRiskScore: Math.round(Number(s.churn_risk_score || 0) * 100) / 100,
    cltv6Months: Math.round(Number(s.cltv_6_months || 0) * 100) / 100,
    recommendedAction: s.recommended_action,
  }));

  return {
    segmentId,
    label: def.label,
    totalModelMatches,
    eligibleContacts: Math.max(0, eligibleContacts),
    excluded: { missingPhone, notOptedIn, blacklisted, frequencyCapped },
    sample: maskedSample,
  };
}

export async function getEligibleCustomers(segmentId) {
  const def = SEGMENT_DEFINITIONS[segmentId];
  if (!def) return [];

  const frequencyCapDays = parseInt(process.env.BROADCAST_FREQUENCY_CAP_DAYS, 10) || 7;

  return queryMany(`
    SELECT
      seg.customer_id,
      cc.phone,
      cc.display_name,
      seg.segment,
      seg.kmeans_segment,
      seg.churn_risk_score,
      seg.cltv_6_months,
      seg.cltv_segment,
      seg.recommended_action,
      seg.recency,
      seg.frequency,
      seg.monetary
    FROM (${def.query}) seg
    JOIN customer_contacts cc ON cc.customer_id = seg.customer_id
    LEFT JOIN broadcast_blacklist bl ON bl.phone = cc.phone
    WHERE cc.whatsapp_opt_in = TRUE
      AND bl.phone IS NULL
      AND (cc.last_marketing_sent_at IS NULL OR cc.last_marketing_sent_at <= NOW() - ($1 || ' days')::INTERVAL)
  `, [String(frequencyCapDays)]);
}

export { SEGMENT_DEFINITIONS };
