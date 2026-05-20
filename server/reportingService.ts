/**
 * MatchPro Automated Excel Reporting Service
 * Generates and emails Excel reports at 9:00 AM and 10:00 PM daily (Cairo time, UTC+2)
 * Two sheets: Match Details + Summary
 */

import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import { getDb } from "./db";
import { matches, supply, demand } from "../drizzle/schema";
import { eq, gte, lte, and, isNull, desc, sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportLog {
  timestamp: string;
  cycle: "9AM" | "10PM";
  status: "success" | "failure";
  rowCount: number;
  emailDelivered: boolean;
  error?: string;
  durationMs: number;
}

// ─── In-memory report log (persists until server restart) ─────────────────────
const reportLogs: ReportLog[] = [];

export function getReportLogs(): ReportLog[] {
  return [...reportLogs].reverse(); // newest first
}

// ─── Email configuration ──────────────────────────────────────────────────────
function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP credentials not configured. Set SMTP_USER and SMTP_PASS.");
  }

  // Auto-detect SMTP host from user domain if SMTP_HOST not explicitly set
  const domain = (user.split("@")[1] || "").toLowerCase();
  let host = process.env.SMTP_HOST;
  if (!host) {
    if (domain.includes("gmail")) {
      host = "smtp.gmail.com";
    } else if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) {
      host = "smtp.office365.com";
    } else if (domain.includes("yahoo")) {
      host = "smtp.mail.yahoo.com";
    } else {
      host = `mail.${domain}`;
    }
    console.log(`[MatchPro Reports] SMTP_HOST auto-detected: ${host}`);
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

function getRecipients(): string[] {
  const env = process.env.REPORT_RECIPIENTS;
  if (!env) return ["mmaisara@crystalpowerinvestment.com"];
  return env.split(",").map(e => e.trim()).filter(Boolean);
}

