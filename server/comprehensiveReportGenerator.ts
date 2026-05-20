/**
 * Comprehensive 7-Sheet Excel Report Generator
 * Generates detailed business intelligence reports for MatchPro
 * 
 * Sheet 1: All Messages - Raw message data with classification
 * Sheet 2: Demand Analysis - Grouped by location, budget, property type
 * Sheet 3: Supply Analysis - Grouped by location, price, property type
 * Sheet 4: Supply vs Demand by Location - Area-level comparison
 * Sheet 5: Broker vs End-User Breakdown - Role identification
 * Sheet 6: Time Trends - Hourly/daily activity patterns
 * Sheet 7: Contacts & Outreach List - Sender info with action priority
 */

import ExcelJS from "exceljs";
import { getDb } from "./db";
import { messages, supply, demand, matches } from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

interface MessageRecord {
  id: number;
  rawMessage: string;
  classification: string;
  confidence: number;
  senderPhone: string;
  senderName?: string;
  timestamp: Date;
  inferredRole: string;
  location?: string;
  budget?: number;
  price?: number;
  propertyType?: string;
}

interface LocationAnalysis {
  location: string;
  demandCount: number;
  supplyCount: number;
  avgDemandBudget: number;
  avgSupplyPrice: number;
  ratio: number;
  topPropertyTypes: string[];
}

interface TimeEntry {
  hour: number;
  day: string;
  demandCount: number;
  supplyCount: number;
  matchCount: number;
}

interface ContactRecord {
  phone: string;
  name?: string;
  role: string;
  classification: string;
  lastMessageDate: Date;
  messageCount: number;
  actionPriority: string;
}

export async function generateComprehensiveReport(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const db = await getDb();

  if (!db) {
    throw new Error("Database connection failed");
  }

  try {
    // Fetch all data
    const allMessages = await db.select().from(messages).limit(5000);
    const allSupply = await db.select().from(supply).limit(5000);
    const allDemand = await db.select().from(demand).limit(5000);
    const allMatches = await db.select().from(matches).limit(5000);

    // ─── SHEET 1: All Messages ───────────────────────────────────────────────
    createAllMessagesSheet(workbook, allMessages);

    // ─── SHEET 2: Demand Analysis ────────────────────────────────────────────
    createDemandAnalysisSheet(workbook, allDemand);

    // ─── SHEET 3: Supply Analysis ────────────────────────────────────────────
    createSupplyAnalysisSheet(workbook, allSupply);

    // ─── SHEET 4: Supply vs Demand by Location ──────────────────────────────
    createLocationComparisonSheet(workbook, allSupply, allDemand);

    // ─── SHEET 5: Broker vs End-User Breakdown ───────────────────────────────
    createBrokerEndUserSheet(workbook, allMessages);

    // ─── SHEET 6: Time Trends ────────────────────────────────────────────────
    createTimeTrendsSheet(workbook, allMessages);

    // ─── SHEET 7: Contacts & Outreach List ───────────────────────────────────
    createContactsSheet(workbook, allMessages);

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  } catch (error) {
    console.error("[Report Generator] Error:", error);
    throw error;
  }
}

