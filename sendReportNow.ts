import { generateAndUploadReports } from './server/newExcelReportGenerator';
import { sendReportEmail, generateReportEmailTemplate, verifyEmailConnection } from './server/_core/emailService';
import { generateReportMetrics } from './server/reportAnalytics';

async function main() {
  try {
    console.log('[Report Generator] Starting report generation with real data...');
    
    // Verify email connection
    console.log('[Report Generator] Verifying SMTP connection...');
    const emailConnected = await verifyEmailConnection();
    if (!emailConnected) {
      console.error('[Report Generator] SMTP connection failed');
      process.exit(1);
    }
    
    // Generate reports
    console.log('[Report Generator] Generating Excel reports...');
    const startTime = Date.now();
    const { url, key } = await generateAndUploadReports();
    const generationTime = Date.now() - startTime;
    
    console.log(`[Report Generator] Reports generated in ${generationTime}ms`);
    console.log(`[Report Generator] Uploaded to S3: ${key}`);
    console.log(`[Report Generator] Download URL: ${url}`);
    
    // Generate metrics
    console.log('[Report Generator] Generating analytics metrics...');
    const metrics = await generateReportMetrics(generationTime);
    
    console.log('[Report Generator] Report Metrics:');
    console.log(`  - Matches: ${metrics.matchesCount}`);
    console.log(`  - Demand: ${metrics.demandCount}`);
    console.log(`  - Supply: ${metrics.supplyCount}`);
    console.log(`  - Avg Score: ${metrics.averageMatchScore}%`);
    console.log(`  - High Quality (≥75%): ${metrics.highQualityMatches}`);
    
    // Send email
    console.log('[Report Generator] Sending report email...');
    const emailTemplate = generateReportEmailTemplate(url, new Date());
    const emailSent = await sendReportEmail(
      process.env.REPORT_TO_EMAIL || 'momenmaisara@crystalpowerinvestments.com',
      `📊 MatchPro Report - ${new Date().toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}`,
      emailTemplate
    );
    
    if (emailSent) {
      console.log(`[Report Generator] ✅ Report email sent successfully`);
    } else {
      console.error(`[Report Generator] ❌ Failed to send email`);
      process.exit(1);
    }
    
    console.log('[Report Generator] ✅ Report generation and delivery complete!');
    process.exit(0);
  } catch (error) {
    console.error('[Report Generator] Error:', error);
    process.exit(1);
  }
}

main();
