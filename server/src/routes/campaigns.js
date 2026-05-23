/**
 * Campaigns API Routes
 */
import { Router } from "express";
import {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  updateCampaign,
  approveCampaign,
  triggerCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  getCampaignJobs,
} from "../services/campaignService.js";
import { sendWhatsAppMessage, dryRunSend } from "../services/fonnteService.js";
import { generateCampaignMessage } from "../services/copywriterService.js";

const router = Router();

// Demo blast: kirim 1 pesan per segmen ke 4 nomor diskrit (untuk demo webhook).
// AI copywriter tetap berjalan per segmen.
const DEMO_SEGMENTS = [
  { id: "high_value",     label: "High Value",       phone: "6281395261900", goal: "Loyalty maintenance untuk pelanggan top" },
  { id: "at_risk",        label: "At Risk",          phone: "6281347507393", goal: "Win-back pelanggan yang mulai tidak aktif" },
  { id: "hibernating",    label: "Hibernating",      phone: "6281359056906", goal: "Reaktivasi pelanggan hibernasi dengan penawaran ringan" },
  { id: "new_occasional", label: "New / Occasional", phone: "6285117409023", goal: "Onboarding & second-purchase nudge" },
];

const DEMO_TARGET_BY_SEGMENT = Object.fromEntries(
  DEMO_SEGMENTS.map((segment) => [segment.id, segment])
);

function getDemoTarget(segmentId) {
  return DEMO_TARGET_BY_SEGMENT[segmentId] || null;
}

function maskPhone(phone) {
  return phone.slice(0, 5) + "****" + phone.slice(-3);
}

function withDemoRouting(segmentFilter = {}) {
  const demoTarget = getDemoTarget(segmentFilter.segmentId);
  if (!demoTarget) return segmentFilter;

  return {
    ...segmentFilter,
    demoMode: true,
    demoTargetPhone: demoTarget.phone,
    demoTargetLabel: demoTarget.label,
    // MVP/demo safety: regardless of dashboard input, each segment sends to 1 representative number only.
    maxRecipients: 1,
  };
}

// POST /api/campaigns/demo-blast - Kirim 1 pesan AI per segmen ke 4 nomor demo
router.post("/demo-blast", async (req, res) => {
  const { ctaLink = "Balas INFO untuk dibantu admin", promoDetails = null, dryRun = false } = req.body || {};
  const useDryRun = dryRun || !process.env.FONNTE_TOKEN;
  const results = [];

  for (const seg of DEMO_SEGMENTS) {
    try {
      const copy = await generateCampaignMessage({
        segmentId: seg.id,
        segmentLabel: seg.label,
        goal: seg.goal,
        ctaLink,
        promoDetails,
      });

      // Replace tokens with demo values
      const personalized = copy.text
        .replaceAll("{name}", `Pelanggan ${seg.label}`)
        .replaceAll("{last_purchase_days}", "30")
        .replaceAll("{cta_link}", ctaLink);

      const sendResult = useDryRun
        ? dryRunSend({ target: seg.phone, message: personalized })
        : await sendWhatsAppMessage({ target: seg.phone, message: personalized });

      results.push({
        segmentId: seg.id,
        segmentLabel: seg.label,
        phone: seg.phone,
        message: personalized,
        copySource: copy.source,
        copyModel: copy.model,
        cached: copy.cached,
        send: sendResult,
        ok: true,
      });
    } catch (err) {
      results.push({
        segmentId: seg.id,
        segmentLabel: seg.label,
        phone: seg.phone,
        ok: false,
        error: err.message,
      });
    }
  }

  res.json({
    ok: results.every((r) => r.ok),
    dryRun: useDryRun,
    totalSent: results.filter((r) => r.ok).length,
    totalFailed: results.filter((r) => !r.ok).length,
    results,
  });
});

