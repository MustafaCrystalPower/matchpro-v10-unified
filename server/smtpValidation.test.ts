import { describe, it, expect } from 'vitest';
import { verifyEmailConnection } from './_core/emailService';

describe('SMTP Configuration Validation', () => {
  it('should verify SMTP connection with provided credentials', async () => {
    const isConnected = await verifyEmailConnection();
    expect(isConnected).toBe(true);
  }, { timeout: 10000 });
});
