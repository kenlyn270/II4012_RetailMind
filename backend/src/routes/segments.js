/**
 * Segments API Routes
 */
import { Router } from "express";
import { getAllSegments, getSegmentPreview } from "../services/segmentService.js";

const router = Router();

// GET /api/segments - List all available segments with counts
router.get("/", async (req, res) => {
  try {
    const segments = await getAllSegments();
    res.json({ segments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/segments/:segmentId/preview - Preview segment audience with eligibility
router.get("/:segmentId/preview", async (req, res) => {
  try {
    const { segmentId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const preview = await getSegmentPreview(segmentId, limit);

    if (!preview) {
      return res.status(404).json({ error: "Segment not found" });
    }

    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
