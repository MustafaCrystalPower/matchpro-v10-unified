import { generateAndUploadReports } from './newExcelReportGenerator';
import { notifyOwner } from './_core/notification';
import { sendReportEmail, generateReportEmailTemplate, verifyEmailConnection } from './_core/emailService';
import { generateEnhancedReport } from './enhancedReportGenerator';
import { storagePut } from './storage';
import cron from 'node-cron';
import * as fs from 'fs';

/**
 * New Report Scheduler
 * 
 * Runs every 6 hours and generates:
 * 1. Matches Sheet (for owner) - uploaded to S3, emailed to owner
 * 2. Area Sheets (for brokers) - uploaded to S3, distributed to brokers
 * 
 * Schedule: 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM (Cairo time)
 */

const OWNER_EMAIL = process.env.REPORT_TO_EMAIL || 'momenmaisara@crystalpowerinvestments.com';
const REPORT_FREQUENCY = '0 0,6,12,18 * * *'; // Every 6 hours at 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM

let scheduledJob: any = null;

export async function initializeReportScheduler() {
  if (scheduledJob) {
    console.log('[Report Scheduler] Already initialized');
    return;
  }

  console.log('[Report Scheduler] Initializing 6-hour report generation...');

  // Verify email connection before starting
  const emailConnected = await verifyEmailConnection();
  if (!emailConnected) {
    console.warn('[Report Scheduler] Email service not available - reports will be generated but not emailed');
  }

  // Run immediately on startup (for testing)
  generateAndDistributeReports().catch((err) => {
    console.error('[Report Scheduler] Initial report generation failed:', err);
  });

  // Schedule for every 6 hours
  scheduledJob = cron.schedule(REPORT_FREQUENCY, () => {
    console.log('[Report Scheduler] Running scheduled report generation...');
    generateAndDistributeReports().catch((err) => {
      console.error('[Report Scheduler] Scheduled report generation failed:', err);
    });
  });

  console.log(`[Report Scheduler] Scheduled with pattern: ${REPORT_FREQUENCY}`);
}

export function stopReportScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log('[Report Scheduler] Stopped');
  }
}

async function generateAndDistributeReports() {
  try {
    console.log('[Report Scheduler] Starting enhanced report generation...');
    const startTime = Date.now();

    // Generate enhanced report with Properties and Requests
    const reportPath = await generateEnhancedReport();
    console.log(`[Report Scheduler] Report generated at: ${reportPath}`);

    // Upload to S3
    const fileBuffer = fs.readFileSync(reportPath);
    const { url, key } = await storagePut(
      `reports/MatchPro_Enhanced_${Date.now()}.xlsx`,
      fileBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const generationTime = Date.now() - startTime;

    console.log(`[Report Scheduler] Reports generated in ${generationTime}ms`);
    console.log(`[Report Scheduler] Uploaded to S3: ${key}`);

    // Send email to owner with professional template
    const emailTemplate = generateReportEmailTemplate(url, new Date());
    const emailSent = await sendReportEmail(
      OWNER_EMAIL,
      `📊 MatchPro Report - ${new Date().toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}`,
      emailTemplate
    );

    if (emailSent) {
      console.log(`[Report Scheduler] Report email sent to ${OWNER_EMAIL}`);
    } else {
      console.warn(`[Report Scheduler] Failed to send email to ${OWNER_EMAIL}`);
    }

    // Notify owner
    await notifyOwner({
      title: '📊 MatchPro Report Generated',
      content: `Your 6-hourly report has been generated and emailed. Download: ${url}`,
    });

    console.log('[Report Scheduler] Report distribution complete');
  } catch (error) {
    console.error('[Report Scheduler] Error during report generation:', error);
    throw error;
  }
}

// Email sending is now handled by emailService.ts
