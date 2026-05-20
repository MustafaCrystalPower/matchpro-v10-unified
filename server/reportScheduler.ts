/**
 * Report Scheduler
 * Generates and distributes location-based reports every 6 hours
 */

import { getDb } from "./db";
import { generateSecureLocationReport, generateWhatsappMessage, countPropertyTypes } from "./secureReportGenerator";
import { distributReportToAllGroups, sendReportViaEmail, logDistributionEvent } from "./whatsappReportDistribution";
import { LOCATION_MAPPINGS, getAllLocationKeys, getWhatsappGroupForLocation } from "./locationMappings";

interface ScheduledReport {
  reportId: string;
  locationKey: string;
  generatedAt: Date;
  demandsCount: number;
  whatsappGroupsSent: number;
  emailSent: boolean;
  status: "success" | "partial" | "failed";
}

/**
 * Generate and distribute reports for all locations
 */
export async function generateAndDistributeAllReports(): Promise<ScheduledReport[]> {
  const reports: ScheduledReport[] = [];
  const db = await getDb();

  if (!db) {
    console.error("[ReportScheduler] Database not available");
    return [];
  }

  try {
    // Get all location keys
    const locationKeys = getAllLocationKeys();

    for (const locationKey of locationKeys) {
      try {
        console.log(`[ReportScheduler] Processing location: ${locationKey}`);

        // Fetch demands for this location from database
        const demandsRows = await (db as any).$client.promise().execute(
          `SELECT * FROM demand WHERE location = ? ORDER BY createdAt DESC LIMIT 500`,
          [locationKey]
        );

        const demands = (demandsRows as any[])[0] || [];

        if (demands.length === 0) {
          console.log(`[ReportScheduler] No demands found for ${locationKey}`);
          continue;
        }

        // Generate secure Excel report
        const { excelBuffer, reportId, expiresAt, secureUrl } = await generateSecureLocationReport(
          locationKey,
          demands,
          new Date()
        );

        // Count property types
        const counts = countPropertyTypes(demands);

        // Generate WhatsApp message
        const whatsappMessage = generateWhatsappMessage(
          locationKey,
          demands.length,
          counts.apartments,
          counts.villas,
          counts.chalets,
          secureUrl,
          "847291" // Placeholder OTP - in production, generate unique per report
        );

        // Get broker groups for this location
        const brokerGroups = await getBrokerGroupsForLocation(locationKey);

        // Distribute via WhatsApp
        let whatsappGroupsSent = 0;
        if (brokerGroups.length > 0) {
          const distributions = await distributReportToAllGroups(
            brokerGroups,
            whatsappMessage,
            secureUrl
          );
          whatsappGroupsSent = distributions.filter((d) => d.status === "sent").length;
        }

        // Send via email to owner
        const ownerEmail = process.env.REPORT_TO_EMAIL || "momenmaisara@crystalpowerinvestments.com";
        const emailSent = await sendReportViaEmail(
          ownerEmail,
          LOCATION_MAPPINGS[locationKey].arabicKeywords[0],
          secureUrl,
          demands.length
        );

        // Log distribution event
        await logDistributionEvent(reportId, locationKey, [], emailSent);

        // Save report metadata to database
        await saveReportMetadata(db, {
          reportId,
          locationKey,
          demandsCount: demands.length,
          excelUrl: secureUrl,
          expiresAt,
          whatsappGroupsSent,
          emailSent,
        });

        reports.push({
          reportId,
          locationKey,
          generatedAt: new Date(),
          demandsCount: demands.length,
          whatsappGroupsSent,
          emailSent,
          status: whatsappGroupsSent > 0 || emailSent ? "success" : "partial",
        });

        console.log(`[ReportScheduler] ✅ Completed ${locationKey}: ${demands.length} demands, ${whatsappGroupsSent} groups, email: ${emailSent}`);
      } catch (error) {
        console.error(`[ReportScheduler] ❌ Failed for ${locationKey}:`, error);
        reports.push({
          reportId: `error-${locationKey}`,
          locationKey,
          generatedAt: new Date(),
          demandsCount: 0,
          whatsappGroupsSent: 0,
          emailSent: false,
          status: "failed",
        });
      }
    }

    console.log(`[ReportScheduler] 📊 Batch complete: ${reports.length} locations processed`);
    return reports;
  } catch (error) {
    console.error("[ReportScheduler] Fatal error:", error);
    return [];
  }
}

/**
 * Get broker groups for a location
 */
async function getBrokerGroupsForLocation(locationKey: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const groupsRows = await (db as any).$client.promise().execute(
      `SELECT * FROM brokersList WHERE location = ? AND isActive = 1`,
      [locationKey]
    );
    return (groupsRows as any[])[0] || [];
  } catch (error) {
    console.error("[ReportScheduler] Failed to fetch broker groups:", error);
    return [];
  }
}

/**
 * Save report metadata to database
 */
async function saveReportMetadata(
  db: any,
  metadata: {
    reportId: string;
    locationKey: string;
    demandsCount: number;
    excelUrl: string;
    expiresAt: Date;
    whatsappGroupsSent: number;
    emailSent: boolean;
  }
): Promise<void> {
  try {
    await (db as any).$client.promise().execute(
      `INSERT INTO reports (reportId, locationFilter, totalDemands, excelUrl, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        metadata.reportId,
        metadata.locationKey,
        metadata.demandsCount,
        metadata.excelUrl,
        metadata.expiresAt,
      ]
    );
  } catch (error) {
    console.error("[ReportScheduler] Failed to save report metadata:", error);
  }
}

/**
 * Schedule reports to run every 6 hours
 * Call this once during app initialization
 */
export function initializeReportScheduler(): void {
  // Run immediately on startup
  generateAndDistributeAllReports().catch((error) => {
    console.error("[ReportScheduler] Initial run failed:", error);
  });

  // Schedule to run every 6 hours (21600000 ms)
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    console.log("[ReportScheduler] ⏰ Running scheduled report generation...");
    generateAndDistributeAllReports().catch((error) => {
      console.error("[ReportScheduler] Scheduled run failed:", error);
    });
  }, SIX_HOURS_MS);

  console.log("[ReportScheduler] ✅ Initialized - reports will run every 6 hours");
}
