import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const mailOptions = {
  from: process.env.SMTP_USER,
  to: 'mmaisara@crystalpowerinvestment.com',
  subject: 'MatchPro™ Test Email - Scheduler Verification',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0066cc;">MatchPro™ Daily Report Test</h2>
      <p>This is a test email to verify your email configuration is working correctly.</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Status:</strong> ✅ Email system is operational</p>
      <p>Your daily demand reports will be sent automatically at 9 AM Cairo time (UTC+2) every day.</p>
    </div>
  `,
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Email Error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Test email sent successfully!');
    console.log('Response:', info.response);
    process.exit(0);
  }
});
