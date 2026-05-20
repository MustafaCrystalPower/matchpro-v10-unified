import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const mailOptions = {
  from: process.env.REPORT_FROM_EMAIL || process.env.SMTP_USER,
  to: 'maisaramoamen@gmail.com',
  subject: '📊 MatchPro Dashboard - Real Data Excel Report',
  html: `
    <h2>MatchPro Dashboard - Real Data Report</h2>
    <p>Dear M,</p>
    <p>Your comprehensive real estate matching report is ready!</p>
    <h3>📊 Report Contents:</h3>
    <ul>
      <li><strong>Summary:</strong> Key metrics and statistics</li>
      <li><strong>Sample Demands:</strong> 12,964 demand records</li>
      <li><strong>Sample Supplies:</strong> 7,069 supply records</li>
      <li><strong>High-Confidence Matches:</strong> 500 matches (≥75%)</li>
      <li><strong>Hot Matches:</strong> 38 premium matches (≥90%)</li>
      <li><strong>Madinaty Demands:</strong> Location-specific data</li>
    </ul>
    <h3>📈 Key Metrics:</h3>
    <ul>
      <li>Classification Accuracy: 95.4%</li>
      <li>Average Match Score: 79.8%</li>
      <li>Unknown Messages: 4.6%</li>
    </ul>
    <p><strong>Download the Excel file:</strong></p>
    <p><a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663030942069/hbSQhLoBXOQRjFxL.xlsx" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">📥 Download Report</a></p>
    <p>Best regards,<br>MatchPro System</p>
  `,
};

try {
  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Email sent successfully!');
  console.log('Message ID:', info.messageId);
} catch (error) {
  console.error('❌ Error sending email:', error.message);
  process.exit(1);
}
