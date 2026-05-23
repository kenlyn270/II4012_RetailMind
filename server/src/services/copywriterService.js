/**
 * AI Copywriter Service
 * Generates personalized WhatsApp campaign messages using Gemini.
 *
 * Optimization strategies:
 * 1. Token-efficient prompts (compressed, no redundant context)
 * 2. In-memory cache by (segmentId|goal|cta|promo) hash
 * 3. Round-robin across multiple model names
 * 4. Auto-fallback on rate limit / quota errors
 * 5. Output token cap
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryOne } from "../db/database.js";
import crypto from "crypto";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Round-robin model list. Order = preference. Free-tier friendly first.
const MODEL_POOL = (
  process.env.COPYWRITER_MODELS ||
  "gemini-2.0-flash-lite,gemini-2.0-flash,gemini-1.5-flash-8b,gemini-1.5-flash"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TEMPERATURE = parseFloat(process.env.COPYWRITER_TEMPERATURE) || 0.75;
const MAX_OUTPUT_TOKENS = parseInt(process.env.COPYWRITER_MAX_TOKENS) || 220;
const CACHE_TTL_MS =
  parseInt(process.env.COPYWRITER_CACHE_TTL_MS) || 1000 * 60 * 30; // 30 min

// Round-robin pointer + simple cache
let modelCursor = 0;
const cache = new Map(); // key -> { text, expiresAt }

/**
 * Pick the next model from pool, starting after the cursor.
 * Returns the chosen model name and advances the cursor.
 */
function pickModel(skipModels = []) {
  for (let i = 0; i < MODEL_POOL.length; i++) {
    const idx = (modelCursor + i) % MODEL_POOL.length;
    const model = MODEL_POOL[idx];
    if (!skipModels.includes(model)) {
      modelCursor = (idx + 1) % MODEL_POOL.length;
      return model;
    }
  }
  return null;
}

/**
 * Cache key from request signature (no need to hash secrets).
 */
function cacheKey({ segmentId, goal, ctaLink, promoDetails }) {
  const raw = `${segmentId}|${goal}|${ctaLink}|${promoDetails || ""}`;
  return crypto.createHash("sha1").update(raw).digest("hex").slice(0, 16);
}

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.text;
}

