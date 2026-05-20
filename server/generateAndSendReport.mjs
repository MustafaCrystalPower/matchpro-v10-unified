/**
 * Generate and Send Report
 * This script generates the Excel report and sends it via email
 * 
 * Usage: node server/generateAndSendReport.mjs <recipient_email>
 */

import { generateCorrectTemplateReport } from './correctTemplateReportGenerator.ts';
import { sendReportEmail } from './sendReportEmail.mjs';
import * as fs from 'fs';

async function main() {
  try {
    const recipientEmail = process.argv[2] || 'maisaramoamen@gmail.com';
    
    console.log('🚀 Starting report generation and delivery...\n');
    
    // Generate report
    console.log('📊 Generating Excel report...');
    const filename = await generateCorrectTemplateReport();
    console.log(`✅ Report generated: ${filename}\n`);
    
    // Verify file
    const stats = fs.statSync(filename);
    console.log(`📁 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📅 File created: ${stats.birthtime.toLocaleString()}\n`);
    
    // Send email
    console.log(`📧 Sending to: ${recipientEmail}`);
    const sent = await sendReportEmail(filename, recipientEmail);
    
    if (sent) {
      console.log('✅ Email sent successfully!\n');
      console.log('🎉 Report generation and delivery complete!');
      process.exit(0);
    } else {
      console.log('⚠️ Email not sent (SMTP not configured)');
      console.log(`📁 Report file available at: ${filename}`);
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
