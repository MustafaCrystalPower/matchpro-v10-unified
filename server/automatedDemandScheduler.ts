/**
 * Automated 6-Hour Demand Report Scheduler - Priority 2
 * Sends Excel reports with professional CPI branding
 * Runs every 6 hours (12 AM, 6 AM, 12 PM, 6 PM Cairo time)
 */

import cron from 'node-cron';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import { storagePut } from './storage';
import { createConnection } from 'mysql2/promise';

let scheduledTask: any = null;

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Generate demand report with CPI branding
 */
async function generateCPIBrandedReport(): Promise<{ url: string; demandCount: number }> {
  const connection = await createConnection(process.env.DATABASE_URL || '');
  
  try {
    // Get unarchived demands from last 6 hours
    const [demands] = await connection.execute(`
      SELECT 
        id,
        messageText,
        createdAt,
        sender,
        senderName,
        groupName,
        classification
      FROM messages
      WHERE classification = 'demand'
      AND archived_at IS NULL
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
      ORDER BY createdAt DESC
    `) as any;
    
    if (demands.length === 0) {
      console.log('⚠️  No new demands in the last 6 hours');
      return { url: '', demandCount: 0 };
    }
    
    // Create workbook with CPI branding
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Crystal Power Investments';
    workbook.title = 'MatchPro Demand Report';
    
    // Add title sheet
    const titleSheet = workbook.addWorksheet('Report');
    titleSheet.mergeCells('A1:E1');
    const titleCell = titleSheet.getCell('A1');
    titleCell.value = 'Crystal Power Investments - MatchPro';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleSheet.getRow(1).height = 25;
    
    // Add report info
    titleSheet.mergeCells('A3:E3');
    const infoCell = titleSheet.getCell('A3');
    infoCell.value = `Demand Report - ${new Date().toLocaleDateString('en-EG')} ${new Date().toLocaleTimeString('en-EG')}`;
    infoCell.font = { bold: true, size: 12 };
    
    // Add demands sheet
    const demandsSheet = workbook.addWorksheet('Demands');
    demandsSheet.columns = [
      { header: 'Time', key: 'time', width: 18 },
      { header: 'Name', key: 'name', width: 18 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Area', key: 'area', width: 18 },
      { header: 'Budget', key: 'budget', width: 15 },
      { header: 'Source', key: 'source', width: 25 },
      { header: 'Message', key: 'message', width: 50 }
    ];
    
    // Style header
    const headerRow = demandsSheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Add data
    for (const demand of demands) {
      const messageTime = new Date(demand.createdAt).toLocaleString('en-EG', {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      demandsSheet.addRow({
        time: messageTime,
        name: demand.senderName || 'Unknown',
        phone: demand.sender.replace('@c.us', ''),
        area: extractArea(demand.messageText),
        budget: extractBudget(demand.messageText),
        source: demand.groupName,
        message: demand.messageText.substring(0, 100)
      });
    }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to S3
    const timestamp = new Date().getTime();
    const key = `reports/CPI_Demand_Report_${timestamp}.xlsx`;
    const result = await storagePut(key, buffer as unknown as Buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    await connection.end();
    
    return { url: result.url, demandCount: demands.length };
  } catch (error) {
    console.error('❌ Error generating report:', error);
    await connection.end();
    throw error;
  }
}

/**
 * Extract area from message
 */
function extractArea(text: string): string {
  if (text.match(/[bB]\d{1,2}/)) return 'مدينتي';
  if (text.includes('التجمع')) return 'التجمع الخامس';
  if (text.includes('الرحاب')) return 'الرحاب';
  if (text.includes('القاهرة الجديدة')) return 'القاهرة الجديدة';
  if (text.includes('الشيخ زايد')) return 'الشيخ زايد';
  return 'Other';
}

/**
 * Extract budget from message
 */
function extractBudget(text: string): string {
  const match = text.match(/(\d+(?:[,.]?\d+)?)\s*(مليون|الف|thousand|k)?/i);
  if (!match) return '-';
  
  let num = parseFloat(match[1].replace(',', '.'));
  if (match[2]?.toLowerCase().includes('مليون') || match[2]?.toLowerCase().includes('million')) {
    num *= 1000000;
  } else if (match[2]?.toLowerCase().includes('الف') || match[2]?.toLowerCase().includes('thousand')) {
    num *= 1000;
  }
  
  return `${num.toLocaleString()} EGP`;
}

/**
 * Initialize 6-hour scheduler
 */
export function initializeAutomatedDemandScheduler() {
  // Runs at: 12 AM, 6 AM, 12 PM, 6 PM Cairo time (9 PM, 3 AM, 9 AM, 3 PM UTC)
  // Cron: 0 21,3,9,15 * * * (UTC times)
  const cronExpression = '0 21,3,9,15 * * *';
  
  console.log('\n📅 Initializing 6-hour demand report scheduler...');
  console.log(`   ⏰ Schedule: ${cronExpression} (Every 6 hours)`);
  
  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log('\n🚀 Executing 6-hour demand report...\n');
    
    try {
      const result = await generateCPIBrandedReport();
      
      if (result.demandCount === 0) {
        console.log('⚠️  No new demands to report');
        return;
      }
      
      // Send email
      const emailSubject = `MatchPro Demand Report - ${new Date().toLocaleDateString('en-EG')}`;
      const emailBody = `
        <div style="font-family: Arial, sans-serif; direction: rtl;">
          <h2 style="color: #1F4E78;">Crystal Power Investments</h2>
          <h3>MatchPro - تقرير الطلبات</h3>
          <p>تم إنشاء تقرير الطلبات الجديد بنجاح</p>
          <ul>
            <li><strong>عدد الطلبات:</strong> ${result.demandCount}</li>
            <li><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</li>
            <li><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG')}</li>
          </ul>
          <p><a href="${result.url}" style="background-color: #1F4E78; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">تحميل التقرير</a></p>
          <hr>
          <p style="font-size: 12px; color: #666;">
            This is an automated report from MatchPro Dashboard
          </p>
        </div>
      `;
      
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: 'mmaisara@crystalpowerinvestment.com',
        subject: emailSubject,
        html: emailBody
      });
      
      console.log(`✅ Report sent successfully!`);
      console.log(`   📧 To: mmaisara@crystalpowerinvestment.com`);
      console.log(`   📥 Demands: ${result.demandCount}`);
      console.log(`   🔗 Link: ${result.url}\n`);
      
      // Archive demands
      const connection = await createConnection(process.env.DATABASE_URL || '');
      await connection.execute(`
        UPDATE messages 
        SET archived_at = NOW() 
        WHERE classification = 'demand'
        AND archived_at IS NULL
        AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
      `);
      await connection.end();
      
    } catch (error) {
      console.error('❌ Error sending report:', error);
    }
  });
  
  console.log('✅ Scheduler initialized successfully!\n');
  
  return scheduledTask;
}

