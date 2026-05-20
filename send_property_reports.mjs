/**
 * Send both CPI property search PDFs via SMTP
 * Uses the same SMTP config as the MatchPro server
 */

import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.REPORT_FROM_EMAIL || SMTP_USER;
const TO_EMAIL = 'momenmaisara@crystalpowerinvestments.com';

console.log(`[Email] SMTP: ${SMTP_HOST}:${SMTP_PORT} | User: ${SMTP_USER ? SMTP_USER.substring(0,5)+'...' : 'NOT SET'}`);

if (!SMTP_USER || !SMTP_PASS) {
  console.error('[Email] SMTP credentials not configured. Check SMTP_USER and SMTP_PASS env vars.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  
  <!-- Header -->
  <div style="background: #0A1628; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #B8860B; margin: 0; font-size: 22px;">CRYSTAL POWER INVESTMENTS</h1>
    <p style="color: #ccc; margin: 5px 0 0 0; font-size: 13px;">MatchPro™ Intelligence Platform — Property Search Report</p>
  </div>
  
  <!-- Gold divider -->
  <div style="height: 3px; background: #B8860B;"></div>
  
  <!-- Body -->
  <div style="background: #f9f9f9; padding: 25px; border: 1px solid #e0e0e0;">
    <p>Dear M,</p>
    
    <p>Please find attached <strong>two property search reports</strong> prepared by the MatchPro™ Intelligence Platform based on your search criteria:</p>
    
    <div style="background: white; border-left: 4px solid #B8860B; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
      <h3 style="color: #0A1628; margin: 0 0 10px 0;">📋 Report 1: B-Block Apartments</h3>
      <p style="margin: 0; font-size: 14px; color: #555;">
        <strong>Request:</strong> 3 units | 3BR | ~116m² | Immediate Delivery<br>
        <strong>Contract:</strong> Talaat Mostafa (not Takhsis)<br>
        <strong>Budget:</strong> Down + Offer ≤ EGP 4M | Total ≤ EGP 6.5M<br>
        <strong>Top Pick:</strong> B12 Group 123 — Offer 3.1M, Immediate delivery ✅
      </p>
    </div>
    
    <div style="background: white; border-left: 4px solid #1565C0; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
      <h3 style="color: #0A1628; margin: 0 0 10px 0;">📋 Report 2: Studios & Privado</h3>
      <p style="margin: 0; font-size: 14px; color: #555;">
        <strong>Request:</strong> Group 131 or 132 | ~EGP 3.6M total<br>
        <strong>Installment:</strong> ~8,000 EGP/month | 230,000–240,000 EGP/year<br>
        <strong>Note:</strong> Closest matches found in Group 123 B12 — monitoring active for Groups 131/132 🔍
      </p>
    </div>
    
    <p>Both reports include full property details, contact numbers, original WhatsApp messages, and CPI recommendations.</p>
    
    <p style="margin-top: 25px;">Best regards,<br>
    <strong>MatchPro™ Intelligence Platform</strong><br>
    Crystal Power Investments<br>
    <span style="color: #888; font-size: 12px;">Generated: ${new Date().toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}</span>
    </p>
  </div>
  
  <!-- Footer -->
  <div style="background: #0A1628; padding: 12px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="color: #B8860B; margin: 0; font-size: 11px;">© 2026 Crystal Power Investments LLC · CONFIDENTIAL · MatchPro™</p>
  </div>
  
</body>
</html>
`;

async function sendReports() {
  try {
    // Verify connection
    await transporter.verify();
    console.log('[Email] SMTP connection verified ✅');

    const info = await transporter.sendMail({
      from: `"Crystal Power Investments" <${FROM_EMAIL}>`,
      to: TO_EMAIL,
      subject: '📋 CPI Property Search Reports — B-Block & Studios/Privado | MatchPro™',
      html: htmlBody,
      replyTo: 'support@crystalpowerinvestments.com',
      attachments: [
        {
          filename: 'CPI_BBlock_Apartments_Report.pdf',
          path: '/home/ubuntu/CPI_BBlock_Apartments_Report.pdf',
          contentType: 'application/pdf',
        },
        {
          filename: 'CPI_Studios_Privado_Report.pdf',
          path: '/home/ubuntu/CPI_Studios_Privado_Report.pdf',
          contentType: 'application/pdf',
        },
      ],
    });

    console.log(`[Email] ✅ Both reports sent successfully!`);
    console.log(`[Email] Message ID: ${info.messageId}`);
    console.log(`[Email] Recipient: ${TO_EMAIL}`);
  } catch (error) {
    console.error('[Email] ❌ Failed to send:', error.message);
    process.exit(1);
  }
}

sendReports();