// ─── Excel report generator ───────────────────────────────────────────────────
async function generateExcelReport(
  windowStart: Date,
  windowEnd: Date,
  cycle: "9AM" | "10PM"
): Promise<{ buffer: Buffer; rowCount: number; summary: Record<string, unknown> }> {

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch matches in the reporting window
  const rawMatches = await db
    .select({
      id: matches.id,
      matchScore: matches.matchScore,
      status: matches.status,
      transactionType: matches.transactionType,
      supplyContactName: matches.supplyContactName,
      supplyContactPhone: matches.supplyContactPhone,
      demandContactName: matches.demandContactName,
      demandContactPhone: matches.demandContactPhone,
      matchSummary: matches.matchSummary,
      notes: matches.notes,
      supplyId: matches.supplyId,
      demandId: matches.demandId,
      createdAt: matches.createdAt,
      updatedAt: matches.updatedAt,
    })
    .from(matches)
    .where(
      and(
        gte(matches.createdAt, windowStart),
        lte(matches.createdAt, windowEnd)
      )
    )
    .orderBy(desc(matches.matchScore))
    .limit(1000);

  // Use contact info already embedded in matches table
  const enriched = rawMatches.map((m: typeof rawMatches[0]) => ({
    ...m,
    supply: { name: m.supplyContactName, phone: m.supplyContactPhone },
    demand: { name: m.demandContactName, phone: m.demandContactPhone },
  }));

  // Compute summary stats with quality distribution
  const excellent = enriched.filter((m: typeof enriched[0]) => Number(m.matchScore || 0) >= 90).length;
  const high = enriched.filter((m: typeof enriched[0]) => {
    const score = Number(m.matchScore || 0);
    return score >= 85 && score < 90;
  }).length;
  const medium = enriched.filter((m: typeof enriched[0]) => {
    const score = Number(m.matchScore || 0);
    return score >= 75 && score < 85;
  }).length;
  const highConfidence = excellent + high;
  const scores = enriched.map((m: typeof enriched[0]) => Number(m.matchScore || 0)).filter(s => s > 0).sort((a, b) => a - b);
  const minScore = scores.length > 0 ? scores[0] : 0;
  const maxScore = scores.length > 0 ? scores[scores.length - 1] : 0;
  const avgScore = enriched.length > 0
    ? Math.round(enriched.reduce((s: number, m: typeof enriched[0]) => s + Number(m.matchScore || 0), 0) / enriched.length)
    : 0;

  // No location/propertyType in matches table — derive from matchSummary or leave blank
  const topLocations = "—";
  const topTypes = "—";

  const totalSupply = new Set(enriched.map((m: typeof enriched[0]) => m.supplyId).filter(Boolean)).size;
  const totalDemand = new Set(enriched.map((m: typeof enriched[0]) => m.demandId).filter(Boolean)).size;
  const supplyDemandRatio = totalDemand > 0 ? (totalSupply / totalDemand).toFixed(2) : "—";

  const summary = {
    reportDate: new Date().toLocaleDateString("en-GB"),
    reportTime: new Date().toLocaleTimeString("en-GB"),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    totalMatches: enriched.length,
    excellentMatches: excellent,
    highMatches: high,
    mediumMatches: medium,
    highConfidenceMatches: highConfidence,
    averageScore: avgScore,
    minScore,
    maxScore,
    totalSupply,
    totalDemand,
    supplyDemandRatio,
    topLocations,
    topTypes,
  };

  // ─── Build Excel workbook ─────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "MatchPro Intelligence Engine™";
  wb.created = new Date();

  // ── Sheet 1: Match Details ──
  const ws1 = wb.addWorksheet("Match Details");

  // Header styling - Updated to match template
  const headerFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0070C0" } };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  const excellentFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5F5E3" } };
  const highFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F3FF" } };
  const medFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" } };

  const cols = [
    { header: "Match ID", key: "id", width: 12 },
    { header: "Score %", key: "score", width: 10 },
    { header: "Confidence", key: "confidence", width: 12 },
    { header: "Status", key: "status", width: 10 },
    { header: "Transaction", key: "transaction", width: 12 },
    { header: "Seller Name", key: "sellerName", width: 18 },
    { header: "Seller Phone", key: "sellerPhone", width: 14 },
    { header: "Buyer Name", key: "buyerName", width: 14 },
    { header: "Buyer Phone", key: "buyerPhone", width: 14 },
    { header: "Match Summary", key: "summary", width: 50 },
    { header: "Notes", key: "notes", width: 15 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Updated At", key: "updatedAt", width: 18 },
  ];

  ws1.columns = cols;

  // Style header row
  const headerRow = ws1.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = { bottom: { style: "medium", color: { argb: "FF0070C0" } } };
  });
  headerRow.height = 22;

  // Add data rows
  enriched.forEach((m: typeof enriched[0]) => {
    const score = Number(m.matchScore) || 0;
    const confidence = score >= 90 ? "Excellent" : score >= 85 ? "High" : score >= 70 ? "Medium" : "Low";
    const row = ws1.addRow({
      id: m.id,
      score: score,
      confidence,
      status: m.status || "new",
      transaction: m.transactionType || "",
      sellerName: m.supply?.name || "",
      sellerPhone: m.supply?.phone || "",
      buyerName: m.demand?.name || "",
      buyerPhone: m.demand?.phone || "",
      summary: m.matchSummary || "",
      notes: m.notes || "",
      createdAt: m.createdAt ? new Date(m.createdAt).toLocaleString("en-GB") : "",
      updatedAt: m.updatedAt ? new Date(m.updatedAt).toLocaleString("en-GB") : "",
    });

    // Conditional formatting by score
    if (score >= 90) {
      row.eachCell(cell => { cell.fill = excellentFill; });
    } else if (score >= 85) {
      row.eachCell(cell => { cell.fill = highFill; });
    } else if (score >= 75) {
      row.eachCell(cell => { cell.fill = medFill; });
    }

    // Format score cell
    const scoreCell = row.getCell("score");
    scoreCell.numFmt = "0\"%\"";
    scoreCell.font = { bold: true, color: { argb: score >= 90 ? "FF00B050" : score >= 85 ? "FF0070C0" : score >= 75 ? "FFFF9800" : "FFFF0000" } };
  });

  // Freeze header row
  ws1.views = [{ state: "frozen", ySplit: 1 }];
  ws1.autoFilter = { from: "A1", to: "M1" };

  // ── Sheet 2: Summary ──
  const ws2 = wb.addWorksheet("Summary");
  ws2.columns = [{ width: 35 }, { width: 45 }];

  const addSummaryRow = (label: string, value: string | number, bold = false) => {
    const row = ws2.addRow([label, value]);
    if (bold) {
      row.getCell(1).font = { bold: true, size: 12 };
      row.getCell(2).font = { bold: true, size: 12, color: { argb: "FF1B4F72" } };
    }
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: bold ? "FFD6EAF8" : "FFFFFFFF" } };
    row.height = bold ? 20 : 16;
  };

  ws2.addRow(["MatchPro Intelligence Engine™ — Daily Report"]).getCell(1).font = { bold: true, size: 14, color: { argb: "FF0070C0" } };
  ws2.addRow(["Crystal Power Investments LLC"]).getCell(1).font = { italic: true, color: { argb: "FF555555" } };
  ws2.addRow([]);
  addSummaryRow("Report Date", summary.reportDate, true);
  addSummaryRow("Report Time", summary.reportTime, true);
  addSummaryRow("Reporting Cycle", cycle, true);
  ws2.addRow([]);
  addSummaryRow("Window Start", new Date(summary.windowStart).toLocaleString("en-GB"), false);
  addSummaryRow("Window End", new Date(summary.windowEnd).toLocaleString("en-GB"), false);
  ws2.addRow([]);
  ws2.addRow(["MATCH STATISTICS"]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF00B050" } };
  addSummaryRow("Total Matches", summary.totalMatches, false);
  addSummaryRow("Excellent (90%+)", summary.excellentMatches, false);
  addSummaryRow("High (85-89%)", summary.highMatches, false);
  addSummaryRow("Medium (75-84%)", summary.mediumMatches, false);
  ws2.addRow([]);
  ws2.addRow(["QUALITY METRICS"]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF00B050" } };
  addSummaryRow("Average Score", `${summary.averageScore}%`, false);
  addSummaryRow("Min Score", `${summary.minScore}%`, false);
  addSummaryRow("Max Score", `${summary.maxScore}%`, false);
  ws2.addRow([]);
  ws2.addRow(["MARKET OVERVIEW"]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF00B050" } };
  addSummaryRow("Unique Sellers", summary.totalSupply, false);
  addSummaryRow("Unique Buyers", summary.totalDemand, false);
  addSummaryRow("Supply/Demand Ratio", summary.supplyDemandRatio, false);
  const windowStartTime = new Date(summary.windowStart).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const windowEndTime = new Date(summary.windowEnd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  addSummaryRow("Reporting Window", `13 hours (${windowStartTime} - ${windowEndTime} Cairo time)`, false);
  ws2.addRow([]);
  ws2.addRow(["Generated by MatchPro Intelligence Engine™"]).getCell(1).font = { italic: true, size: 9, color: { argb: "FF888888" } };
  ws2.addRow([`© 2026 Crystal Power Investments LLC · PDPL Compliant`]).getCell(1).font = { italic: true, size: 9, color: { argb: "FF888888" } };

  // ── Sheet 3: High-Confidence Only (≥90%) ──
  const excellentMatches = enriched.filter(m => Number(m.matchScore || 0) >= 90);
  if (excellentMatches.length > 0) {
    const ws3 = wb.addWorksheet("Excellent Matches (90%+)");
    ws3.columns = cols;
    const hr3 = ws3.getRow(1);
    hr3.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } }; cell.font = headerFont; cell.alignment = { vertical: "middle", horizontal: "center" }; cell.border = { bottom: { style: "medium", color: { argb: "FFFFC000" } } }; });
    hr3.height = 22;
    excellentMatches.forEach((m: typeof rawMatches[0] & { supply: { name: string; phone: string }; demand: { name: string; phone: string } }) => {
      ws3.addRow({
        id: m.id, score: Number(m.matchScore), confidence: "Excellent",
        status: m.status || "new",
        transaction: m.transactionType || "",
        sellerName: m.supply?.name || "", sellerPhone: m.supply?.phone || "",
        buyerName: m.demand?.name || "", buyerPhone: m.demand?.phone || "",
        summary: m.matchSummary || "",
        notes: m.notes || "",
        createdAt: m.createdAt ? new Date(m.createdAt).toLocaleString("en-GB") : "",
        updatedAt: m.updatedAt ? new Date(m.updatedAt).toLocaleString("en-GB") : "",
      });
    });
    ws3.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, rowCount: enriched.length, summary };
}

