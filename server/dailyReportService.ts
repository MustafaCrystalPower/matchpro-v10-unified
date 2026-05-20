import { getDb } from "./db";
import { supply, demand, matches } from "../drizzle/schema";
import { eq, gte, lte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

// Green API credentials
const GREEN_API_INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID || "7105409203";
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN || "0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3";
const GREEN_API_URL = `https://${GREEN_API_INSTANCE_ID}.api.greenapi.com`;

// Email configuration
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "noreply@crystalpowerinvestment.com";
const SMTP_PASS = process.env.SMTP_PASS || "";
const REPORT_EMAIL = "mmaisara@crystalpowerinvestment.com";
const REPORT_PHONE = "201066505665";

interface DailyStats {
  totalSupply: number;
  totalDemand: number;
  newSupply: number;
  newDemand: number;
  totalMatches: number;
  highConfidenceMatches: number;
  averageScore: number;
}

interface MatchRecord {
  id: string;
  supplyId: string;
  demandId: string;
  score: number;
  reason: string;
  createdAt: Date;
  supplyLocation?: string;
  supplyPrice?: number;
  demandLocation?: string;
  demandBudget?: number;
}

export async function generateDailyReport(): Promise<string> {
  try {
    console.log("[Daily Report] Generating report...");

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch statistics
    const stats = await getDailyStats(today, tomorrow);

    // Fetch today's matches
    const todayMatches = await getTodayMatches(today, tomorrow);

    // Generate Excel file
    const excelPath = await generateExcelReport(stats, todayMatches);

    // Send email with Excel attachment
    await sendEmailReport(excelPath, stats);

    // Send WhatsApp summary
    await sendWhatsAppSummary(stats, todayMatches);

    console.log("[Daily Report] Report generated and sent successfully");
    return excelPath;
  } catch (error) {
    console.error("[Daily Report] Error:", error);
    throw error;
  }
}

async function getDailyStats(startDate: Date, endDate: Date): Promise<DailyStats> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error('Database connection failed');

  // Total supply
  const totalSupplyResult = await dbInstance
    .select({ count: supply.id })
    .from(supply);
  const totalSupply = totalSupplyResult[0]?.count || 0;

  // Total demand
  const totalDemandResult = await dbInstance
    .select({ count: demand.id })
    .from(demand);
  const totalDemand = totalDemandResult[0]?.count || 0;

  // New supply today
  const newSupplyResult = await dbInstance
    .select({ count: supply.id })
    .from(supply)
    .where(gte(supply.createdAt, startDate));
  const newSupply = newSupplyResult[0]?.count || 0;

  // New demand today
  const newDemandResult = await dbInstance
    .select({ count: demand.id })
    .from(demand)
    .where(gte(demand.createdAt, startDate));
  const newDemand = newDemandResult[0]?.count || 0;

  // Total matches
  const totalMatchesResult = await dbInstance
    .select({ count: matches.id })
    .from(matches);
  const totalMatches = totalMatchesResult[0]?.count || 0;

  // High confidence matches (matchScore > 80)
  const highConfidenceResult = await dbInstance
    .select({ count: matches.id })
    .from(matches)
    .where(gte(matches.matchScore, '80'));
  const highConfidenceMatches = highConfidenceResult[0]?.count || 0;

  // Average score
  const avgScoreResult = await dbInstance
    .select()
    .from(matches);
  const averageScore =
    avgScoreResult.length > 0
      ? avgScoreResult.reduce((sum: number, m: any) => sum + (parseFloat(m.matchScore as string) || 0), 0) / avgScoreResult.length
      : 0;

  return {
    totalSupply,
    totalDemand,
    newSupply,
    newDemand,
    totalMatches,
    highConfidenceMatches,
    averageScore: Math.round(averageScore * 100) / 100,
  };
}

async function getTodayMatches(startDate: Date, endDate: Date): Promise<MatchRecord[]> {
  const dbInstance = await getDb();
  if (!dbInstance) throw new Error('Database connection failed');

  const todayMatches = await dbInstance
    .select()
    .from(matches)
    .where(gte(matches.createdAt, startDate));

  return todayMatches.map((m: any) => ({
    id: m.id,
    supplyId: m.supplyId,
    demandId: m.demandId,
    score: parseFloat(m.matchScore as string) || 0,
    reason: m.reason || "Automatic match",
    createdAt: m.createdAt,
  }));
}

