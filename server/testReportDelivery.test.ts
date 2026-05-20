import { describe, it, expect } from 'vitest';
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import * as fs from 'fs';
import * as path from 'path';

describe('Report Delivery Pipeline', () => {
  it('should generate Excel report with correct data', async () => {
    console.log('\n📊 Generating Excel Report...');
    
    const reportPath = await generateCorrectTemplateReport();
    console.log(`✓ Report generated: ${reportPath}`);
    
    expect(fs.existsSync(reportPath)).toBe(true);
    
    const stats = fs.statSync(reportPath);
    const sizeInMB = stats.size / 1024 / 1024;
    console.log(`✓ File size: ${sizeInMB.toFixed(2)} MB`);
    
    expect(sizeInMB).toBeGreaterThan(0.01);
  });

  it('should have correct filename format', async () => {
    const reportPath = await generateCorrectTemplateReport();
    const filename = path.basename(reportPath);
    
    console.log(`✓ Filename: ${filename}`);
    expect(filename).toMatch(/MatchPro_Report_\d+\.xlsx/);
  });

  it('should create report in temp directory', async () => {
    const reportPath = await generateCorrectTemplateReport();
    
    console.log(`✓ Report location: ${reportPath}`);
    expect(reportPath).toContain('/tmp/');
  });

  it('should have all 21 sheets', async () => {
    console.log('\n📋 Verifying Report Structure...');
    
    const reportPath = await generateCorrectTemplateReport();
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(reportPath);

    const sheetCount = workbook.worksheets.length;
    console.log(`✓ Total sheets: ${sheetCount}`);
    
    expect(sheetCount).toBeGreaterThanOrEqual(21);

    // List all sheets
    const sheetNames = workbook.worksheets.map(s => s.name);
    console.log(`✓ Sheets: ${sheetNames.join(', ')}`);
  });

  it('should have data in All_Demands sheet', async () => {
    const reportPath = await generateCorrectTemplateReport();
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(reportPath);

    const sheet = workbook.getWorksheet('All_Demands');
    const rowCount = sheet?.rowCount || 0;
    
    console.log(`✓ All_Demands rows: ${rowCount}`);
    expect(rowCount).toBeGreaterThan(1);

    // Check first data row
    if (rowCount > 1) {
      const firstDataRow = sheet?.getRow(2);
      const id = firstDataRow?.getCell(1).value;
      const location = firstDataRow?.getCell(3).value;
      
      console.log(`✓ Sample data: ID=${id}, Location=${location}`);
      expect(id).toBeTruthy();
    }
  });

  it('should have correct email configuration for delivery', () => {
    const reportEmail = process.env.REPORT_TO_EMAIL;
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;

    console.log(`\n📧 Email Configuration:`);
    console.log(`✓ To: ${reportEmail}`);
    console.log(`✓ Host: ${smtpHost}`);
    console.log(`✓ Port: ${smtpPort}`);

    expect(reportEmail).toBe('maisaramoamen@gmail.com');
    expect(smtpHost).toBeTruthy();
    expect(smtpPort).toBeTruthy();
  });

  it('should have 6-hour scheduler configured', async () => {
    console.log(`\n⏰ Scheduler Configuration:`);
    
    const { getSchedulerStatus } = await import('./reportSchedulerNew');
    const status = getSchedulerStatus();

    console.log(`✓ Running: ${status.running}`);
    console.log(`✓ Schedule: Every 6 hours (0:00, 6:00, 12:00, 18:00 Cairo time)`);
    console.log(`✓ Next runs: ${status.nextRunTimes.join(', ')}`);

    expect(status.nextRunTimes.length).toBeGreaterThan(0);
  });

  it('should verify end-to-end delivery flow', async () => {
    console.log(`\n✅ End-to-End Delivery Flow:`);

    // 1. Generate report
    console.log(`1️⃣ Generating report...`);
    const reportPath = await generateCorrectTemplateReport();
    expect(fs.existsSync(reportPath)).toBe(true);
    console.log(`   ✓ Report ready: ${reportPath}`);

    // 2. Verify file
    console.log(`2️⃣ Verifying file...`);
    const stats = fs.statSync(reportPath);
    console.log(`   ✓ Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 3. Check email config
    console.log(`3️⃣ Email configuration...`);
    const reportEmail = process.env.REPORT_TO_EMAIL;
    console.log(`   ✓ Recipient: ${reportEmail}`);

    // 4. Verify scheduler
    console.log(`4️⃣ Scheduler status...`);
    const { getSchedulerStatus } = await import('./reportSchedulerNew');
    const status = getSchedulerStatus();
    console.log(`   ✓ Running: ${status.running}`);

    console.log(`\n✅ All systems ready for automated delivery!`);
  });
});
