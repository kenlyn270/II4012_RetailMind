/*
 * Seed script: imports enriched_customer_analytics.csv into PostgreSQL
 * and generates fake phone numbers for customer_contacts.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDatabase, queryOne, withTransaction, closeDatabase } from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../../../model/data/enriched_customer_analytics.csv");

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

function generateFakePhone(index) {
  const prefixes = ["812", "813", "815", "816", "821", "822", "851", "852", "853", "857", "858"];
  const prefix = prefixes[index % prefixes.length];
  const suffix = String(10000000 + (index * 7919) % 90000000).slice(0, 8);
  return `62${prefix}${suffix}`;
}

function generateDisplayName(customerId) {
  const names = [
    "Aisha", "Budi", "Citra", "Dimas", "Eka", "Fajar", "Gita", "Hadi",
    "Indah", "Joko", "Kartika", "Lukman", "Maya", "Nanda", "Omar", "Putri",
    "Qori", "Rina", "Surya", "Tari", "Umar", "Vina", "Wawan", "Xena", "Yudi", "Zahra",
  ];
  const lastNames = [
    "Rahmawati", "Santoso", "Lestari", "Pratama", "Putri", "Wijaya", "Kusuma",
    "Hidayat", "Sari", "Nugroho", "Permata", "Saputra", "Dewi", "Hartono", "Anggraini",
  ];
  const id = parseInt(customerId, 10) || 0;
  return `${names[id % names.length]} ${lastNames[id % lastNames.length]}`;
}

function intVal(value) {
  return parseInt(value, 10) || 0;
}

function floatVal(value) {
  return parseFloat(value) || 0;
}

try {
  await initDatabase();

  console.log("📂 Reading CSV...");
  const csvContent = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(csvContent);
  console.log(`   Found ${rows.length} customers`);

  console.log("📊 Importing customer contacts and segments...");

  await withTransaction(async (client) => {
    for (const [index, row] of rows.entries()) {
      const customerId = row["Customer ID"];
      const optIn = index % 5 !== 0; // 80% opted in

      await client.query(`
        INSERT INTO customer_contacts (customer_id, phone, display_name, whatsapp_opt_in, opt_in_source, opt_in_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (customer_id) DO UPDATE SET
          phone = EXCLUDED.phone,
          display_name = EXCLUDED.display_name,
          whatsapp_opt_in = EXCLUDED.whatsapp_opt_in,
          opt_in_source = EXCLUDED.opt_in_source,
          opt_in_at = EXCLUDED.opt_in_at
      `, [
        customerId,
        generateFakePhone(index),
        generateDisplayName(customerId),
        optIn,
        optIn ? "seed_demo" : null,
        optIn ? "2026-01-15T10:00:00Z" : null,
      ]);

      await client.query(`
        INSERT INTO customer_segments (
          customer_id, recency, frequency, monetary,
          recency_score, frequency_score, monetary_score, rf_score,
          segment, country, anomaly_label, anomaly_score,
          churn_risk_score, kmeans_cluster, kmeans_segment,
          cltv_6_months, cltv_segment, recommended_action
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (customer_id) DO UPDATE SET
          recency = EXCLUDED.recency,
          frequency = EXCLUDED.frequency,
          monetary = EXCLUDED.monetary,
          recency_score = EXCLUDED.recency_score,
          frequency_score = EXCLUDED.frequency_score,
          monetary_score = EXCLUDED.monetary_score,
          rf_score = EXCLUDED.rf_score,
          segment = EXCLUDED.segment,
          country = EXCLUDED.country,
          anomaly_label = EXCLUDED.anomaly_label,
          anomaly_score = EXCLUDED.anomaly_score,
          churn_risk_score = EXCLUDED.churn_risk_score,
          kmeans_cluster = EXCLUDED.kmeans_cluster,
          kmeans_segment = EXCLUDED.kmeans_segment,
          cltv_6_months = EXCLUDED.cltv_6_months,
          cltv_segment = EXCLUDED.cltv_segment,
          recommended_action = EXCLUDED.recommended_action
      `, [
        customerId,
        intVal(row["Recency"]),
        intVal(row["Frequency"]),
        floatVal(row["Monetary"]),
        intVal(row["RecencyScore"]),
        intVal(row["FrequencyScore"]),
        intVal(row["MonetaryScore"]),
        intVal(row["RF_Score"]),
        row["Segment"] || "",
        row["Country"] || "",
        intVal(row["anomaly_label"]),
        floatVal(row["anomaly_score"]),
        floatVal(row["churn_risk_score"]),
        intVal(row["KMeansCluster"]),
        row["KMeansSegment"] || "",
        floatVal(row["cltv_6_months"]),
        row["CLTVSegment"] || "",
        row["RecommendedAction"] || "",
      ]);
    }
  });

  const segCount = await queryOne("SELECT COUNT(*)::int as count FROM customer_segments");
  const contactCount = await queryOne("SELECT COUNT(*)::int as count FROM customer_contacts");
  const optInCount = await queryOne("SELECT COUNT(*)::int as count FROM customer_contacts WHERE whatsapp_opt_in = TRUE");

  console.log(`✅ Seeded ${segCount.count} customer segments`);
  console.log(`✅ Seeded ${contactCount.count} customer contacts`);
  console.log(`   └─ ${optInCount.count} opted-in (${Math.round((optInCount.count / contactCount.count) * 100)}%)`);
  console.log("🎉 Seed complete!");
} finally {
  await closeDatabase();
}
