import nodemailer from 'nodemailer';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const mailOptions = {
  from: `"MatchPro™ Intelligence" <${process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER}>`,
  to: 'momenmaisara@crystalpowerinvestments.com, maisaramoamen@gmail.com',
  subject: `CPI MatchPro™ Intelligence Report — ${today}`,
  html: `
    <div style="font-family: Calibri, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #f8f9fa;">
      <div style="background: #0D1B2A; padding: 32px 40px; text-align: center;">
        <h1 style="color: #C9A84C; margin: 0; font-size: 22px; letter-spacing: 1px;">CRYSTAL POWER INVESTMENTS</h1>
        <p style="color: #F5E6C0; margin: 8px 0 0; font-size: 13px; letter-spacing: 2px;">MatchPro™ Intelligence Report</p>
      </div>
      
      <div style="padding: 32px 40px; background: #fff;">
        <p style="color: #1A1A2E; font-size: 15px;">Dear M,</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.7;">
          Please find attached your <strong>MatchPro™ Intelligence Report</strong> dated <strong>${today}</strong>, 
          containing the following 5 sheets:
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #0D1B2A;">
            <th style="padding: 10px 14px; color: #C9A84C; text-align: left; font-size: 13px;">Sheet</th>
            <th style="padding: 10px 14px; color: #C9A84C; text-align: left; font-size: 13px;">Records</th>
            <th style="padding: 10px 14px; color: #C9A84C; text-align: left; font-size: 13px;">Description</th>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px 14px; font-size: 13px; color: #1A1A2E;">📊 Overview</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #6B7280;">—</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #374151;">KPI summary, navigation & key insights</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 14px; font-size: 13px; color: #1A1A2E;">🏠 Villa Demand</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #1A7A4A;"><strong>500</strong></td>
            <td style="padding: 10px 14px; font-size: 13px; color: #374151;">Active buyer requests for villas, townhouses & twin houses</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px 14px; font-size: 13px; color: #1A1A2E;">🌿 Madinaty Villas</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #1A7A4A;"><strong>215</strong></td>
            <td style="padding: 10px 14px; font-size: 13px; color: #374151;">Villa & duplex listings in Madinaty with investment scores</td>
          </tr>
          <tr style="background: #fff;">
            <td style="padding: 10px 14px; font-size: 13px; color: #1A1A2E;">🏡 Privado</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #1A7A4A;"><strong>400</strong></td>
            <td style="padding: 10px 14px; font-size: 13px; color: #374151;">200 demand requests + 200 redirectable supply listings</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px 14px; font-size: 13px; color: #1A1A2E;">💎 VIP Properties</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #1A7A4A;"><strong>500</strong></td>
            <td style="padding: 10px 14px; font-size: 13px; color: #374151;">Premium listings EGP 5M+ — penthouses, rooftops, duplexes, sky villas</td>
          </tr>
        </table>
        
        <div style="background: #F5E6C0; border-left: 4px solid #C9A84C; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; color: #1A1A2E;">
            <strong>Key Insight:</strong> 500 active villa demand requests indicate strong buyer activity in this segment. 
            Madinaty avg rental yield: <strong>12–22%/yr</strong>. 
            Privado has <strong>246 demand requests</strong> — high redirection opportunity.
          </p>
        </div>
        
        <p style="color: #6B7280; font-size: 12px; margin-top: 24px;">
          This report is generated automatically by MatchPro™ WhatsApp Intelligence System.<br>
          Data is sourced from monitored WhatsApp real estate groups in real-time.
        </p>
      </div>
      
      <div style="background: #0D1B2A; padding: 20px 40px; text-align: center;">
        <p style="color: #6B7280; font-size: 11px; margin: 0;">
          Crystal Power Investments  |  MatchPro™ Intelligence  |  CONFIDENTIAL<br>
          ${today}
        </p>
      </div>
    </div>
  `,
  attachments: [
    {
      filename: `CPI_MatchPro_Intelligence_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      path: '/home/ubuntu/CPI_MatchPro_Intelligence_Report.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
  ]
};

try {
  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Email sent:', info.messageId);
  console.log('   To:', mailOptions.to);
} catch (err) {
  console.error('❌ Email error:', err.message);
}
