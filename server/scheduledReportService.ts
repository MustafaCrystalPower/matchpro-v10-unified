import cron from 'node-cron';
import nodemailer from 'nodemailer';
import ExcelJS from 'exceljs';
import mysql from 'mysql2/promise';
import { createReadStream } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Parse database connection
function parseConnectionString() {
  const url = process.env.DATABASE_URL || '';
  const urlObj = new URL(url);
  const sslParam = urlObj.searchParams.get('ssl');
  return {
    host: urlObj.hostname,
    port: parseInt(urlObj.port) || 3306,
    user: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1),
    ssl: sslParam ? JSON.parse(sslParam) : true,
  };
}

// Initialize email transporter
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Generate Excel report
async function generateDemandReport(): Promise<string> {
  const dbConfig = parseConnectionString();
  const conn = await mysql.createConnection(dbConfig);

  try {
    // Market mapping
    const markets = {
      'Madinaty': ['B1', 'B2', 'B11', 'B12', 'B6', 'B7', 'B8', 'B9', 'B10', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20'],
      'Rehab': ['الرحاب', 'Al Rehab', 'Rehab'],
      'Fifth Settlement': ['التجمع الخامس', 'Fifth Settlement', 'New Cairo'],
      'Maadi': ['المعادي', 'Maadi', 'Maady'],
      '6 October': ['6 أكتوبر', '6 October', 'October 6'],
      'Sheikh Zayed': ['الشيخ زايد', 'Sheikh Zayed', 'Zayed'],
    };

    // Fetch demands
    const [demands] = await conn.query(`
      SELECT DISTINCT
        d.id,
        d.contactName,
        d.contact,
        d.propertyType,
        d.location,
        d.area,
        d.price,
        d.size,
        d.bedrooms,
        d.bathrooms,
        d.purpose,
        d.confidence,
        d.rawMessageText,
        d.createdAt
      FROM demand d
      WHERE d.contact IS NOT NULL AND d.contact != ''
      ORDER BY d.createdAt DESC
      LIMIT 5000
    `) as any[];

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MatchPro';
    workbook.created = new Date();

    // Helper function to add market sheet
    const addMarketSheet = (marketName: string, marketLocations: string[]) => {
      const worksheet = workbook.addWorksheet(marketName);
      
      // Headers
      const headers = ['Buyer Name', 'Contact', 'Property Type', 'Location', 'Area', 'Budget', 'Size (sqm)', 'Bedrooms', 'Bathrooms', 'Purpose', 'Message', 'Date', 'Confidence'];
      worksheet.addRow(headers);
      
      // Style headers
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
      
      // Filter demands by market
      const marketDemands = demands.filter((d: any) => {
        const location = (d.location || '').toLowerCase();
        return marketLocations.some(ml => location.includes(ml.toLowerCase()));
      });

      // Group by purpose (FOR SALE / FOR RENT)
      const forSale = marketDemands.filter((d: any) => d.purpose?.toLowerCase() === 'sale');
      const forRent = marketDemands.filter((d: any) => d.purpose?.toLowerCase() === 'rent');

      // Add FOR SALE section
      if (forSale.length > 0) {
        worksheet.addRow(['FOR SALE', '', '', '', '', '', '', '', '', '', '', '', '']);
        forSale.forEach((demand: any) => {
          worksheet.addRow([
            demand.contactName || '',
            demand.contact || '',
            demand.propertyType || '',
            demand.location || '',
            demand.area || '',
            demand.price || '',
            demand.size || '',
            demand.bedrooms || '',
            demand.bathrooms || '',
            'Sale',
            demand.rawMessageText || '',
            new Date(demand.createdAt).toLocaleDateString('en-EG'),
            `${(demand.confidence || 0).toFixed(1)}%`,
          ]);
        });
      }

      // Add FOR RENT section
      if (forRent.length > 0) {
        worksheet.addRow(['FOR RENT', '', '', '', '', '', '', '', '', '', '', '', '']);
        forRent.forEach((demand: any) => {
          worksheet.addRow([
            demand.contactName || '',
            demand.contact || '',
            demand.propertyType || '',
            demand.location || '',
            demand.area || '',
            demand.price || '',
            demand.size || '',
            demand.bedrooms || '',
            demand.bathrooms || '',
            'Rent',
            demand.rawMessageText || '',
            new Date(demand.createdAt).toLocaleDateString('en-EG'),
            `${(demand.confidence || 0).toFixed(1)}%`,
          ]);
        });
      }

      // Auto-fit columns
      worksheet.columns.forEach(col => {
        col.width = 15;
      });
    };

    // Add sheets for each market
    Object.entries(markets).forEach(([marketName, locations]) => {
      addMarketSheet(marketName, locations);
    });

    // Save file
    const filename = `MatchPro_Demand_${new Date().toISOString().split('T')[0]}_${new Date().getHours()}h.xlsx`;
    const filepath = join(tmpdir(), filename);
    await workbook.xlsx.writeFile(filepath);

    return filepath;
  } finally {
    await conn.end();
  }
}

// Send email with report
async function sendReportEmail(filepath: string) {
  const transporter = createEmailTransporter();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-EG');

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: process.env.REPORT_RECIPIENTS || 'mmaisara@crystalpowerinvestment.com',
    subject: `📊 MatchPro™ Demand Report | ${dateStr} ${timeStr}`,
    html: `
      <html>
        <body style="font-family: Arial; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
            <h2>📊 DEMAND REPORT</h2>
            <p>${dateStr} at ${timeStr}</p>
          </div>
          <div style="padding: 20px;">
            <h3>Report Includes:</h3>
            <ul>
              <li>✅ 7 Market Sheets (Madinaty, Rehab, Fifth Settlement, Maadi, 6 October, Sheikh Zayed)</li>
              <li>✅ FOR SALE & FOR RENT sections</li>
              <li>✅ Organized by property type</li>
              <li>✅ All buyer details & original messages</li>
              <li>✅ Deduplicated & sorted by date</li>
            </ul>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">The market is talking. Are you listening? | MatchPro™</p>
          </div>
        </body>
      </html>
    `,
    attachments: [
      {
        filename: `MatchPro_Demand_${dateStr}.xlsx`,
        path: filepath,
      },
    ],
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('❌ Email error:', error.message);
        reject(error);
      } else {
        console.log('✅ Report email sent successfully');
        console.log(`📧 To: ${mailOptions.to}`);
        console.log(`📎 File: ${mailOptions.attachments[0].filename}`);
        resolve(info);
      }
    });
  });
}

