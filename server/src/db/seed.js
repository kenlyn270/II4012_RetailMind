/**
 * Seed script: imports enriched_customer_analytics.csv into SQLite
 * and generates fake phone numbers for customer_contacts.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/retailmind.db");
const CSV_PATH = path.join(__dirname, "../../../backend/data/enriched_customer_analytics.csv");

// Initialize DB
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables if not exist (same as database.js)
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

  CREATE INDEX IF NOT EXISTS idx_customer_segments_segment ON customer_segments(segment);
  CREATE INDEX IF NOT EXISTS idx_customer_segments_kmeans ON customer_segments(kmeans_segment);
  CREATE INDEX IF NOT EXISTS idx_customer_segments_action ON customer_segments(recommended_action);
  CREATE INDEX IF NOT EXISTS idx_customer_contacts_phone ON customer_contacts(phone);
`);

// Parse CSV
function parseCSV(content) {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h.trim()] = values[idx].trim();
      });
      rows.push(row);
    }
  }
  return rows;
}

// Generate fake Indonesian phone number
function generateFakePhone(index) {
  const prefixes = ["812", "813", "815", "816", "821", "822", "851", "852", "853", "857", "858"];
  const prefix = prefixes[index % prefixes.length];
  const suffix = String(10000000 + (index * 7919) % 90000000).slice(0, 8);
  return `62${prefix}${suffix}`;
}

// Generate display name from customer ID
function generateDisplayName(customerId) {
  const names = [
    "Aisha", "Budi", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hadi",
    "Indah", "Joko", "Kartika", "Lukman", "Maya", "Nanda", "Omar", "Putri",
    "Qori", "Rina", "Surya", "Tari", "Umar", "Vina", "Wawan", "Xena", "Yudi", "Zahra"
  ];
  const lastNames = [
    "Rahmawati", "Santoso", "Lestari", "Pratama", "Putri", "Wijaya", "Kusuma",
    "Hidayat", "Sari", "Nugroho", "Permata", "Saputra", "Dewi", "Hartono", "Anggraini"
  ];
  const id = parseInt(customerId) || 0;
  const first = names[id % names.length];
  const last = lastNames[id % lastNames.length];
  return `${first} ${last}`;
}

console.log("📂 Reading CSV...");
const csvContent = readFileSync(CSV_PATH, "utf-8");
const rows = parseCSV(csvContent);
console.log(`   Found ${rows.length} customers`);

// Insert customer_segments
console.log("📊 Importing customer segments...");
const insertSegment = db.prepare(`
  INSERT OR REPLACE INTO customer_segments (
    customer_id, recency, frequency, monetary,
    recency_score, frequency_score, monetary_score, rf_score,
    segment, country, anomaly_label, anomaly_score,
    churn_risk_score, kmeans_cluster, kmeans_segment,
    cltv_6_months, cltv_segment, recommended_action
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertContact = db.prepare(`
  INSERT OR REPLACE INTO customer_contacts (
    customer_id, phone, display_name, whatsapp_opt_in, opt_in_source, opt_in_at
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((rows) => {
  rows.forEach((row, index) => {
    const customerId = row["Customer ID"];

    insertSegment.run(
      customerId,
      parseInt(row["Recency"]) || 0,
      parseInt(row["Frequency"]) || 0,
      parseFloat(row["Monetary"]) || 0,
      parseInt(row["RecencyScore"]) || 0,
      parseInt(row["FrequencyScore"]) || 0,
      parseInt(row["MonetaryScore"]) || 0,
      parseInt(row["RF_Score"]) || 0,
      row["Segment"] || "",
      row["Country"] || "",
      parseInt(row["anomaly_label"]) || 0,
      parseFloat(row["anomaly_score"]) || 0,
      parseFloat(row["churn_risk_score"]) || 0,
      parseInt(row["KMeansCluster"]) || 0,
      row["KMeansSegment"] || "",
      parseFloat(row["cltv_6_months"]) || 0,
      row["CLTVSegment"] || "",
      row["RecommendedAction"] || ""
    );

    // Generate contact with ~80% opt-in rate for demo
    const optIn = index % 5 !== 0 ? 1 : 0; // 80% opted in
    insertContact.run(
      customerId,
      generateFakePhone(index),
      generateDisplayName(customerId),
      optIn,
      optIn ? "seed_demo" : null,
      optIn ? "2026-01-15T10:00:00Z" : null
    );
  });
});

insertMany(rows);

const segCount = db.prepare("SELECT COUNT(*) as count FROM customer_segments").get();
const contactCount = db.prepare("SELECT COUNT(*) as count FROM customer_contacts").get();
const optInCount = db.prepare("SELECT COUNT(*) as count FROM customer_contacts WHERE whatsapp_opt_in = 1").get();

console.log(`✅ Seeded ${segCount.count} customer segments`);
console.log(`✅ Seeded ${contactCount.count} customer contacts`);
console.log(`   └─ ${optInCount.count} opted-in (${Math.round(optInCount.count / contactCount.count * 100)}%)`);
console.log("🎉 Seed complete!");

db.close();
