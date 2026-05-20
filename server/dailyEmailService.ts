/**
 * Daily Email Service
 * Sends automated lead reports every day at 9 AM to mmaisara@crystalpowerinvestment.com
 */

import nodemailer from 'nodemailer';
import { refreshLeads, LeadRefreshConfig, ProcessedLead } from './leadRefreshEngine';
import { getDb } from './db';

// Email configuration
const EMAIL_CONFIG = {
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'noreply@crystalpowerinvestment.com',
    pass: process.env.SMTP_PASS || '',
  },
};

const RECIPIENT_EMAIL = 'mmaisara@crystalpowerinvestment.com';

interface DailyLeadReport {
  date: string;
  totalLeads: number;
  supplyLeads: number;
  demandLeads: number;
  brokerLeads: number;
  realClientLeads: number;
  leads: ProcessedLead[];
  topLocations: { location: string; count: number }[];
  averageConfidenceScore: number;
}

/**
 * Generate daily lead report
 */
export async function generateDailyReport(config: LeadRefreshConfig): Promise<DailyLeadReport> {
  const leads = await refreshLeads(config);

  const supplyLeads = leads.filter(l => l.type === 'supply');
  const demandLeads = leads.filter(l => l.type === 'demand');
  const brokerLeads = leads.filter(l => l.isBroker);
  const realClientLeads = leads.filter(l => !l.isBroker);

  // Calculate top locations
  const locationMap = new Map<string, number>();
  leads.forEach(l => {
    locationMap.set(l.location, (locationMap.get(l.location) || 0) + 1);
  });
  const topLocations = Array.from(locationMap.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Calculate average confidence score
  const avgConfidence = leads.length > 0
    ? Math.round(leads.reduce((sum, l) => sum + l.confidenceScore, 0) / leads.length)
    : 0;

  return {
    date: new Date().toISOString().split('T')[0],
    totalLeads: leads.length,
    supplyLeads: supplyLeads.length,
    demandLeads: demandLeads.length,
    brokerLeads: brokerLeads.length,
    realClientLeads: realClientLeads.length,
    leads: leads.slice(0, 50), // Top 50 leads
    topLocations,
    averageConfidenceScore: avgConfidence,
  };
}

/**
 * Build HTML email template
 */
function buildEmailHTML(report: DailyLeadReport): string {
  const leadsHTML = report.leads
    .map(
      lead => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
        <strong>${lead.title}</strong><br>
        <small style="color: #666;">${lead.location}</small>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">
        <span style="background: ${lead.type === 'supply' ? '#e8f5e9' : '#e3f2fd'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          ${lead.type.toUpperCase()}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">
        <span style="background: ${lead.isBroker ? '#ffebee' : '#f3e5f5'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          ${lead.isBroker ? 'BROKER' : 'REAL CLIENT'}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">
        <strong>${lead.confidenceScore}%</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">
        <small>${lead.freshness}</small>
      </td>
    </tr>
  `
    )
    .join('');

  const locationsHTML = report.topLocations
    .map(
      loc => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${loc.location}</td>
      <td style="padding: 8px; border-bottom: 1px solid #f0f0f0; text-align: right;"><strong>${loc.count}</strong></td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-box { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-box .number { font-size: 28px; font-weight: bold; color: #667eea; }
    .stat-box .label { font-size: 12px; color: #666; margin-top: 5px; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #ddd; }
    .footer { background: #f9f9f9; padding: 15px; border-radius: 8px; font-size: 12px; color: #666; text-align: center; margin-top: 30px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-supply { background: #e8f5e9; color: #2e7d32; }
    .badge-demand { background: #e3f2fd; color: #1565c0; }
    .badge-broker { background: #ffebee; color: #c62828; }
    .badge-real { background: #f3e5f5; color: #6a1b9a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Daily Lead Report</h1>
      <p>Fresh Real Estate Leads - ${report.date}</p>
    </div>

    <div class="stats">
      <div class="stat-box">
        <div class="number">${report.totalLeads}</div>
        <div class="label">Total Leads</div>
      </div>
      <div class="stat-box">
        <div class="number">${report.supplyLeads}</div>
        <div class="label">Supply (Selling)</div>
      </div>
      <div class="stat-box">
        <div class="number">${report.demandLeads}</div>
        <div class="label">Demand (Buying)</div>
      </div>
      <div class="stat-box">
        <div class="number">${report.realClientLeads}</div>
        <div class="label">Real Clients</div>
      </div>
      <div class="stat-box">
        <div class="number">${report.averageConfidenceScore}%</div>
        <div class="label">Avg Confidence</div>
      </div>
    </div>

    <div class="section">
      <h2>📍 Top Locations</h2>
      <table>
        <tr>
          <th>Location</th>
          <th style="text-align: right;">Lead Count</th>
        </tr>
        ${locationsHTML}
      </table>
    </div>

    <div class="section">
      <h2>🔝 Top 50 Leads</h2>
      <table>
        <tr>
          <th>Property</th>
          <th style="text-align: center;">Type</th>
          <th style="text-align: center;">Classification</th>
          <th style="text-align: center;">Confidence</th>
          <th>Freshness</th>
        </tr>
        ${leadsHTML}
      </table>
    </div>

    <div class="footer">
      <p>
        <strong>MatchPro™ Intelligence Report</strong><br>
        Powered by Crystal Power Investments<br>
        Real Supply • Real Demand • Real Results
      </p>
      <p style="margin-top: 15px; color: #999;">
        This is an automated report generated at 9:00 AM daily.<br>
        Leads are refreshed every 48-72 hours for maximum accuracy.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send daily email report
 */
export async function sendDailyEmailReport(config: LeadRefreshConfig): Promise<boolean> {
  try {
    // Generate report
    const report = await generateDailyReport(config);

    if (report.totalLeads === 0) {
      console.log('[dailyEmailService] No leads to report');
      return false;
    }

    // Create transporter
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);

    // Build email
    const htmlContent = buildEmailHTML(report);
    const subject = `MatchPro™ Daily Leads Report - ${report.totalLeads} Fresh Leads (${report.date})`;

    // Send email
    await transporter.sendMail({
      from: EMAIL_CONFIG.auth.user,
      to: RECIPIENT_EMAIL,
      subject,
      html: htmlContent,
      replyTo: 'support@crystalpowerinvestment.com',
    });

    console.log(`[dailyEmailService] Email sent successfully to ${RECIPIENT_EMAIL}`);
    return true;
  } catch (error) {
    console.error('[dailyEmailService] Error sending email:', error);
    return false;
  }
}

/**
 * Schedule daily email at 9 AM
 */
export function scheduleDailyEmail(config: LeadRefreshConfig): void {
  // Calculate time until 9 AM
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const timeUntilNext = tomorrow.getTime() - now.getTime();

  // Schedule first email
  setTimeout(() => {
    sendDailyEmailReport(config);

    // Schedule recurring daily emails
    setInterval(() => {
      sendDailyEmailReport(config);
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }, timeUntilNext);

  console.log(`[dailyEmailService] Scheduled daily email at 9 AM (next in ${Math.round(timeUntilNext / 1000 / 60)} minutes)`);
}
