import { getDb } from "./db";
// import { Parser } from "json2csv"; // Will use native CSV generation
import * as fs from "fs";
import * as path from "path";

interface ExportOptions {
  format: "csv" | "pdf";
  type: "matches" | "supply" | "demand" | "messages";
  filters?: {
    location?: string[];
    priceMin?: number;
    priceMax?: number;
    dateFrom?: Date;
    dateTo?: Date;
  };
}

export async function exportMatches(options: ExportOptions): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  let query = `SELECT * FROM matches WHERE 1=1`;

  if (options.filters?.location && options.filters.location.length > 0) {
    const locations = options.filters.location.map(l => `'${l}'`).join(",");
    query += ` AND location IN (${locations})`;
  }

  if (options.filters?.dateFrom) {
    query += ` AND created_at >= '${options.filters.dateFrom.toISOString()}'`;
  }

  if (options.filters?.dateTo) {
    query += ` AND created_at <= '${options.filters.dateTo.toISOString()}'`;
  }

  query += ` ORDER BY created_at DESC`;

  const data = await db.execute(query);

  if (options.format === "csv") {
    return generateCSV(data, "matches");
  } else {
    return generatePDF(data, "matches");
  }
}

export async function exportSupply(options: ExportOptions): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  let query = `SELECT * FROM supply WHERE 1=1`;

  if (options.filters?.location && options.filters.location.length > 0) {
    const locations = options.filters.location.map(l => `'${l}'`).join(",");
    query += ` AND location IN (${locations})`;
  }

  if (options.filters?.priceMin) {
    query += ` AND price >= ${options.filters.priceMin}`;
  }

  if (options.filters?.priceMax) {
    query += ` AND price <= ${options.filters.priceMax}`;
  }

  query += ` ORDER BY created_at DESC`;

  const data = await db.execute(query);

  if (options.format === "csv") {
    return generateCSV(data, "supply");
  } else {
    return generatePDF(data, "supply");
  }
}

export async function exportDemand(options: ExportOptions): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  let query = `SELECT * FROM demand WHERE 1=1`;

  if (options.filters?.location && options.filters.location.length > 0) {
    const locations = options.filters.location.map(l => `'${l}'`).join(",");
    query += ` AND location IN (${locations})`;
  }

  query += ` ORDER BY created_at DESC`;

  const data = await db.execute(query);

  if (options.format === "csv") {
    return generateCSV(data, "demand");
  } else {
    return generatePDF(data, "demand");
  }
}

export async function exportMessages(options: ExportOptions): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  let query = `SELECT * FROM messages WHERE 1=1`;

  if (options.filters?.location && options.filters.location.length > 0) {
    const locations = options.filters.location.map(l => `'${l}'`).join(",");
    query += ` AND location IN (${locations})`;
  }

  query += ` ORDER BY created_at DESC`;

  const data = await db.execute(query);

  if (options.format === "csv") {
    return generateCSV(data, "messages");
  } else {
    return generatePDF(data, "messages");
  }
}

function generateCSV(data: any[], type: string): string {
  try {
    const fields = getFieldsForType(type);
    const csv = convertToCSV(data, fields);
    const filename = `export-${type}-${Date.now()}.csv`;
    const filepath = path.join("/tmp", filename);
    fs.writeFileSync(filepath, csv);
    return filepath;
  } catch (error) {
    throw new Error(`Failed to generate CSV: ${error}`);
  }
}

function convertToCSV(data: any[], fields: string[]): string {
  const header = fields.join(",");
  const rows = data.map((row) =>
    fields.map((field) => {
      const value = row[field] || "";
      return typeof value === "string" && value.includes(",") ? `\"${value}\"` : value;
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

function generatePDF(data: any[], type: string): string {
  // For now, return CSV path as PDF generation requires additional setup
  // In production, use libraries like pdfkit or puppeteer
  return generateCSV(data, type);
}

function getFieldsForType(type: string): string[] {
  const fieldMap: Record<string, string[]> = {
    matches: [
      "id",
      "buyerName",
      "buyerPhone",
      "sellerName",
      "sellerPhone",
      "property",
      "price",
      "location",
      "matchScore",
      "confidence",
      "createdAt",
    ],
    supply: [
      "id",
      "sellerName",
      "sellerPhone",
      "propertyType",
      "location",
      "price",
      "bedrooms",
      "bathrooms",
      "area",
      "operation",
      "createdAt",
    ],
    demand: [
      "id",
      "buyerName",
      "buyerPhone",
      "propertyType",
      "location",
      "budgetMin",
      "budgetMax",
      "bedrooms",
      "bathrooms",
      "createdAt",
    ],
    messages: [
      "id",
      "senderName",
      "senderPhone",
      "content",
      "classification",
      "location",
      "createdAt",
    ],
  };

  return fieldMap[type] || [];
}

export async function getBrokerAnalytics() {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const brokerStats = await db.execute(`
    SELECT 
      s.seller_name as broker_name,
      s.seller_phone as broker_phone,
      COUNT(DISTINCT s.id) as total_listings,
      COUNT(DISTINCT m.id) as total_matches,
      AVG(m.match_score) as avg_match_score,
      COUNT(CASE WHEN m.match_score >= 85 THEN 1 END) as high_confidence_matches,
      ROUND(COUNT(CASE WHEN m.match_score >= 85 THEN 1 END) * 100.0 / COUNT(DISTINCT m.id), 2) as conversion_rate,
      MIN(s.created_at) as first_listing_date,
      MAX(s.created_at) as last_listing_date
    FROM supply s
    LEFT JOIN matches m ON s.id = m.supply_id
    GROUP BY s.seller_name, s.seller_phone
    ORDER BY total_matches DESC
    LIMIT 50
  `);

  return brokerStats;
}

export async function getMarketTrends(days: number = 30) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const trends = await db.execute(`
    SELECT 
      DATE(created_at) as date,
      COUNT(CASE WHEN classification = 'supply' THEN 1 END) as supply_count,
      COUNT(CASE WHEN classification = 'demand' THEN 1 END) as demand_count,
      AVG(CASE WHEN classification = 'supply' THEN price END) as avg_supply_price,
      AVG(CASE WHEN classification = 'demand' THEN price END) as avg_demand_budget
    FROM messages
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY)
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);

  return trends;
}
