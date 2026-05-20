import { describe, it, expect } from 'vitest';

describe('Email Configuration Verification', () => {
  it('should have correct report email configured', () => {
    const reportEmail = process.env.REPORT_TO_EMAIL;
    console.log(`Report Email: ${reportEmail}`);
    
    expect(reportEmail).toBe('maisaramoamen@gmail.com');
  });

  it('should have SMTP configuration', () => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    console.log(`SMTP Host: ${smtpHost}`);
    console.log(`SMTP Port: ${smtpPort}`);
    console.log(`SMTP User: ${smtpUser}`);
    console.log(`SMTP Pass: ${smtpPass ? '✓ Configured' : '✗ Not configured'}`);

    expect(smtpHost).toBeTruthy();
    expect(smtpPort).toBeTruthy();
    expect(smtpUser).toBeTruthy();
    expect(smtpPass).toBeTruthy();
  });
});