function setCached(key, text) {
  cache.set(key, { text, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Returns a promo string based on individual churn risk score.
 * All discount values are whole numbers (no decimals).
 */
export function getPromoBySegment(segmentId) {
  const promos = {
    high_value: "Gratis ongkir + poin loyalty 2x untuk pembelian berikutnya",
    at_risk: "Diskon 20% semua produk, min. pembelian Rp50000",
    hibernating: "Diskon 30% semua produk, berlaku 48 jam",
    new_occasional: "Voucher Rp15000 untuk pembelian kedua",
  };
  return promos[segmentId] || null;
}

/**
 * Compact prompt — minimal tokens while keeping all hard rules.
 * Indonesian instructions kept short to save input tokens.
 */
function buildPrompt({
  segmentLabel,
  avgChurnRisk,
  avgRecency,
  recommendedAction,
  goal,
  promoDetails,
}) {
  const ctx = [
    `- Segmen: ${segmentLabel}`,
    `- Risiko Churn: ${avgChurnRisk.toFixed(0)}%`,
    `- Terakhir Belanja: ${avgRecency.toFixed(0)} hari yang lalu (sejak hari ini)`,
    `- Strategi: ${recommendedAction}`,
    `- Tujuan: ${goal}`,
    promoDetails ? `- Promo: ${promoDetails}` : "- Promo: Tidak ada",
  ].join("\n");

  return `Kamu adalah AI Copywriter spesialis CRM e-commerce untuk RetailMind.
Tugasmu: Tulis 1 pesan promosi WhatsApp dalam Bahasa Indonesia yang berfokus pada konversi (gaya Tokopedia/Shopee).

=== KONTEKS PELANGGAN ===
${ctx}

=== GAYA PENULISAN (WAJIB DIIKUTI) ===
- Tone: Asik, to the point, bikin FOMO, dan modern.
- Sapaan: Gunakan "Haloo {name}" atau "Haii {name}".
- Saat menyebut {last_purchase_days}, WAJIB tulis lengkap seperti ini: "sudah {last_purchase_days} hari sejak terakhir belanja".
- Kata Kerja: Gunakan "belanja", "upgrade", "berburu diskon", "check out", "amankan stok".
- Posisi Emoji: EMOJI HANYA BOLEH DILETAKKAN DI AKHIR KALIMAT. Maksimal 1-2 emoji per pesan.
- Panjang: Maksimal 400 karakter.

=== LARANGAN KERAS (JANGAN LAKUKAN INI) ===
- DILARANG KERAS menggunakan huruf kapital/CAPSLOCK secara berlebihan.
- DILARANG KERAS meletakkan emoji di AWAL kalimat atau mengapit teks dengan emoji.
- JANGAN PERNAH gunakan kata "kangen", "hati", "rindu", "nggak lihat Kakak", atau kalimat drama.
- JANGAN gunakan gaya bahasa kaku seperti "tapi ingat", "kesempatan emas", atau "jangan tunda lagi".
- JANGAN gunakan kata "jajan" (kecuali untuk kategori makanan).
- JANGAN minta pelanggan untuk "Balas INFO", "hubungi admin", atau instruksi reply selain STOP.

=== INSTRUKSI OUTPUT ===
- WAJIB gunakan token ini persis seperti ini: {name}, {last_purchase_days}, {cta_link}.
- WAJIB diakhiri dengan kalimat eksak: "Balas STOP jika tidak ingin menerima info promo."
- JANGAN tambahkan Markdown seperti **bold** atau _italic_ kecuali pada token {name} yang sudah diformat. Jangan ada kurung siku atau teks penjelasan.`;
}

/**
 * Get segment statistics for prompt context (1 query).
 */
async function getSegmentStats(segmentId) {
  const SEGMENT_QUERIES = {
    high_value: `SELECT * FROM customer_segments WHERE kmeans_segment = 'High Value'`,
    at_risk: `SELECT * FROM customer_segments WHERE kmeans_segment = 'At Risk'`,
    hibernating: `SELECT * FROM customer_segments WHERE kmeans_segment = 'Hibernating'`,
    new_occasional: `SELECT * FROM customer_segments WHERE kmeans_segment IN ('New/Occasional', 'New/Ocassional')`,
  };

  const query = SEGMENT_QUERIES[segmentId];
  if (!query) return null;

  const stats = await queryOne(`
    SELECT
      COUNT(*)::int as count,
      AVG(churn_risk_score) as avg_churn,
      AVG(recency) as avg_recency,
      AVG(cltv_6_months) as avg_cltv
    FROM (${query}) seg
  `);

  const action = await queryOne(`
    SELECT recommended_action FROM (${query}) seg GROUP BY recommended_action ORDER BY COUNT(*) DESC LIMIT 1
  `);

  return {
    count: stats.count,
    avgChurnRisk: Number(stats.avg_churn || 0),
    avgRecency: Number(stats.avg_recency || 0),
    avgCltv: Number(stats.avg_cltv || 0),
    recommendedAction: action?.recommended_action || "Standard Nurture",
  };
}

/**
 * Detect rate-limit / quota errors that warrant a model switch.
 */
function isRetryableError(err) {
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate") ||
    msg.includes("resource_exhausted") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("503")
  );
}

/**
 * Call Gemini with one specific model. No retries.
 */
async function callModel(modelName, prompt) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const generationConfig = {
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    topP: 0.9,
  };
  // Disable thinking for Gemini 2.5 models so output isn't truncated by thinking tokens.
  if (modelName.startsWith("gemini-2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  text = text.replace(/\*\*/g, "").replace(/^["']|["']$/g, "");

  // Hard length safety — keep it under 500 chars
  if (text.length > 500) {
    const tail = "\n\nBalas STOP jika tidak ingin menerima info promo.";
    text = text.slice(0, 500 - tail.length).trimEnd() + tail;
  }
  return text;
}

/**
 * Generate campaign message with round-robin + fallback on rate limit.
 */
export async function generateCampaignMessage({
  segmentId,
  segmentLabel,
  goal,
  ctaLink,
  promoDetails,
}) {
  // No API key → fallback template.
  if (!GEMINI_API_KEY) {
    return {
      text: generateFallbackMessage({ segmentId }),
      source: "fallback",
      model: null,
      cached: false,
    };
  }

  // Cache lookup.
  const key = cacheKey({ segmentId, goal, ctaLink, promoDetails });
  const cached = getCached(key);
  if (cached) {
    return { text: cached, source: "cache", model: null, cached: true };
  }

  const stats = await getSegmentStats(segmentId);
  if (!stats) throw new Error(`Unknown segment: ${segmentId}`);

  const prompt = buildPrompt({
    segmentLabel,
    avgChurnRisk: stats.avgChurnRisk,
    avgRecency: stats.avgRecency,
    recommendedAction: stats.recommendedAction,
    goal,
    promoDetails,
  });

  // Round-robin with fallback. Try every model in pool at most once.
  const tried = [];
  let lastError = null;

  for (let attempt = 0; attempt < MODEL_POOL.length; attempt++) {
    const model = pickModel(tried);
    if (!model) break;
    tried.push(model);

    try {
      const text = await callModel(model, prompt);
      setCached(key, text);
      return { text, source: "gemini", model, cached: false };
    } catch (err) {
      lastError = err;
      console.warn(`⚠️  Model ${model} failed: ${err.message}`);
      if (!isRetryableError(err)) {
        // Non-retryable (e.g. invalid prompt) — stop trying.
        break;
      }
      // Continue to next model.
    }
  }

  // All models exhausted → fallback template.
  console.warn(
    `🔁 All models exhausted, using fallback. Last error: ${lastError?.message}`,
  );
  return {
    text: generateFallbackMessage({ segmentId }),
    source: "fallback",
    model: null,
    cached: false,
    error: lastError?.message,
  };
}

/**
 * Static fallback templates per segment.
 */
function generateFallbackMessage({ segmentId }) {
  const templates = {
    win_back_priority: `Halo {name}! 👋 Sudah {last_purchase_days} hari sejak kunjungan terakhirmu. Kami punya rekomendasi yang cocok untukmu: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.`,
    at_risk: `Halo {name}! 👋 Kami rindu melihatmu berbelanja. Cek koleksi terbaru kami: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.`,
    cant_loose: `Halo {name}! Sebagai pelanggan prioritas, ada penawaran khusus untukmu 🎁 Klaim: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.`,
    hibernating: `Halo {name}! Sudah lama tidak bertemu. Lihat katalog terbaru kami: {cta_link} ✨\n\nBalas STOP jika tidak ingin menerima info promo.`,
    champions: `Halo {name}! ✨ Terima kasih sudah jadi pelanggan setia. Akses awal koleksi terbaru: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.`,
    high_churn_risk: `Halo {name}! 👋 Sudah {last_purchase_days} hari sejak kamu mampir. Ada sesuatu untukmu: {cta_link}\n\nBalas STOP jika tidak ingin menerima info promo.`,
  };
  return templates[segmentId] || templates.at_risk;
}

/**
 * Cache management helpers (for admin/debug routes).
 */
export function getCacheStats() {
  return {
    size: cache.size,
    models: MODEL_POOL,
    cursor: modelCursor,
    ttlMs: CACHE_TTL_MS,
  };
}

export function clearCache() {
  cache.clear();
}

export { getSegmentStats, buildPrompt, MODEL_POOL };
