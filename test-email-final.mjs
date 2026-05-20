import nodemailer from 'nodemailer';

console.log('🔐 Testing Gmail app password...\n');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const mailOptions = {
  from: process.env.SMTP_USER,
  to: process.env.REPORT_TO_EMAIL,
  subject: '✅ MatchPro™ Email System - VERIFIED',
  html: `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #0066cc;">✅ MatchPro™ Email System Verified</h2>
      <p><strong>Status:</strong> ✅ Email credentials working!</p>
      <p><strong>Sent at:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })} (Cairo Time)</p>
      <p><strong>From:</strong> ${process.env.SMTP_USER}</p>
      <p><strong>To:</strong> ${process.env.REPORT_TO_EMAIL}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <h3>📅 Daily Reports Schedule</h3>
      <p>Your daily demand reports will now be sent automatically at <strong>9:00 AM Cairo Time (UTC+2)</strong> every day.</p>
      <p>Each report includes:</p>
      <ul>
        <li>Total demands by location</li>
        <li>Average budget and property specs</li>
        <li>Property type breakdown</li>
        <li>Full demand details table</li>
      </ul>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">This is an automated email from MatchPro™ Real Estate Intelligence System</p>
    </div>
  `,
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  } else {
    console.log('✅ SUCCESS! Email sent successfully');
    console.log('📧 Check your inbox at:', process.env.REPORT_TO_EMAIL);
    console.log('\n✓ Email system is now operational');
    console.log('✓ Daily reports will send at 9 AM Cairo time');
    process.exit(0);
  }
});
