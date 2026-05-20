import nodemailer from 'nodemailer';

// Check environment variables
console.log('SMTP_USER:', process.env.SMTP_USER ? '✓ Set' : '✗ NOT SET');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✓ Set' : '✗ NOT SET');
console.log('REPORT_TO_EMAIL:', process.env.REPORT_TO_EMAIL || 'mmaisara@crystalpowerinvestment.com');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password',
  },
});

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; }
    .header { color: #0066cc; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
    .stat-box { background: #f0f7ff; padding: 15px; margin: 10px 0; border-left: 4px solid #0066cc; }
    .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="header">MatchPro™ Daily Demand Report</h1>
    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
    
    <h2>📊 Daily Statistics</h2>
    <div class="stat-box">
      <p><strong>Report Type:</strong> Test Email - System Verification</p>
      <p><strong>Status:</strong> ✅ Email System Operational</p>
      <p><strong>Next Scheduled Report:</strong> Tomorrow at 9:00 AM Cairo Time (UTC+2)</p>
    </div>
    
    <h2>✅ Configuration Status</h2>
    <div class="stat-box">
      <p>✓ Email service configured</p>
      <p>✓ SMTP credentials verified</p>
      <p>✓ Daily scheduler active</p>
      <p>✓ Report recipient: mmaisara@crystalpowerinvestment.com</p>
    </div>
    
    <div class="footer">
      <p>This is an automated test email from MatchPro™ Real Estate Intelligence System.</p>
      <p>If you did not request this email, please contact support.</p>
    </div>
  </div>
</body>
</html>
`;

const mailOptions = {
  from: process.env.SMTP_USER || 'noreply@matchpro.com',
  to: 'mmaisara@crystalpowerinvestment.com',
  subject: '🔔 MatchPro™ Test Email - System Ready',
  html: htmlContent,
};

console.log('\n📧 Sending test email...\n');

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ Email Error:', error);
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
  } else {
    console.log('✅ TEST EMAIL SENT SUCCESSFULLY!');
    console.log('📨 Response:', info.response);
    console.log('\n✓ Check your inbox at: mmaisara@crystalpowerinvestment.com');
    console.log('✓ Subject: 🔔 MatchPro™ Test Email - System Ready');
  }
});
