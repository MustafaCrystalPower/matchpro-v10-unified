/**
 * Daily Demand Report Service
 * Generates and sends daily demand reports via EMAIL ONLY at 9 AM Cairo time
 * Reports are sent ONLY to the owner (mmaisara@crystalpowerinvestment.com)
 */

import { sql } from "drizzle-orm";
import { getDb } from "./db";
import nodemailer from "nodemailer";
import { generateExcelBuffer } from "./excelReportGenerator";

interface DemandReport {
  location: string;
  governorate: string;
  totalDemand: number;
  avgBudget: number;
  avgBedrooms: number;
  avgBathrooms: number;
  propertyTypes: Record<string, number>;
  demands: Array<{
    id: string;
    buyerName: string;
    buyerPhone: string;
    propertyType: string;
    budgetMin: number;
    budgetMax: number;
    bedrooms: number;
    bathrooms: number;
    createdAt: Date;
  }>;
}

/**
 * Get email transporter for sending reports
 */
function getEmailTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn("[Daily Reports] SMTP credentials not configured");
    return null;
  }

  const domain = (user.split("@")[1] || "").toLowerCase();
  let host = process.env.SMTP_HOST;
  if (!host) {
    if (domain.includes("gmail")) host = "smtp.gmail.com";
    else if (domain.includes("outlook") || domain.includes("hotmail")) host = "smtp.office365.com";
    else if (domain.includes("yahoo")) host = "smtp.mail.yahoo.com";
    else host = `mail.${domain}`;
  }

  console.log(`[Daily Reports] Using SMTP host: ${host}`);

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Generate daily demand reports for each location
 */
export async function generateDailyDemandReports(): Promise<DemandReport[]> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Get all unique locations from geoMarketData
  const locations = await db.execute(
    sql`
    SELECT DISTINCT location, governorate 
    FROM geoMarketData 
    WHERE location IS NOT NULL
    ORDER BY location ASC
  `
  );

  const reports: DemandReport[] = [];

  for (const loc of locations as any[]) {
    const locationName = loc.location;
    const governorate = loc.governorate;

    // Fetch demand for this location from last 48 hours
    const demandData = await db.execute(
      sql`
      SELECT 
        d.id,
        d.buyer_name as buyerName,
        d.buyer_phone as buyerPhone,
        d.property_type as propertyType,
        d.budget_min as budgetMin,
        d.budget_max as budgetMax,
        d.bedrooms,
        d.bathrooms,
        d.created_at as createdAt
      FROM demand d
      WHERE d.location = ${locationName}
      AND d.created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
      ORDER BY d.created_at DESC
    `
    );

    if ((demandData as any[]).length > 0) {
      const demands = demandData as any[];

      // Calculate statistics
      const avgBudget =
        demands.reduce(
          (sum, d) => sum + ((d.budgetMin + d.budgetMax) / 2 || 0),
          0
        ) / demands.length;
      const avgBedrooms =
        demands.reduce((sum, d) => sum + (d.bedrooms || 0), 0) / demands.length;
      const avgBathrooms =
        demands.reduce((sum, d) => sum + (d.bathrooms || 0), 0) / demands.length;

      // Count property types
      const propertyTypes: Record<string, number> = {};
      demands.forEach((d) => {
        const type = d.propertyType || "Unknown";
        propertyTypes[type] = (propertyTypes[type] || 0) + 1;
      });

      reports.push({
        location: locationName,
        governorate: governorate || "Unknown",
        totalDemand: demands.length,
        avgBudget: Math.round(avgBudget),
        avgBedrooms: Math.round(avgBedrooms * 10) / 10,
        avgBathrooms: Math.round(avgBathrooms * 10) / 10,
        propertyTypes,
        demands: demands.map((d) => ({
          id: d.id,
          buyerName: d.buyerName,
          buyerPhone: d.buyerPhone,
          propertyType: d.propertyType,
          budgetMin: d.budgetMin,
          budgetMax: d.budgetMax,
          bedrooms: d.bedrooms,
          bathrooms: d.bathrooms,
          createdAt: d.createdAt,
        })),
      });
    }
  }

  return reports;
}

/**
 * Format demand report as HTML email
 */
