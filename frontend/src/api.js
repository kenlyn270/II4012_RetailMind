/**
 * API client for RetailMind backend
 */
const API_BASE = "/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("retailmind_token");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// Auth
export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(name, email, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export function getMe() {
  return request("/auth/me");
}

// Segments
export function getSegments() {
  return request("/segments");
}

// Datasets / Inference
export async function scoreDatasetDirect(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/datasets/score-direct`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export function getDatasetProfile(datasetId) {
  return request(`/datasets/${datasetId}/profile`);
}

export function getLatestDatasetSummary() {
  return request("/datasets/latest-summary");
}

export function getSystemStatus() {
  return request("/system/status");
}

export function getSegmentPreview(segmentId, limit = 10) {
  return request(`/segments/${segmentId}/preview?limit=${limit}`);
}

// Campaigns
export function getCampaigns() {
  return request("/campaigns");
}

export function getCampaign(id) {
  return request(`/campaigns/${id}`);
}

export function createCampaign(payload) {
  return request("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCampaign(id, updates) {
  return request(`/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function approveCampaign(id) {
  return request(`/campaigns/${id}/approve`, { method: "POST" });
}

export function triggerCampaign(id) {
  return request(`/campaigns/${id}/trigger`, { method: "POST" });
}

export function pauseCampaign(id) {
  return request(`/campaigns/${id}/pause`, { method: "POST" });
}

export function resumeCampaign(id) {
  return request(`/campaigns/${id}/resume`, { method: "POST" });
}

export function cancelCampaign(id) {
  return request(`/campaigns/${id}/cancel`, { method: "POST" });
}

export function getCampaignJobs(id, { limit = 50, offset = 0, status } = {}) {
  const params = new URLSearchParams({ limit, offset });
  if (status) params.set("status", status);
  return request(`/campaigns/${id}/jobs?${params}`);
}

export function generateCopywriting(campaignId, { ctaLink, promoDetails } = {}) {
  return request(`/campaigns/${campaignId}/generate`, {
    method: "POST",
    body: JSON.stringify({ ctaLink, promoDetails }),
  });
}

export function generateCopywritingPreview({ segmentId, segmentLabel, goal, ctaLink, promoDetails }) {
  return request(`/campaigns/preview/generate-preview`, {
    method: "POST",
    body: JSON.stringify({ segmentId, segmentLabel, goal, ctaLink, promoDetails }),
  });
}

export function testSend(campaignId, phone, message) {
  return request(`/campaigns/${campaignId}/test-send`, {
    method: "POST",
    body: JSON.stringify({ phone, message }),
  });
}

// Demo Blast - kirim 1 pesan AI per segmen ke 4 nomor diskrit
export function getDemoBlastTargets() {
  return request(`/campaigns/demo-blast/targets`);
}

export function runDemoBlast({ ctaLink, promoDetails, dryRun } = {}) {
  return request(`/campaigns/demo-blast`, {
    method: "POST",
    body: JSON.stringify({ ctaLink, promoDetails, dryRun }),
  });
}