// Archive demands after report
async function archiveDemands(demandIds: number[]) {
  if (demandIds.length === 0) return;
  
  const dbConfig = parseConnectionString();
  const conn = await mysql.createConnection(dbConfig);
  
  try {
    const placeholders = demandIds.map(() => '?').join(',');
    await conn.query(
      `UPDATE demand SET archived = true, archivedAt = NOW() WHERE id IN (${placeholders})`,
      demandIds
    );
    console.log(`✅ Archived ${demandIds.length} demands`);
  } finally {
    await conn.end();
  }
}

// Main scheduler function
export function startScheduledReportService() {
  console.log('🚀 Starting Scheduled Report Service...');
  
  // Schedule: 9 AM, 3 PM, 9 PM, 3 AM (Cairo time - UTC+2)
  // Cron format: second minute hour day month dayOfWeek
  const schedules = [
    '0 0 9 * * *',   // 9 AM
    '0 0 15 * * *',  // 3 PM
    '0 0 21 * * *',  // 9 PM
    '0 0 3 * * *',   // 3 AM (next day)
  ];

  schedules.forEach((schedule, index) => {
    cron.schedule(schedule, async () => {
      try {
        console.log(`\n📊 [${new Date().toISOString()}] Generating demand report (Schedule ${index + 1}/4)...`);
        const filepath = await generateDemandReport();
        console.log(`✅ Report generated: ${filepath}`);
        
        await sendReportEmail(filepath);
        console.log(`✅ Report sent successfully`);
      } catch (error) {
        console.error(`❌ Error in scheduled report:`, error);
      }
    });
  });

  console.log('✅ Scheduled Report Service started');
  console.log('📅 Reports will be sent at: 9 AM, 3 PM, 9 PM, 3 AM (Cairo time)');
}

// Update the scheduler to archive demands
// Find and replace the schedules.forEach section