// ─── Email sender ─────────────────────────────────────────────────────────────
async function sendReportEmail(
  buffer: Buffer,
  cycle: "9AM" | "10PM",
  rowCount: number,
  summary: Record<string, unknown>
): Promise<void> {
  const transporter = getTransporter();
  const recipients = getRecipients();
  const dateStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
  const filename = `MatchPro_Report_${dateStr}_${cycle}.xlsx`;

  const subject = `MatchPro Daily Match Report — ${cycle === "9AM" ? "9:00 AM" : "10:00 PM"} · ${new Date().toLocaleDateString("en-GB")}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1B4F72; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">MatchPro Intelligence Engine™</h2>
        <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">Crystal Power Investments LLC · Daily Report</p>
      </div>
      <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; color: #555;">Report Cycle</td><td style="padding: 8px; font-weight: bold;">${cycle === "9AM" ? "9:00 AM Morning Report" : "10:00 PM Evening Report"}</td></tr>
          <tr style="background: #fff;"><td style="padding: 8px; color: #555;">Total Matches</td><td style="padding: 8px; font-weight: bold; color: #1B4F72;">${rowCount}</td></tr>
          <tr><td style="padding: 8px; color: #555;">High-Confidence (≥85%)</td><td style="padding: 8px; font-weight: bold; color: #1E8449;">${summary.highConfidenceMatches}</td></tr>
          <tr style="background: #fff;"><td style="padding: 8px; color: #555;">Average Match Score</td><td style="padding: 8px; font-weight: bold;">${summary.averageScore}%</td></tr>
          <tr><td style="padding: 8px; color: #555;">Reporting Window</td><td style="padding: 8px; font-size: 12px; color: #777;">${new Date(summary.windowStart as string).toLocaleString("en-GB")} → ${new Date(summary.windowEnd as string).toLocaleString("en-GB")}</td></tr>
          <tr style="background: #fff;"><td style="padding: 8px; color: #555;">Top Locations</td><td style="padding: 8px; font-size: 12px;">${summary.topLocations || "—"}</td></tr>
        </table>
        <p style="margin-top: 16px; font-size: 12px; color: #888;">The full Excel report is attached. Sheet 1: All matches · Sheet 2: Summary · Sheet 3: Excellent matches (90%+)</p>
        <hr style="border: none; border-top: 1px solid #dee2e6; margin: 16px 0;">
        <p style="font-size: 11px; color: #aaa; margin: 0;">MatchPro Intelligence Engine™ · Crystal Power Investments LLC · PDPL Compliant · © 2026</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"MatchPro Reports" <${process.env.SMTP_USER}>`,
    to: recipients.join(", "),
    subject,
    html,
    attachments: [{ filename, content: buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
  });
}