export function formatDemandReportHTML(report: DemandReport): string {
  const propertyTypesList = Object.entries(report.propertyTypes)
    .map(([type, count]) => `<li>${type}: ${count}</li>`)
    .join("");

  const demandsList = report.demands
    .map(
      (d) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.buyerName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.buyerPhone}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.propertyType}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.bedrooms || "-"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.bathrooms || "-"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">EGP ${d.budgetMin?.toLocaleString() || "-"} - ${d.budgetMax?.toLocaleString() || "-"}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(d.createdAt).toLocaleString("ar-EG")}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير الطلب اليومي - ${report.location}</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 1000px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2c3e50; margin: 0 0 10px 0; font-size: 28px; }
    .header p { color: #7f8c8d; margin: 5px 0; font-size: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-card h3 { margin: 0 0 10px 0; font-size: 14px; opacity: 0.9; }
    .stat-card .value { font-size: 32px; font-weight: bold; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #2c3e50; font-size: 20px; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; margin-bottom: 15px; }
    .property-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .type-badge { background-color: #ecf0f1; padding: 10px; border-radius: 5px; text-align: center; }
    .type-badge strong { color: #2c3e50; display: block; margin-bottom: 5px; }
    .type-badge span { color: #667eea; font-size: 18px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    table thead { background-color: #2c3e50; color: white; }
    table th { padding: 12px; text-align: right; font-weight: bold; }
    table td { padding: 8px; border-bottom: 1px solid #ddd; }
    table tbody tr:hover { background-color: #f9f9f9; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px; text-align: center; }
    .timestamp { color: #95a5a6; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📍 تقرير الطلب اليومي - ${report.location}</h1>
      <p><strong>المحافظة:</strong> ${report.governorate}</p>
      <p class="timestamp">تم التقرير: ${new Date().toLocaleString("ar-EG")}</p>
      <p style="color: #e74c3c; margin-top: 10px;"><strong>الفترة:</strong> آخر 48 ساعة</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <h3>إجمالي الطلبات</h3>
        <div class="value">${report.totalDemand}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <h3>متوسط الميزانية</h3>
        <div class="value">EGP ${report.avgBudget.toLocaleString()}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <h3>متوسط الغرف</h3>
        <div class="value">${report.avgBedrooms}</div>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
        <h3>متوسط الحمامات</h3>
        <div class="value">${report.avgBathrooms}</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 توزيع أنواع العقارات</h2>
      <div class="property-types">
        ${propertyTypesList}
      </div>
    </div>

    <div class="section">
      <h2>📋 تفاصيل الطلبات</h2>
      <table>
        <thead>
          <tr>
            <th>اسم المشتري</th>
            <th>رقم الهاتف</th>
            <th>نوع العقار</th>
            <th>غرف</th>
            <th>حمامات</th>
            <th>الميزانية</th>
            <th>التاريخ</th>
          </tr>
        </thead>
        <tbody>
          ${demandsList}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>هذا التقرير تم إنشاؤه تلقائياً بواسطة نظام MatchPro™ للذكاء العقاري</p>
      <p>Crystal Power Investments | Real Estate Intelligence Platform</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send daily demand reports via EMAIL ONLY to owner with location-filtered Excel attachment
 * NO WhatsApp messages - EMAIL ONLY
 */
export async function sendDailyDemandReports(): Promise<void> {
  try {
    console.log("[Daily Reports] Starting daily demand report generation...");
    const reports = await generateDailyDemandReports();

    if (reports.length === 0) {
      console.log("[Daily Reports] No demand data to report");
      return;
    }

    // Email ONLY to owner
    const ownerEmail = process.env.REPORT_TO_EMAIL || "mmaisara@crystalpowerinvestment.com";
    const transporter = getEmailTransporter();

    if (!transporter) {
      console.error("[Daily Reports] Email transporter not available - SMTP not configured");
      return;
    }

    console.log(`[Daily Reports] Sending reports to owner: ${ownerEmail}`);
    console.log(`[Daily Reports] Total locations to report: ${reports.length}`);

    // Generate location-filtered Excel file
    let excelBuffer: Buffer | null = null;
    try {
      excelBuffer = await generateExcelBuffer();
      console.log("[Daily Reports] Excel report generated successfully");
    } catch (excelError) {
      console.warn("[Daily Reports] Failed to generate Excel report:", excelError);
    }

    let emailsSent = 0;

    // Send single consolidated email with Excel attachment
    try {
      console.log("[Daily Reports] Sending consolidated email with Excel attachment...");
      
      // Create HTML summary of all locations
      const locationsSummary = reports
        .map(r => `<li><strong>${r.location}</strong>: ${r.totalDemand} demands (Avg Budget: EGP ${r.avgBudget.toLocaleString()})</li>`)
        .join("");

      const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MatchPro™ Daily Report</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #2c3e50; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2c3e50; margin: 0 0 10px 0; font-size: 28px; }
    .summary { background-color: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary h2 { color: #2c3e50; margin-top: 0; }
    .summary ul { list-style: none; padding: 0; }
    .summary li { padding: 8px 0; border-bottom: 1px solid #bdc3c7; }
    .summary li:last-child { border-bottom: none; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ecf0f1; color: #7f8c8d; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 MatchPro™ Daily Report</h1>
      <p>Daily Demand & Supply Summary - ${new Date().toLocaleDateString("ar-EG")}</p>
    </div>
    <div class="summary">
      <h2>📍 Locations Summary (Last 48 Hours)</h2>
      <ul>
        ${locationsSummary}
      </ul>
    </div>
    <p style="color: #7f8c8d; font-size: 14px;">📎 Detailed location-filtered data is attached in the Excel file.</p>
    <div class="footer">
      <p>MatchPro™ Real Estate Intelligence Platform | Crystal Power Investments</p>
      <p>This report was automatically generated at ${new Date().toLocaleString("ar-EG")}</p>
    </div>
  </div>
</body>
</html>
      `;

      const mailOptions: any = {
        from: process.env.SMTP_USER,
        to: ownerEmail,
        subject: `MatchPro™ Daily Report - ${new Date().toLocaleDateString("ar-EG")} (${reports.length} locations)`,
        html: htmlContent,
        text: `Daily Report Summary\n\nTotal Locations: ${reports.length}\nTotal Demands: ${reports.reduce((sum, r) => sum + r.totalDemand, 0)}\n\nDetailed data is in the attached Excel file.`,
      };

      // Attach Excel file if generated
      if (excelBuffer) {
        mailOptions.attachments = [
          {
            filename: `MatchPro_Daily_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
            content: excelBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Daily Reports] Email sent successfully: ${info.response}`);
      emailsSent++;
    } catch (emailError) {
      console.error("[Daily Reports] Failed to send consolidated email:", emailError);
    }

    console.log(`[Daily Reports] Completed - Emails sent: ${emailsSent}`);
  } catch (error) {
    console.error("[Daily Reports] Error:", error);
    throw error;
  }
}

/**
 * Schedule daily reports (called by cron job)
 */
export function scheduleDailyReports(): void {
  console.log("[Daily Reports] Scheduler initialized - reports will run at 9 AM Cairo time");
}