// ─── SHEET 1: All Messages ───────────────────────────────────────────────────
function createAllMessagesSheet(workbook: ExcelJS.Workbook, messages: any[]) {
  const sheet = workbook.addWorksheet("All Messages");

  // Headers
  const headers = [
    "ID",
    "Raw Message",
    "Classification",
    "Confidence %",
    "Sender Phone",
    "Sender Name",
    "Inferred Role",
    "Location",
    "Property Type",
    "Budget/Price",
    "Timestamp",
    "Message Age (hours)",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10b981" } };

  // Data rows
  const now = new Date();
  for (const msg of messages) {
    const timestamp = new Date(msg.createdAt || msg.timestamp || now);
    const hoursAgo = Math.round((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60));

    sheet.addRow([
      msg.id || "",
      msg.rawMessage || msg.message || "",
      msg.classification || "GENERAL",
      msg.confidence ? Math.round((msg.confidence as number) * 100) : 0,
      msg.senderPhone || msg.sender_phone || "",
      msg.senderName || msg.sender_name || "",
      msg.inferredRole || msg.inferred_role || "Unknown",
      msg.location || "",
      msg.propertyType || msg.property_type || "",
      msg.budget || msg.price || "",
      timestamp.toLocaleString("en-EG", { timeZone: "Africa/Cairo" }),
      hoursAgo,
    ]);
  }

  // Format columns
  sheet.columns.forEach((col, idx) => {
    col.width = idx === 1 ? 40 : idx === 4 ? 15 : 12;
    if (idx === 1) col.alignment = { wrapText: true };
  });

  // Add summary at bottom
  const summaryRow = sheet.addRow([]);
  const totalRow = sheet.addRow([
    "TOTAL MESSAGES:",
    messages.length,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
}

// ─── SHEET 2: Demand Analysis ────────────────────────────────────────────────
function createDemandAnalysisSheet(workbook: ExcelJS.Workbook, demands: any[]) {
  const sheet = workbook.addWorksheet("Demand Analysis");

  // Group by location
  const byLocation = new Map<string, any[]>();
  for (const d of demands) {
    const loc = d.location || "Unknown";
    if (!byLocation.has(loc)) byLocation.set(loc, []);
    byLocation.get(loc)!.push(d);
  }

  // Headers
  const headers = [
    "Location",
    "Total Demand",
    "Avg Budget",
    "Min Budget",
    "Max Budget",
    "Apartment %",
    "Villa %",
    "Land %",
    "Furnished %",
    "Unfurnished %",
    "1-2 Bed %",
    "3-4 Bed %",
    "5+ Bed %",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3b82f6" } };

  // Data rows
  for (const [location, items] of byLocation) {
    const budgets = items.map((d) => d.budget || 0).filter((b) => b > 0);
    const avgBudget = budgets.length > 0 ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : 0;
    const minBudget = budgets.length > 0 ? Math.min(...budgets) : 0;
    const maxBudget = budgets.length > 0 ? Math.max(...budgets) : 0;

    const types = items.map((d) => (d.propertyType || "").toLowerCase());
    const furnished = items.filter((d) => (d.furnishing || "").includes("furnished")).length;

    const bedrooms = items.map((d) => d.bedrooms || 0);
    const bed1_2 = bedrooms.filter((b) => b >= 1 && b <= 2).length;
    const bed3_4 = bedrooms.filter((b) => b >= 3 && b <= 4).length;
    const bed5plus = bedrooms.filter((b) => b >= 5).length;

    sheet.addRow([
      location,
      items.length,
      avgBudget,
      minBudget,
      maxBudget,
      Math.round((types.filter((t) => t.includes("apartment")).length / items.length) * 100) || 0,
      Math.round((types.filter((t) => t.includes("villa")).length / items.length) * 100) || 0,
      Math.round((types.filter((t) => t.includes("land")).length / items.length) * 100) || 0,
      Math.round((furnished / items.length) * 100) || 0,
      Math.round(((items.length - furnished) / items.length) * 100) || 0,
      Math.round((bed1_2 / items.length) * 100) || 0,
      Math.round((bed3_4 / items.length) * 100) || 0,
      Math.round((bed5plus / items.length) * 100) || 0,
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 14;
    col.alignment = { horizontal: "center" };
  });
}

// ─── SHEET 3: Supply Analysis ────────────────────────────────────────────────
function createSupplyAnalysisSheet(workbook: ExcelJS.Workbook, supplies: any[]) {
  const sheet = workbook.addWorksheet("Supply Analysis");

  // Group by location
  const byLocation = new Map<string, any[]>();
  for (const s of supplies) {
    const loc = s.location || "Unknown";
    if (!byLocation.has(loc)) byLocation.set(loc, []);
    byLocation.get(loc)!.push(s);
  }

  // Headers
  const headers = [
    "Location",
    "Total Supply",
    "Avg Price",
    "Min Price",
    "Max Price",
    "For Sale %",
    "For Rent %",
    "Apartment %",
    "Villa %",
    "Land %",
    "Furnished %",
    "Unfurnished %",
    "New Listings (7d)",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10b981" } };

  // Data rows
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const [location, items] of byLocation) {
    const prices = items.map((s) => s.price || 0).filter((p) => p > 0);
    const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    const forSale = items.filter((s) => (s.purpose || "").includes("sale")).length;
    const forRent = items.filter((s) => (s.purpose || "").includes("rent")).length;

    const types = items.map((s) => (s.propertyType || "").toLowerCase());
    const furnished = items.filter((s) => (s.furnishing || "").includes("furnished")).length;

    const newListings = items.filter((s) => new Date(s.createdAt || s.timestamp || new Date()) > sevenDaysAgo).length;

    sheet.addRow([
      location,
      items.length,
      avgPrice,
      minPrice,
      maxPrice,
      Math.round((forSale / items.length) * 100) || 0,
      Math.round((forRent / items.length) * 100) || 0,
      Math.round((types.filter((t) => t.includes("apartment")).length / items.length) * 100) || 0,
      Math.round((types.filter((t) => t.includes("villa")).length / items.length) * 100) || 0,
      Math.round((types.filter((t) => t.includes("land")).length / items.length) * 100) || 0,
      Math.round((furnished / items.length) * 100) || 0,
      Math.round(((items.length - furnished) / items.length) * 100) || 0,
      newListings,
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 14;
    col.alignment = { horizontal: "center" };
  });
}

// ─── SHEET 4: Supply vs Demand by Location ──────────────────────────────────
function createLocationComparisonSheet(workbook: ExcelJS.Workbook, supplies: any[], demands: any[]) {
  const sheet = workbook.addWorksheet("Location Comparison");

  // Aggregate by location
  const locations = new Set<string>();
  supplies.forEach((s) => locations.add(s.location || "Unknown"));
  demands.forEach((d) => locations.add(d.location || "Unknown"));

  // Headers
  const headers = [
    "Location",
    "Supply Count",
    "Demand Count",
    "D/S Ratio",
    "Market Status",
    "Avg Supply Price",
    "Avg Demand Budget",
    "Price Gap",
    "Total Matches",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8b5cf6" } };

  // Data rows
  for (const location of Array.from(locations).sort()) {
    const supplyItems = supplies.filter((s) => s.location === location);
    const demandItems = demands.filter((d) => d.location === location);

    const supplyCount = supplyItems.length;
    const demandCount = demandItems.length;
    const ratio = supplyCount > 0 ? (demandCount / supplyCount).toFixed(2) : "0.00";

    const avgSupplyPrice =
      supplyItems.length > 0
        ? Math.round(
            supplyItems.map((s) => s.price || 0).reduce((a, b) => a + b, 0) / supplyItems.length
          )
        : 0;

    const avgDemandBudget =
      demandItems.length > 0
        ? Math.round(
            demandItems.map((d) => d.budget || 0).reduce((a, b) => a + b, 0) / demandItems.length
          )
        : 0;

    const priceGap = avgSupplyPrice > 0 && avgDemandBudget > 0 ? Math.round(avgSupplyPrice - avgDemandBudget) : 0;

    let marketStatus = "Balanced";
    if (parseFloat(ratio as string) > 2) marketStatus = "High Demand";
    else if (parseFloat(ratio as string) < 0.5) marketStatus = "High Supply";

    sheet.addRow([
      location,
      supplyCount,
      demandCount,
      ratio,
      marketStatus,
      avgSupplyPrice,
      avgDemandBudget,
      priceGap,
      0, // Placeholder for matches
    ]);
  }

  sheet.columns.forEach((col) => {
    col.width = 16;
    col.alignment = { horizontal: "center" };
  });
}

// ─── SHEET 5: Broker vs End-User Breakdown ───────────────────────────────────
function createBrokerEndUserSheet(workbook: ExcelJS.Workbook, messages: any[]) {
  const sheet = workbook.addWorksheet("Broker vs End-User");

  // Classify messages
  const brokerKeywords = [
    "عندي عميل",
    "بدور لعميل",
    "معايا وحدة",
    "لدى عميل",
    "available units",
    "multiple listing",
  ];
  const endUserKeywords = ["محتاج", "محتاجة", "بدور على", "عايز", "عاوز", "طالب لنفسي"];

  let brokerCount = 0;
  let endUserCount = 0;
  let unknownCount = 0;

  const brokerMessages: any[] = [];
  const endUserMessages: any[] = [];

  for (const msg of messages) {
    const text = (msg.rawMessage || msg.message || "").toLowerCase();

    let isBroker = false;
    let isEndUser = false;

    for (const keyword of brokerKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        isBroker = true;
        break;
      }
    }

    for (const keyword of endUserKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        isEndUser = true;
        break;
      }
    }

    if (isBroker) {
      brokerCount++;
      brokerMessages.push(msg);
    } else if (isEndUser) {
      endUserCount++;
      endUserMessages.push(msg);
    } else {
      unknownCount++;
    }
  }

  const total = messages.length;

  // Summary section
  sheet.addRow(["ROLE CLASSIFICATION SUMMARY"]);
  sheet.addRow([]);

  const summaryHeaders = ["Role", "Count", "Percentage"];
  const summaryHeaderRow = sheet.addRow(summaryHeaders);
  summaryHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  summaryHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf59e0b" } };

  sheet.addRow(["Broker", brokerCount, `${((brokerCount / total) * 100).toFixed(1)}%`]);
  sheet.addRow(["End User", endUserCount, `${((endUserCount / total) * 100).toFixed(1)}%`]);
  sheet.addRow(["Unknown", unknownCount, `${((unknownCount / total) * 100).toFixed(1)}%`]);

  sheet.addRow([]);
  sheet.addRow(["SAMPLE BROKER MESSAGES"]);
  const brokerHeaderRow = sheet.addRow(["Phone", "Message", "Date"]);
  brokerHeaderRow.font = { bold: true };
  brokerHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4B5" } };

  for (const msg of brokerMessages.slice(0, 10)) {
    sheet.addRow([msg.senderPhone || msg.sender_phone || "", (msg.rawMessage || msg.message || "").substring(0, 100), new Date(msg.createdAt || msg.timestamp || new Date()).toLocaleDateString()]);
  }

  sheet.addRow([]);
  sheet.addRow(["SAMPLE END-USER MESSAGES"]);
  const endUserHeaderRow = sheet.addRow(["Phone", "Message", "Date"]);
  endUserHeaderRow.font = { bold: true };
  endUserHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCE5ff" } };

  for (const msg of endUserMessages.slice(0, 10)) {
    sheet.addRow([msg.senderPhone || msg.sender_phone || "", (msg.rawMessage || msg.message || "").substring(0, 100), new Date(msg.createdAt || msg.timestamp || new Date()).toLocaleDateString()]);
  }

  sheet.columns.forEach((col) => {
    col.width = col.header === "Message" ? 50 : 20;
    if (col.header === "Message") col.alignment = { wrapText: true };
  });
}

// ─── SHEET 6: Time Trends ────────────────────────────────────────────────────
function createTimeTrendsSheet(workbook: ExcelJS.Workbook, messages: any[]) {
  const sheet = workbook.addWorksheet("Time Trends");

  // Group by hour
  const hourlyData = new Map<number, { demand: number; supply: number }>();
  for (let i = 0; i < 24; i++) {
    hourlyData.set(i, { demand: 0, supply: 0 });
  }

  for (const msg of messages) {
    const date = new Date(msg.createdAt || msg.timestamp || new Date());
    const hour = date.getHours();
    const classification = msg.classification || "GENERAL";

    const entry = hourlyData.get(hour) || { demand: 0, supply: 0 };
    if (classification === "DEMAND") entry.demand++;
    else if (classification === "SUPPLY") entry.supply++;

    hourlyData.set(hour, entry);
  }

  // Headers
  const headers = ["Hour", "Demand Count", "Supply Count", "Total Activity"];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF06b6d4" } };

  // Data rows
  for (let hour = 0; hour < 24; hour++) {
    const data = hourlyData.get(hour) || { demand: 0, supply: 0 };
    const total = data.demand + data.supply;
    sheet.addRow([`${hour}:00`, data.demand, data.supply, total]);
  }

  sheet.columns.forEach((col) => {
    col.width = 16;
    col.alignment = { horizontal: "center" };
  });
}

// ─── SHEET 7: Contacts & Outreach List ───────────────────────────────────────
function createContactsSheet(workbook: ExcelJS.Workbook, messages: any[]) {
  const sheet = workbook.addWorksheet("Contacts & Outreach");

  // Group by phone
  const contactMap = new Map<string, any[]>();
  for (const msg of messages) {
    const phone = msg.senderPhone || msg.sender_phone || "Unknown";
    if (!contactMap.has(phone)) contactMap.set(phone, []);
    contactMap.get(phone)!.push(msg);
  }

  // Headers
  const headers = [
    "Phone",
    "Name",
    "Role",
    "Classification",
    "Message Count",
    "Last Message Date",
    "Last Message",
    "Action Priority",
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFec4899" } };

  // Data rows
  for (const [phone, msgs] of contactMap) {
    const lastMsg = msgs[msgs.length - 1];
    const lastDate = new Date(lastMsg.createdAt || lastMsg.timestamp || new Date());

    // Determine role
    const brokerKeywords = ["عندي عميل", "بدور لعميل", "معايا وحدة", "لدى عميل"];
    let role = "Unknown";
    for (const keyword of brokerKeywords) {
      if (msgs.some((m) => (m.rawMessage || m.message || "").includes(keyword))) {
        role = "Broker";
        break;
      }
    }
    if (role === "Unknown" && msgs.some((m) => m.classification === "SUPPLY")) role = "Seller";
    if (role === "Unknown" && msgs.some((m) => m.classification === "DEMAND")) role = "Buyer";

    // Priority
    let priority = "Low";
    if (msgs.length > 10) priority = "High";
    else if (msgs.length > 5) priority = "Medium";

    sheet.addRow([
      phone,
      lastMsg.senderName || lastMsg.sender_name || "",
      role,
      msgs.map((m) => m.classification || "GENERAL").join(", "),
      msgs.length,
      lastDate.toLocaleDateString("en-EG", { timeZone: "Africa/Cairo" }),
      (lastMsg.rawMessage || lastMsg.message || "").substring(0, 50),
      priority,
    ]);
  }

  sheet.columns.forEach((col, idx) => {
    col.width = idx === 6 ? 50 : 16;
    if (idx === 6) col.alignment = { wrapText: true };
  });
}