// ─── Main report runner ───────────────────────────────────────────────────────
export async function runReport(cycle: "9AM" | "10PM"): Promise<ReportLog> {
  const startTime = Date.now();
  const now = new Date();

  // Reporting window: last 13 hours for 9AM (covers overnight), last 13 hours for 10PM
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 13 * 60 * 60 * 1000);

  const log: ReportLog = {
    timestamp: now.toISOString(),
    cycle,
    status: "failure",
    rowCount: 0,
    emailDelivered: false,
    durationMs: 0,
  };

  try {
    const { buffer, rowCount, summary } = await generateExcelReport(windowStart, windowEnd, cycle);
    log.rowCount = rowCount;

    try {
      await sendReportEmail(buffer, cycle, rowCount, summary);
      log.emailDelivered = true;
    } catch (emailErr) {
      log.error = `Report generated but email failed: ${(emailErr as Error).message}`;
    }

    log.status = "success";
  } catch (err) {
    log.error = (err as Error).message;
    log.status = "failure";
  }

  log.durationMs = Date.now() - startTime;
  reportLogs.push(log);

  // Keep only last 100 log entries
  if (reportLogs.length > 100) reportLogs.splice(0, reportLogs.length - 100);

  console.log(`[MatchPro Reports] ${cycle} cycle: ${log.status} · ${log.rowCount} rows · ${log.durationMs}ms · email: ${log.emailDelivered}`);
  return log;
}

// ─── Scheduler (runs inside the Express server process) ──────────────────────
let schedulerStarted = false;

export function startReportScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Cairo time is UTC+2. We schedule by checking every minute.
  setInterval(() => {
    const now = new Date();
    // Convert to Cairo time (UTC+2)
    const cairoHour = (now.getUTCHours() + 2) % 24;
    const cairoMinute = now.getUTCMinutes();

    if (cairoMinute === 0) {
      if (cairoHour === 9) {
        runReport("9AM").catch(err => console.error("[MatchPro Reports] 9AM scheduler error:", err));
      } else if (cairoHour === 22) {
        runReport("10PM").catch(err => console.error("[MatchPro Reports] 10PM scheduler error:", err));
      }
    }
  }, 60 * 1000); // check every minute

  console.log("[MatchPro Reports] Scheduler started — reports at 9:00 AM and 10:00 PM Cairo time (UTC+2)");
}