async function generateExcelReport(stats: DailyStats, todayMatches: MatchRecord[]): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  // Summary sheet
  const summarySheet = workbook.addWorksheet("Daily Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 15 },
  ];

  const rows = [
    { metric: "Total Supply Records", value: stats.totalSupply },
    { metric: "Total Demand Records", value: stats.totalDemand },
    { metric: "New Supply Today", value: stats.newSupply },
    { metric: "New Demand Today", value: stats.newDemand },
    { metric: "Total Matches", value: stats.totalMatches },
    { metric: "High Confidence Matches (>80%)", value: stats.highConfidenceMatches },
    { metric: "Average Match Score", value: stats.averageScore },
  ];
  summarySheet.addRows(rows);

  // Matches sheet
  const matchesSheet = workbook.addWorksheet("Today's Matches");
  matchesSheet.columns = [
    { header: "Match ID", key: "id", width: 20 },
    { header: "Supply ID", key: "supplyId", width: 20 },
    { header: "Demand ID", key: "demandId", width: 20 },
    { header: "Score", key: "matchScore", width: 10 },
    { header: "Reason", key: "reason", width: 40 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  const matchRows = todayMatches.map(m => ({
    id: m.id,
    supplyId: m.supplyId,
    demandId: m.demandId,
    matchScore: m.score,
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
  }));
  matchesSheet.addRows(matchRows);

  // Save file
  const fileName = `MatchPro_Daily_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
  const filePath = path.join("/tmp", fileName);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

async function sendEmailReport(excelPath: string, stats: DailyStats): Promise<void> {
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const htmlContent = `
      <h2>MatchPro Daily Report</h2>
      <p>Date: ${new Date().toLocaleDateString()}</p>
      
      <h3>Daily Statistics</h3>
      <ul>
        <li>Total Supply Records: ${stats.totalSupply}</li>
        <li>Total Demand Records: ${stats.totalDemand}</li>
        <li>New Supply Today: ${stats.newSupply}</li>
        <li>New Demand Today: ${stats.newDemand}</li>
        <li>Total Matches: ${stats.totalMatches}</li>
        <li>High Confidence Matches (>80%): ${stats.highConfidenceMatches}</li>
        <li>Average Match Score: ${stats.averageScore}%</li>
      </ul>
      
      <p>See attached Excel file for detailed match information.</p>
    `;

    await transporter.sendMail({
      from: SMTP_USER,
      to: REPORT_EMAIL,
      subject: `MatchPro Daily Report - ${new Date().toLocaleDateString()}`,
      html: htmlContent,
      attachments: [
        {
          filename: path.basename(excelPath),
          path: excelPath,
        },
      ],
    });

    console.log("[Daily Report] Email sent successfully");
  } catch (error) {
    console.error("[Daily Report] Email error:", error);
    throw error;
  }
}

async function sendWhatsAppSummary(stats: DailyStats, todayMatches: MatchRecord[]): Promise<void> {
  try {
    const summary = `
📊 *MatchPro Daily Report - ${new Date().toLocaleDateString()}*

📈 *Statistics:*
• Total Supply: ${stats.totalSupply}
• Total Demand: ${stats.totalDemand}
• New Supply Today: ${stats.newSupply}
• New Demand Today: ${stats.newDemand}
• Total Matches: ${stats.totalMatches}
• High Confidence: ${stats.highConfidenceMatches} (>80%)
• Average Score: ${stats.averageScore}%

📧 Full Excel report sent to email.
    `.trim();

    const response = await fetch(`${GREEN_API_URL}/waInstance/${GREEN_API_INSTANCE_ID}/sendMessage/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiToken: GREEN_API_TOKEN,
        chatId: `${REPORT_PHONE}@c.us`,
        message: summary,
      }),
    });

    if (!response.ok) {
      throw new Error(`Green API error: ${response.statusText}`);
    }

    console.log("[Daily Report] WhatsApp summary sent successfully");
  } catch (error) {
    console.error("[Daily Report] WhatsApp error:", error);
    throw error;
  }
}

// Schedule daily report at 9 AM
export function scheduleDaily9AMReport(): void {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(9, 0, 0, 0);

  // If 9 AM has already passed today, schedule for tomorrow
  if (now > scheduledTime) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const timeUntilReport = scheduledTime.getTime() - now.getTime();

  console.log(
    `[Daily Report] Scheduled for ${scheduledTime.toLocaleString()} (in ${Math.round(timeUntilReport / 1000 / 60)} minutes)`
  );

  setTimeout(() => {
    generateDailyReport().catch(console.error);
    // Schedule again for tomorrow
    setInterval(() => {
      generateDailyReport().catch(console.error);
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, timeUntilReport);
}
