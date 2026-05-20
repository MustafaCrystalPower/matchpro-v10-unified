/**
 * Report Scheduler - Generates and sends Excel reports every 6 hours
 * Runs at: 0:00, 6:00, 12:00, 18:00 Cairo time
 */

import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import * as fs from 'fs';
import { getDb } from './db';

interface ReportScheduleConfig {
  enabled: boolean;
  recipientEmail: string;
  hours: number[]; // Hours to run (0-23, Cairo time)
  retentionDays: number; // Keep reports for N days
}

let schedulerInterval: NodeJS.Timeout | null = null;
let lastRunTime: Date | null = null;

const DEFAULT_CONFIG: ReportScheduleConfig = {
  enabled: true,
  recipientEmail: process.env.REPORT_TO_EMAIL || 'maisaramoamen@gmail.com',
  hours: [0, 6, 12, 18], // Every 6 hours
  retentionDays: 30,
};

/**
 * Check if it's time to run the report
 */
function shouldRunReport(config: ReportScheduleConfig): boolean {
  if (!config.enabled) return false;

  const now = new Date();
  const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const currentHour = cairoTime.getHours();

  // Check if current hour matches scheduled hours
  const isScheduledHour = config.hours.includes(currentHour);

  // Prevent running multiple times in the same hour
  if (lastRunTime) {
    const hoursSinceLastRun = (now.getTime() - lastRunTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastRun < 1) {
      return false;
    }
  }

  return isScheduledHour;
}

/**
 * Generate and send report
 */
export async function runReportGeneration(config: ReportScheduleConfig = DEFAULT_CONFIG): Promise<{
  success: boolean;
  reportPath?: string;
  emailSent?: boolean;
  error?: string;
}> {
  try {
    console.log(`[Report Scheduler] Starting report generation at ${new Date().toISOString()}`);

    // Generate report
    console.log('[Report Scheduler] Generating Excel report...');
    const reportPath = await generateCorrectTemplateReport();
    console.log(`[Report Scheduler] Report generated: ${reportPath}`);

    // Verify file
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report file not found: ${reportPath}`);
    }

    const fileStats = fs.statSync(reportPath);
    console.log(`[Report Scheduler] Report size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

    // Send email (optional - configured via env vars)
    console.log(`[Report Scheduler] Report ready at: ${reportPath}`);
    console.log(`[Report Scheduler] File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    const emailSent = false; // Email sending handled separately

    lastRunTime = new Date();

    return {
      success: true,
      reportPath,
      emailSent,
    };
  } catch (error) {
    console.error('[Report Scheduler] Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Clean up old reports (older than retention period)
 */
function cleanupOldReports(config: ReportScheduleConfig): void {
  try {
    const reportsDir = '/tmp';
    const files = fs.readdirSync(reportsDir);
    const reportFiles = files.filter(f => f.startsWith('MatchPro_Report_') && f.endsWith('.xlsx'));

    const now = Date.now();
    const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;

    for (const file of reportFiles) {
      const filePath = `${reportsDir}/${file}`;
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > retentionMs) {
        fs.unlinkSync(filePath);
        console.log(`[Report Scheduler] Deleted old report: ${file}`);
      }
    }
  } catch (error) {
    console.error('[Report Scheduler] Cleanup error:', error);
  }
}

/**
 * Start the scheduler
 */
export function startReportScheduler(config: ReportScheduleConfig = DEFAULT_CONFIG): void {
  if (schedulerInterval) {
    console.warn('[Report Scheduler] Scheduler already running');
    return;
  }

  console.log('[Report Scheduler] Starting scheduler...');
  console.log(`[Report Scheduler] Scheduled hours (Cairo time): ${config.hours.join(', ')}`);
  console.log(`[Report Scheduler] Recipient: ${config.recipientEmail}`);
  console.log(`[Report Scheduler] Report retention: ${config.retentionDays} days`);

  // Check every minute
  schedulerInterval = setInterval(async () => {
    if (shouldRunReport(config)) {
      console.log('[Report Scheduler] Scheduled time reached, generating report...');
      await runReportGeneration(config);
      cleanupOldReports(config);
    }
  }, 60 * 1000); // Check every minute

  console.log('[Report Scheduler] Scheduler started successfully');
}

/**
 * Stop the scheduler
 */
export function stopReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Report Scheduler] Scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  running: boolean;
  lastRunTime: Date | null;
  nextRunTimes: string[];
} {
  const now = new Date();
  const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const currentHour = cairoTime.getHours();

  const nextRunTimes: string[] = [];
  for (const hour of DEFAULT_CONFIG.hours) {
    if (hour > currentHour) {
      const nextRun = new Date(cairoTime);
      nextRun.setHours(hour, 0, 0, 0);
      nextRunTimes.push(nextRun.toISOString());
    }
  }

  // If no more runs today, show first run tomorrow
  if (nextRunTimes.length === 0) {
    const tomorrow = new Date(cairoTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(DEFAULT_CONFIG.hours[0], 0, 0, 0);
    nextRunTimes.push(tomorrow.toISOString());
  }

  return {
    running: schedulerInterval !== null,
    lastRunTime,
    nextRunTimes,
  };
}

// Auto-start if enabled via environment variable
if (process.env.ENABLE_REPORT_SCHEDULER === 'true') {
  startReportScheduler();
}
