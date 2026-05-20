/**
 * Integrated Report Scheduler
 * 6-hour scheduler combining AI extraction, Excel generation, and distribution
 */

import { getDb } from "./db";
import { extractLeadFromMessage, batchExtractLeads, ExtractedLead } from "./aiExtractionEngine";
import { generateEnhancedExcelReport } from "./enhancedExcelGenerator";
import { sendReportViaEmail } from "./whatsappReportDistribution";
import { storagePut } from "./storage";
import { LOCATION_MAPPINGS, normalizeLocationToKey, getAllLocationKeys } from "./locationMappings";

interface ScheduledReportRun {
  runId: string;
  startTime: Date;
  endTime: Date;
  totalMessages: number;
  extractedLeads: number;
  reportsGenerated: number;
  emailsSent: number;
  status: "running" | "completed" | "failed";
  error?: string;
}

let currentRun: ScheduledReportRun | null = null;

/**
 * Execute full report generation cycle
 */
export async function executeReportCycle(): Promise<ScheduledReportRun> {
  const runId = `RUN-${Date.now()}`;
  const startTime = new Date();

  currentRun = {
    runId,
    startTime,
    endTime: new Date(),
    totalMessages: 0,
    extractedLeads: 0,
    reportsGenerated: 0,
    emailsSent: 0,
    status: "running",
  };

  try {
    console.log(`[IntegratedScheduler] 🚀 Starting report cycle ${runId}`);

    // Step 1: Fetch recent messages (last 6 hours)
    const messages = await fetchRecentMessages(6);
    currentRun.totalMessages = messages.length;
    console.log(`[IntegratedScheduler] 📨 Fetched ${messages.length} messages`);

    // Step 2: Extract leads using AI
    const extractedLeads = await batchExtractLeads(messages);
    currentRun.extractedLeads = extractedLeads.length;
    console.log(`[IntegratedScheduler] 🤖 Extracted ${extractedLeads.length} leads`);

    // Step 3: Group leads by location
    const leadsByLocation = groupLeadsByLocation(extractedLeads);
    console.log(`[IntegratedScheduler] 📍 Grouped into ${Object.keys(leadsByLocation).length} locations`);

    // Step 4: Generate Excel reports per location
    const reportUrls: Record<string, string> = {};
    for (const [locationKey, leads] of Object.entries(leadsByLocation)) {
      try {
        const mapping = LOCATION_MAPPINGS[locationKey];
        const excelBuffer = await generateEnhancedExcelReport({
          title: `MatchPro ${mapping.arabicKeywords[0]} Demand Leads`,
          location: mapping.arabicKeywords[0],
          leads,
          generatedDate: new Date(),
          companyName: "Crystal Power Investments",
        });

        // Upload to S3
        const fileKey = `reports/${locationKey}/${runId}.xlsx`;
        const { url } = await storagePut(fileKey, excelBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        reportUrls[locationKey] = url;
        currentRun.reportsGenerated++;

        console.log(`[IntegratedScheduler] ✅ Generated report for ${mapping.arabicKeywords[0]}: ${leads.length} leads`);
      } catch (error) {
        console.error(`[IntegratedScheduler] ❌ Failed to generate report for ${locationKey}:`, error);
      }
    }

    // Step 5: Send reports via email
    const ownerEmail = process.env.REPORT_TO_EMAIL || "momenmaisara@crystalpowerinvestments.com";
    for (const [locationKey, url] of Object.entries(reportUrls)) {
      try {
        const mapping = LOCATION_MAPPINGS[locationKey];
        const leadCount = leadsByLocation[locationKey]?.length || 0;
        
        await sendReportViaEmail(
          ownerEmail,
          mapping.arabicKeywords[0],
          url,
          leadCount
        );
        currentRun.emailsSent++;
        console.log(`[IntegratedScheduler] 📧 Email sent for ${mapping.arabicKeywords[0]}`);
      } catch (error) {
        console.error(`[IntegratedScheduler] ❌ Failed to send email for ${locationKey}:`, error);
      }
    }

    // Save run to database
    await saveReportRun(currentRun);

    currentRun.status = "completed";
    currentRun.endTime = new Date();
    console.log(`[IntegratedScheduler] ✅ Report cycle completed in ${(currentRun.endTime.getTime() - startTime.getTime()) / 1000}s`);

    return currentRun;
  } catch (error) {
    console.error(`[IntegratedScheduler] ❌ Report cycle failed:`, error);
    currentRun.status = "failed";
    currentRun.error = String(error);
    currentRun.endTime = new Date();
    return currentRun;
  }
}

/**
 * Fetch messages from last N hours
 */
async function fetchRecentMessages(
  hours: number
): Promise<
  Array<{
    text: string;
    messageId: string;
    senderPhone: string;
    senderName: string;
    timestamp: Date;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await (db as any).$client.promise().execute(
      `SELECT id, message_text, sender_phone, sender_name, created_at 
       FROM messages 
       WHERE created_at > ? 
       AND classification IN ('supply', 'demand')
       ORDER BY created_at DESC
       LIMIT 500`,
      [cutoffTime]
    );

    return ((rows as any[])[0] || []).map((row: any) => ({
      text: row.message_text,
      messageId: row.id,
      senderPhone: row.sender_phone,
      senderName: row.sender_name,
      timestamp: new Date(row.created_at),
    }));
  } catch (error) {
    console.error("[IntegratedScheduler] Error fetching messages:", error);
    return [];
  }
}

/**
 * Group leads by location
 */
function groupLeadsByLocation(leads: ExtractedLead[]): Record<string, ExtractedLead[]> {
  const grouped: Record<string, ExtractedLead[]> = {};

  for (const lead of leads) {
    const locationKey = normalizeLocationToKey(lead.area);
    if (!grouped[locationKey]) {
      grouped[locationKey] = [];
    }
    grouped[locationKey].push(lead);
  }

  return grouped;
}

/**
 * Save report run to database
 */
async function saveReportRun(run: ScheduledReportRun): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await (db as any).$client.promise().execute(
      `INSERT INTO report_runs (runId, startTime, endTime, totalMessages, extractedLeads, reportsGenerated, emailsSent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.runId,
        run.startTime,
        run.endTime,
        run.totalMessages,
        run.extractedLeads,
        run.reportsGenerated,
        run.emailsSent,
        run.status,
      ]
    );
  } catch (error) {
    console.error("[IntegratedScheduler] Error saving report run:", error);
  }
}

/**
 * Get current run status
 */
export function getCurrentRunStatus(): ScheduledReportRun | null {
  return currentRun;
}

/**
 * Initialize 6-hour scheduler
 */
export function initializeIntegratedScheduler(): void {
  console.log("[IntegratedScheduler] ✅ Initialized - reports will run every 6 hours");

  // Run immediately on startup
  executeReportCycle().catch((error) => {
    console.error("[IntegratedScheduler] Initial run failed:", error);
  });

  // Schedule to run every 6 hours
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    console.log("[IntegratedScheduler] ⏰ Running scheduled report generation...");
    executeReportCycle().catch((error) => {
      console.error("[IntegratedScheduler] Scheduled run failed:", error);
    });
  }, SIX_HOURS_MS);
}
