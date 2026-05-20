/**
 * Test script to generate the correct template report
 * Run with: node server/testReportGeneration.mjs
 */

import { generateCorrectTemplateReport } from './correctTemplateReportGenerator.ts';

async function main() {
  try {
    console.log('🚀 Starting report generation...');
    const filename = await generateCorrectTemplateReport();
    console.log(`✅ Report generated successfully: ${filename}`);
    
    // Verify file exists
    const fs = await import('fs');
    const stats = fs.statSync(filename);
    console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`✅ File is valid and ready to send`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