// GET /api/campaigns/demo-blast/targets - Daftar target demo (untuk preview di UI)
router.get("/demo-blast/targets", (req, res) => {
  res.json({
    targets: DEMO_SEGMENTS.map((s) => ({
      segmentId: s.id,
      segmentLabel: s.label,
      phoneMasked: maskPhone(s.phone),
      goal: s.goal,
    })),
  });
});

// POST /api/campaigns - Create a new campaign
router.post("/", async (req, res) => {
  try {
    const { name, segmentFilter, goal, campaignBrief, messageTemplate, createdBy } = req.body;

    if (!name || !segmentFilter || !goal || !campaignBrief) {
      return res.status(400).json({ error: "Missing required fields: name, segmentFilter, goal, campaignBrief" });
    }

    // MVP/demo safety: all dashboard-launched segment campaigns are routed to a single
    // representative demo number for the selected segment. The mapping lives in this file
    // so it is easy to audit during demo.
    const routedSegmentFilter = withDemoRouting(segmentFilter);
    const campaign = await createCampaign({ name, segmentFilter: routedSegmentFilter, goal, campaignBrief, messageTemplate, createdBy });
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/campaigns - List all campaigns
router.get("/", async (req, res) => {
  try {
    const campaigns = await getAllCampaigns();
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/campaigns/:id - Get campaign detail
router.get("/:id", async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/campaigns/:id - Update campaign
router.patch("/:id", async (req, res) => {
  try {
    const campaign = await updateCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/approve - Approve campaign and generate jobs
router.post("/:id/approve", async (req, res) => {
  try {
    const campaign = await approveCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/trigger - Start sending
router.post("/:id/trigger", async (req, res) => {
  try {
    const campaign = await triggerCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/pause - Pause campaign
router.post("/:id/pause", async (req, res) => {
  try {
    const campaign = await pauseCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/resume - Resume campaign
router.post("/:id/resume", async (req, res) => {
  try {
    const campaign = await resumeCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/cancel - Cancel campaign
router.post("/:id/cancel", async (req, res) => {
  try {
    const campaign = await cancelCampaign(req.params.id);
    res.json(campaign);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/campaigns/:id/jobs - Get campaign jobs
router.get("/:id/jobs", async (req, res) => {
  try {
    const { limit, offset, status } = req.query;
    const jobs = await getCampaignJobs(req.params.id, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      status: status || undefined,
    });
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/generate - Generate AI copywriting for campaign
router.post("/:id/generate", async (req, res) => {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    const { ctaLink, promoDetails } = req.body;
    const segmentFilter = campaign.segment_filter;
    const segmentId = segmentFilter.segmentId;

    const result = await generateCampaignMessage({
      segmentId,
      segmentLabel: campaign.name,
      goal: campaign.goal,
      ctaLink: ctaLink || "https://retailmind.local/promo",
      promoDetails: promoDetails || null,
    });

    // Save generated message as template
    await updateCampaign(req.params.id, { message_template: result.text });

    res.json({
      message: result.text,
      source: result.source,
      model: result.model,
      cached: result.cached,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns/preview/generate-preview - Generate without saving (for preview)
router.post("/preview/generate-preview", async (req, res) => {
  try {
    const { segmentId, segmentLabel, goal, ctaLink, promoDetails } = req.body;

    const result = await generateCampaignMessage({
      segmentId: segmentId || "at_risk",
      segmentLabel: segmentLabel || "At Risk",
      goal: goal || "Win-back and reactivation",
      ctaLink: ctaLink || "https://retailmind.local/promo",
      promoDetails: promoDetails || null,
    });

    res.json({
      message: result.text,
      source: result.source,
      model: result.model,
      cached: result.cached,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/campaigns/:id/test-send - Send test message to a number
router.post("/:id/test-send", async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "Missing required fields: phone, message" });
    }

    let result;
    if (!process.env.FONNTE_TOKEN) {
      result = dryRunSend({ target: phone, message });
    } else {
      result = await sendWhatsAppMessage({ target: phone, message });
    }

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
