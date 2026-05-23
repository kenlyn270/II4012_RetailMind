CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft','scheduled','running','paused','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE campaign_job_status AS ENUM ('pending','generating','queued','sent','delivered','read','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customer_contacts (
  customer_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  display_name TEXT,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  opt_in_source TEXT,
  opt_in_at TIMESTAMPTZ,
  last_marketing_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_segments (
  customer_id TEXT PRIMARY KEY REFERENCES customer_contacts(customer_id) ON DELETE CASCADE,
  recency INTEGER,
  frequency INTEGER,
  monetary NUMERIC(14,2),
  recency_score SMALLINT,
  frequency_score SMALLINT,
  monetary_score SMALLINT,
  rf_score SMALLINT,
  segment TEXT,
  country TEXT,
  anomaly_label SMALLINT,
  anomaly_score DOUBLE PRECISION,
  churn_risk_score DOUBLE PRECISION,
  kmeans_cluster SMALLINT,
  kmeans_segment TEXT,
  cltv_6_months NUMERIC(14,2),
  cltv_segment TEXT,
  recommended_action TEXT
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  segment_filter JSONB NOT NULL,
  goal TEXT NOT NULL,
  campaign_brief TEXT NOT NULL,
  message_template TEXT,
  status campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  display_name TEXT,
  segment_snapshot JSONB NOT NULL,
  generated_message TEXT,
  status campaign_job_status NOT NULL DEFAULT 'pending',
  fonnte_message_id TEXT,
  fonnte_request_id TEXT,
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcast_blacklist (
  phone TEXT PRIMARY KEY,
  customer_id TEXT,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_segment_id ON campaigns ((segment_filter->>'segmentId'));
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign_id ON campaign_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_status ON campaign_jobs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_phone ON campaign_jobs(phone);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_fonnte_id ON campaign_jobs(fonnte_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_jobs_fonnte_id_unique
  ON campaign_jobs(fonnte_message_id)
  WHERE fonnte_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_pending ON campaign_jobs(campaign_id, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_customer_contacts_phone ON customer_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_customer_segments_segment ON customer_segments(segment);
CREATE INDEX IF NOT EXISTS idx_customer_segments_kmeans ON customer_segments(kmeans_segment);
CREATE INDEX IF NOT EXISTS idx_customer_segments_action ON customer_segments(recommended_action);
CREATE INDEX IF NOT EXISTS idx_customer_segments_churn_risk ON customer_segments(churn_risk_score);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_updated ON customer_contacts;
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON customer_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_campaigns_updated ON campaigns;
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
