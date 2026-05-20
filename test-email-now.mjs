import nodemailer from 'nodemailer';

console.log('Testing email credentials...\n');

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
  subject: '✅ MatchPro™ Email Test - System Ready',
  html: `
    <div style="font-family: Arial; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <h2 style="color: #0066cc;">✅ MatchPro™ Email System Test</h2>
      <p><strong>Status:</strong> Email credentials verified and working!</p>
      <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>From:</strong> ${process.env.SMTP_USER}</p>
      <p><strong>To:</strong> ${process.env.REPORT_TO_EMAIL}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p>Your daily demand reports will now be sent automatically at 9:00 AM Cairo Time every day.</p>
      <p style="color: #666; font-size: 12px;">This is an automated test email from MatchPro™</p>
    </div>
  `,
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ FAILED:', error.message);
    process.exit(1);
  } else {
    console.log('✅ SUCCESS! Email sent to:', process.env.REPORT_TO_EMAIL);
    console.log('📧 Check your inbox now');
    process.exit(0);
  }
});
