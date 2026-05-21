/**
 * Fonnte Service
 * Wrapper for Fonnte WhatsApp API.
 */

const FONNTE_SEND_URL = process.env.FONNTE_SEND_URL || "https://api.fonnte.com/send";
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

/**
 * Send a single WhatsApp message via Fonnte
 */
export async function sendWhatsAppMessage({ target, message }) {
  if (!FONNTE_TOKEN) {
    throw new Error("FONNTE_TOKEN is not configured");
  }

  const form = new URLSearchParams();
  form.append("target", target);
  form.append("message", message);
  form.append("typing", "true");
  form.append("delay", "5-20");
  form.append("countryCode", process.env.FONNTE_COUNTRY_CODE || "0");
  form.append("preview", "false");
  form.append("connectOnly", "true");

  const response = await fetch(FONNTE_SEND_URL, {
    method: "POST",
    headers: { Authorization: FONNTE_TOKEN },
    body: form,
  });

  const result = await response.json();

  if (!result.status) {
    throw new Error(result.reason || result.detail || "Fonnte send failed");
  }

  return {
    success: true,
    messageId: result.id?.[target] || result.id || null,
    requestId: result.requestid || null,
    detail: result.detail || null,
  };
}

/**
 * Send batch of personalized messages via Fonnte's `data` parameter
 */
export async function sendWhatsAppBatch(jobs) {
  if (!FONNTE_TOKEN) {
    throw new Error("FONNTE_TOKEN is not configured");
  }

  const payload = jobs.map((job, index) => ({
    target: job.phone,
    message: job.message,
    delay: index === 0 ? "0" : "5-20",
    typing: true,
    countryCode: process.env.FONNTE_COUNTRY_CODE || "0",
    preview: false,
  }));

  const form = new URLSearchParams();
  form.append("data", JSON.stringify(payload));

  const response = await fetch(FONNTE_SEND_URL, {
    method: "POST",
    headers: { Authorization: FONNTE_TOKEN },
    body: form,
  });

  return response.json();
}

/**
 * Dry-run mode - simulates sending without calling Fonnte
 */
export function dryRunSend({ target, message }) {
  console.log(`[DRY-RUN] Would send to ${target}: ${message.slice(0, 50)}...`);
  return {
    success: true,
    messageId: `dry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requestId: `dry_req_${Date.now()}`,
    detail: "Dry run - no message sent",
  };
}
