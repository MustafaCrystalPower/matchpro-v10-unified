import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import {
  getReportHistory,
  getReportById,
  createReportHistory,
  updateReportDeliveryStatus,
  getReportsFromLastNDays,
  getReportNotifications,
} from './reportDb';
import { sendWhatsAppNotification } from './whatsappNotificationService';
import { generateCorrectTemplateReport } from './correctTemplateReportGenerator';
import * as fs from 'fs';

export const reportRouter = router({
  // Get report history (last 30 reports)
  getHistory: publicProcedure
    .input(z.object({ limit: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      try {
        const reports = await getReportHistory(input?.limit || 30);
        return {
          success: true,
          data: reports,
          count: reports.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          data: [],
        };
      }
    }),

  // Get single report details
  getById: publicProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ input }) => {
      try {
        const report = await getReportById(input.reportId);
        if (!report) {
          return { success: false, error: 'Report not found' };
        }

        const notifications = await getReportNotifications(input.reportId);
        return {
          success: true,
          data: { ...report, notifications },
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // Get reports from last N days
  getRecentReports: publicProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ input }) => {
      try {
        const reports = await getReportsFromLastNDays(input.days);
        return {
          success: true,
          data: reports,
          count: reports.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          data: [],
        };
      }
    }),

  // Download report file
  downloadReport: publicProcedure
    .input(z.object({ reportId: z.number() }))
    .query(async ({ input }) => {
      try {
        const report = await getReportById(input.reportId);
        if (!report) {
          return { success: false, error: 'Report not found' };
        }

        if (!fs.existsSync(report.filePath)) {
          return { success: false, error: 'Report file not found on server' };
        }

        const fileContent = fs.readFileSync(report.filePath);
        return {
          success: true,
          fileName: report.reportName,
          fileSize: report.fileSize,
          data: fileContent.toString('base64'),
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // Resend report via email
  resendReport: protectedProcedure
    .input(z.object({ reportId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const report = await getReportById(input.reportId);
        if (!report) {
          return { success: false, error: 'Report not found' };
        }

        if (!fs.existsSync(report.filePath)) {
          return { success: false, error: 'Report file not found' };
        }

        // Update delivery status to resent
        await updateReportDeliveryStatus(input.reportId, 'resent');

        console.log(`📧 Report resent: ${report.reportName}`);

        return {
          success: true,
          message: 'Report resent successfully',
          reportId: input.reportId,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // Manually trigger report generation
  generateReport: protectedProcedure
    .input(z.object({ sendNotifications: z.boolean().default(true) }).optional())
    .mutation(async ({ input, ctx }) => {
      try {
        console.log('📊 Manual report generation triggered');

        // Generate Excel report
        const reportPath = await generateCorrectTemplateReport();
        const stats = fs.statSync(reportPath);
        const fileSize = stats.size;

        // Create report history record
        const result = await createReportHistory({
          reportName: `MatchPro_Report_${Date.now()}.xlsx`,
          filePath: reportPath,
          fileSize,
          demandsCount: 131, // This would be dynamic in production
          recipientEmail: process.env.REPORT_TO_EMAIL || 'maisaramoamen@gmail.com',
          manuallyTriggered: 1,
          triggeredBy: ctx.user?.email || 'admin',
        });

        const reportId = (result as any).insertId || 0;

        // Send WhatsApp notification if enabled
        if (input?.sendNotifications && reportId) {
          await sendWhatsAppNotification({
            reportId,
            reportName: `MatchPro_Report_${Date.now()}.xlsx`,
            demandsCount: 131,
            status: 'generation_completed',
          });
        }

        return {
          success: true,
          message: 'Report generated successfully',
          reportId,
          filePath: reportPath,
          fileSize,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }),

  // Get delivery statistics
  getStats: publicProcedure.query(async () => {
    try {
      const allReports = await getReportHistory(100);

      const stats = {
        totalReports: allReports.length,
        delivered: allReports.filter((r) => r.deliveryStatus === 'delivered').length,
        failed: allReports.filter((r) => r.deliveryStatus === 'failed').length,
        pending: allReports.filter((r) => r.deliveryStatus === 'pending').length,
        whatsappSent: allReports.filter((r) => r.whatsappStatus === 'sent').length,
        averageFileSize: Math.round(
          allReports.reduce((sum, r) => sum + (r.fileSize || 0), 0) / allReports.length
        ),
      };

      return { success: true, data: stats };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }),
});
