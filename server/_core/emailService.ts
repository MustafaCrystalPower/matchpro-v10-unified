import nodemailer from 'nodemailer';

/**
 * SMTP Email Service
 * Handles report delivery and notifications
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const REPORT_FROM_EMAIL = process.env.REPORT_FROM_EMAIL || 'noreply@crystalpowerinvestments.com';

let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize SMTP transporter
 */
function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  console.log(`[Email Service] SMTP configured: ${SMTP_HOST}:${SMTP_PORT}`);
  return transporter;
}

/**
 * Send report email with attachment
 */
export async function sendReportEmail(
  recipientEmail: string,
  subject: string,
  htmlContent: string,
  attachmentPath?: string,
  attachmentFilename?: string
): Promise<boolean> {
  try {
    const transporter = getTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from: REPORT_FROM_EMAIL,
      to: recipientEmail,
      subject,
      html: htmlContent,
      replyTo: 'support@crystalpowerinvestments.com',
    };

    // Add attachment if provided
    if (attachmentPath && attachmentFilename) {
      mailOptions.attachments = [
        {
          filename: attachmentFilename,
          path: attachmentPath,
        },
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Report sent to ${recipientEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] Failed to send report to ${recipientEmail}:`, error);
    return false;
  }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
  recipientEmail: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: REPORT_FROM_EMAIL,
      to: recipientEmail,
      subject,
      html: htmlContent,
      replyTo: 'support@crystalpowerinvestments.com',
    });

    console.log(`[Email Service] Notification sent to ${recipientEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email Service] Failed to send notification to ${recipientEmail}:`, error);
    return false;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('[Email Service] SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('[Email Service] SMTP connection failed:', error);
    return false;
  }
}

/**
 * Email template for 6-hour report delivery
 */
export function generateReportEmailTemplate(reportUrl: string, generatedAt: Date): string {
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1F4E78; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #1F4E78; margin: 0; }
          .subtitle { color: #666; font-size: 14px; margin: 5px 0 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content h2 { color: #1F4E78; margin-top: 0; }
          .content ul { color: #555; margin: 15px 0; padding-left: 20px; }
          .content li { margin: 8px 0; }
          .cta-button { display: inline-block; background: #1F4E78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
          .details { background: #f0f0f0; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
          .details p { margin: 5px 0; }
          .footer { border-top: 1px solid #ddd; padding-top: 15px; text-align: center; color: #999; font-size: 12px; }
          .badge { display: inline-block; background: #1F4E78; color: white; padding: 4px 8px; border-radius: 3px; font-size: 12px; margin-right: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <p class="logo">MatchPro Intelligence Engine™</p>
            <p class="subtitle">Crystal Power Investments LLC</p>
          </div>

          <!-- Main Content -->
          <div class="content">
            <h2>📊 Your 6-Hourly Real Estate Report is Ready</h2>
            
            <p>Dear Valued Partner,</p>
            
            <p>Your automated real estate market intelligence report has been generated with the latest supply and demand data from our WhatsApp monitoring system.</p>
            
            <h3>📋 Report Contents:</h3>
            <ul>
              <li><span class="badge">MATCHES</span> High-quality matches (score ≥75%)</li>
              <li><span class="badge">DEMAND</span> Area-segregated buyer requests</li>
              <li><span class="badge">ANALYSIS</span> For Sale / For Rent classification</li>
              <li><span class="badge">LEADS</span> Essential contact information</li>
            </ul>

            <p style="text-align: center; margin-top: 25px;">
              <a href="${reportUrl}" class="cta-button">📥 Download Report</a>
            </p>
          </div>

          <!-- Report Details -->
          <div class="details">
            <p><strong>Generated:</strong> ${generatedAt.toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}</p>
            <p><strong>Reporting Window:</strong> Last 6 hours</p>
            <p><strong>Format:</strong> Excel (.xlsx)</p>
            <p><strong>Sheets:</strong> Matches + 10 Area-Specific Demand Sheets</p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>© 2026 Crystal Power Investments LLC · PDPL Compliant</p>
            <p>This is an automated report. Please do not reply to this email.</p>
            <p>For support, contact: support@crystalpowerinvestments.com</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Email template for broker area-specific reports
 */
export function generateBrokerReportEmailTemplate(
  brokerName: string,
  area: string,
  reportUrl: string,
  leadCount: number,
  generatedAt: Date
): string {
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1F4E78; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #1F4E78; margin: 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content h2 { color: #1F4E78; margin-top: 0; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; padding: 15px; background: white; border-radius: 4px; flex: 1; margin: 0 5px; }
          .stat-number { font-size: 28px; font-weight: bold; color: #1F4E78; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          .cta-button { display: inline-block; background: #1F4E78; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
          .footer { border-top: 1px solid #ddd; padding-top: 15px; text-align: center; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <p class="logo">MatchPro Broker Report</p>
          </div>

          <!-- Main Content -->
          <div class="content">
            <h2>📍 ${area} - New Buyer Requests</h2>
            
            <p>Hello ${brokerName},</p>
            
            <p>We've identified <strong>${leadCount} new buyer requests</strong> in your area. Here are the latest opportunities for your portfolio.</p>
            
            <div class="stats">
              <div class="stat">
                <div class="stat-number">${leadCount}</div>
                <div class="stat-label">New Leads</div>
              </div>
              <div class="stat">
                <div class="stat-number">6h</div>
                <div class="stat-label">Window</div>
              </div>
            </div>

            <p style="text-align: center; margin-top: 25px;">
              <a href="${reportUrl}" class="cta-button">📥 View Leads</a>
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>© 2026 Crystal Power Investments LLC</p>
            <p>Generated: ${generatedAt.toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
