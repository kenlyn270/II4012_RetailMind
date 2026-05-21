import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/retailmind.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_contacts (
      customer_id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      display_name TEXT,
      whatsapp_opt_in INTEGER DEFAULT 0,
      opt_in_source TEXT,
      opt_in_at TEXT,
      last_marketing_sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_segments (
      customer_id TEXT PRIMARY KEY,
      recency INTEGER,
      frequency INTEGER,
      monetary REAL,
      recency_score INTEGER,
      frequency_score INTEGER,
      monetary_score INTEGER,
      rf_score INTEGER,
      segment TEXT,
      country TEXT,
      anomaly_label INTEGER,
      anomaly_score REAL,
      churn_risk_score REAL,
      kmeans_cluster INTEGER,
      kmeans_segment TEXT,
      cltv_6_months REAL,
      cltv_segment TEXT,
      recommended_action TEXT
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      segment_filter TEXT NOT NULL,
      goal TEXT NOT NULL,
      campaign_brief TEXT NOT NULL,
      message_template TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      scheduled_at TEXT,
      approved_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_jobs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      customer_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      display_name TEXT,
      segment_snapshot TEXT NOT NULL,
      generated_message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      fonnte_message_id TEXT,
      fonnte_request_id TEXT,
      error_message TEXT,
      generated_at TEXT,
      queued_at TEXT,
      sent_at TEXT,
      delivered_at TEXT,
      read_at TEXT,
      failed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS broadcast_blacklist (
      phone TEXT PRIMARY KEY,
      customer_id TEXT,
      reason TEXT NOT NULL,
      source TEXT NOT NULL,
      blacklisted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign_id ON campaign_jobs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_jobs_status ON campaign_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_campaign_jobs_phone ON campaign_jobs(phone);
    CREATE INDEX IF NOT EXISTS idx_customer_contacts_phone ON customer_contacts(phone);
    CREATE INDEX IF NOT EXISTS idx_customer_segments_segment ON customer_segments(segment);
    CREATE INDEX IF NOT EXISTS idx_customer_segments_kmeans ON customer_segments(kmeans_segment);
    CREATE INDEX IF NOT EXISTS idx_customer_segments_action ON customer_segments(recommended_action);
  `);

  console.log("✅ Database initialized");
}

export default db;
