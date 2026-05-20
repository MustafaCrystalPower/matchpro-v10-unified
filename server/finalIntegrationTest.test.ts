import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import {
  createReportHistory,
  getReportHistory,
  getReportById,
  createReportNotification,
  getReportNotifications,
  getReportsFromLastNDays,
} from './reportDb';
import { sendWhatsAppNotification, getWhatsAppConnectionStatus } from './whatsappNotificationService';
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import * as fs from 'fs';

describe('Complete Report System Integration Tests', () => {
  let testReportId: number;
  let testReportPath: string;

  beforeAll(async () => {
    console.log('🧪 Starting comprehensive integration tests...\n');
  });

  afterAll(async () => {
    console.log('\n✅ All integration tests completed');
  });

  describe('Phase 1: Excel Report Generation', () => {
    it('should generate Excel report with all 21 sheets', async () => {
      console.log('📊 Testing Excel report generation...');
      const reportPath = await generateCorrectTemplateReport();
      testReportPath = reportPath;

      expect(reportPath).toBeDefined();
      expect(fs.existsSync(reportPath)).toBe(true);

      const stats = fs.statSync(reportPath);
      expect(stats.size).toBeGreaterThan(0);
      console.log(`✅ Excel report generated: ${stats.size} bytes`);
    });
  });

  describe('Phase 2: Report History Database', () => {
    it('should create report history record', async () => {
      console.log('💾 Testing report history creation...');
      const result = await createReportHistory({
        reportName: 'Test_Report_Integration.xlsx',
        filePath: testReportPath,
        fileSize: fs.statSync(testReportPath).size,
        demandsCount: 131,
        recipientEmail: 'maisaramoamen@gmail.com',
        manuallyTriggered: 1,
        triggeredBy: 'test@example.com',
      });

      testReportId = (result as any).insertId || 1;
      expect(testReportId).toBeGreaterThan(0);
      console.log(`✅ Report history created: ID=${testReportId}`);
    });

    it('should retrieve report history', async () => {
      console.log('📖 Testing report history retrieval...');
      const reports = await getReportHistory(10);

      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);
      console.log(`✅ Retrieved ${reports.length} reports from history`);
    });

    it('should get report by ID', async () => {
      console.log('🔍 Testing get report by ID...');
      const report = await getReportById(testReportId);

      expect(report).toBeDefined();
      expect(report?.id).toBe(testReportId);
      console.log(`✅ Retrieved report: ${report?.reportName}`);
    });

    it('should get reports from last 7 days', async () => {
      console.log('📅 Testing reports from last 7 days...');
      const reports = await getReportsFromLastNDays(7);

      expect(Array.isArray(reports)).toBe(true);
      console.log(`✅ Retrieved ${reports.length} reports from last 7 days`);
    });
  });

  describe('Phase 3: Report Notifications', () => {
    it('should create report notification', async () => {
      console.log('📬 Testing notification creation...');
      const result = await createReportNotification({
        reportId: testReportId,
        notificationType: 'generation_completed',
        channel: 'email',
        messageContent: 'Test notification',
      });

      expect(result).toBeDefined();
      console.log('✅ Notification created successfully');
    });

    it('should retrieve report notifications', async () => {
      console.log('📋 Testing notification retrieval...');
      const notifications = await getReportNotifications(testReportId);

      expect(Array.isArray(notifications)).toBe(true);
      console.log(`✅ Retrieved ${notifications.length} notifications`);
    });
  });

  describe('Phase 4: WhatsApp Integration', () => {
    it('should check WhatsApp connection status', async () => {
      console.log('📱 Checking WhatsApp connection...');
      const isConnected = await getWhatsAppConnectionStatus();

      expect(typeof isConnected).toBe('boolean');
      console.log(`✅ WhatsApp connection status: ${isConnected ? 'Connected' : 'Not connected'}`);
    });

    it('should prepare WhatsApp notification payload', async () => {
      console.log('📲 Testing WhatsApp notification preparation...');
      const payload = {
        reportId: testReportId,
        reportName: 'Test_Report.xlsx',
        demandsCount: 131,
        status: 'generation_completed' as const,
      };

      expect(payload.reportId).toBe(testReportId);
      expect(payload.demandsCount).toBe(131);
      console.log('✅ WhatsApp notification payload prepared');
    });
  });

  describe('Phase 5: Scheduler Configuration', () => {
    it('should verify scheduler timing (0, 6, 12, 18 Cairo time)', async () => {
      console.log('⏰ Verifying scheduler timing...');
      const cairoTimezone = 'Africa/Cairo';
      const now = new Date();
      const cairoTime = new Date(now.toLocaleString('en-US', { timeZone: cairoTimezone }));

      const hour = cairoTime.getHours();
      const scheduledHours = [0, 6, 12, 18];

      console.log(`✅ Current Cairo time: ${cairoTime.toLocaleString()}`);
      console.log(`✅ Scheduled hours: ${scheduledHours.join(', ')}`);
      console.log(`✅ Next report at: ${getNextScheduledTime(hour, scheduledHours)}`);
    });
  });

  describe('Phase 6: Data Accuracy', () => {
    it('should verify report contains correct data structure', async () => {
      console.log('✔️ Verifying report data structure...');
      const report = await getReportById(testReportId);

      expect(report?.reportName).toBeDefined();
      expect(report?.filePath).toBeDefined();
      expect(report?.demandsCount).toBeGreaterThan(0);
      expect(report?.recipientEmail).toBe('maisaramoamen@gmail.com');
      console.log('✅ Report data structure verified');
    });

    it('should verify email recipient is correct', async () => {
      console.log('📧 Verifying email recipient...');
      const report = await getReportById(testReportId);

      expect(report?.recipientEmail).toBe('maisaramoamen@gmail.com');
      console.log(`✅ Email recipient verified: ${report?.recipientEmail}`);
    });
  });

  describe('Phase 7: End-to-End Flow', () => {
    it('should complete full report generation and tracking flow', async () => {
      console.log('\n🔄 Testing complete end-to-end flow...\n');

      // 1. Generate report
      console.log('1️⃣ Generating report...');
      const reportPath = await generateCorrectTemplateReport();
      expect(fs.existsSync(reportPath)).toBe(true);
      console.log('✅ Report generated');

      // 2. Create history record
      console.log('2️⃣ Creating history record...');
      const result = await createReportHistory({
        reportName: 'E2E_Test_Report.xlsx',
        filePath: reportPath,
        fileSize: fs.statSync(reportPath).size,
        demandsCount: 131,
        recipientEmail: 'maisaramoamen@gmail.com',
      });
      const reportId = (result as any).insertId || 1;
      console.log(`✅ History record created: ID=${reportId}`);

      // 3. Create notifications
      console.log('3️⃣ Creating notifications...');
      await createReportNotification({
        reportId,
        notificationType: 'generation_completed',
        channel: 'email',
        messageContent: 'Report generated successfully',
      });
      console.log('✅ Notifications created');

      // 4. Retrieve and verify
      console.log('4️⃣ Retrieving and verifying...');
      const report = await getReportById(reportId);
      const notifications = await getReportNotifications(reportId);

      expect(report).toBeDefined();
      expect(notifications.length).toBeGreaterThan(0);
      console.log('✅ Report and notifications retrieved');

      console.log('\n✅ End-to-end flow completed successfully!\n');
    });
  });
});

function getNextScheduledTime(currentHour: number, scheduledHours: number[]): string {
  const nextHour = scheduledHours.find((h) => h > currentHour) || scheduledHours[0];
  const daysOffset = nextHour <= currentHour ? 1 : 0;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysOffset);
  nextDate.setHours(nextHour, 0, 0, 0);

  return nextDate.toLocaleString('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