/**
 * Manually trigger report (for testing)
 */
export async function triggerDemandReportNow() {
  console.log('\n🔔 Manually triggering demand report...\n');
  
  try {
    const result = await generateCPIBrandedReport();
    
    if (result.demandCount === 0) {
      console.log('⚠️  No demands to report');
      return;
    }
    
    // Send email
    const emailSubject = `MatchPro Demand Report (Manual) - ${new Date().toLocaleDateString('en-EG')}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; direction: rtl;">
        <h2 style="color: #1F4E78;">Crystal Power Investments</h2>
        <h3>MatchPro - تقرير الطلبات (يدوي)</h3>
        <p>تم إنشاء تقرير الطلبات بناءً على طلب يدوي</p>
        <ul>
          <li><strong>عدد الطلبات:</strong> ${result.demandCount}</li>
          <li><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</li>
          <li><strong>الوقت:</strong> ${new Date().toLocaleTimeString('ar-EG')}</li>
        </ul>
        <p><a href="${result.url}" style="background-color: #1F4E78; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">تحميل التقرير</a></p>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'mmaisara@crystalpowerinvestment.com',
      subject: emailSubject,
      html: emailBody
    });
    
    console.log(`✅ Report sent successfully!`);
    console.log(`   📧 To: mmaisara@crystalpowerinvestment.com`);
    console.log(`   📥 Demands: ${result.demandCount}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

/**
 * Stop scheduler
 */
export function stopAutomatedDemandScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    console.log('⏹️  Scheduler stopped');
  }
}
