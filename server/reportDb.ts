import { getDb } from './db';
import { reportHistory, reportNotifications } from '../drizzle/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

export async function createReportHistory(data: {
  reportName: string;
  filePath: string;
  fileSize: number;
  demandsCount: number;
  recipientEmail: string;
  manuallyTriggered?: number;
  triggeredBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const result = await db.insert(reportHistory).values({
    ...data,
    generatedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result;
}

export async function updateReportDeliveryStatus(
  reportId: number,
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'resent',
  deliveryError?: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db
    .update(reportHistory)
    .set({
      deliveryStatus: status,
      sentAt: new Date(),
      deliveryError: deliveryError || null,
      updatedAt: new Date(),
    })
    .where(eq(reportHistory.id, reportId));
}

export async function updateReportWhatsAppStatus(
  reportId: number,
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed',
  messageId?: string,
  error?: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db
    .update(reportHistory)
    .set({
      whatsappStatus: status,
      whatsappMessageId: messageId || null,
      whatsappError: error || null,
      updatedAt: new Date(),
    })
    .where(eq(reportHistory.id, reportId));
}

export async function getReportHistory(limit: number = 30) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db
    .select()
    .from(reportHistory)
    .orderBy(desc(reportHistory.generatedAt))
    .limit(limit);
}

export async function getReportById(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const result = await db
    .select()
    .from(reportHistory)
    .where(eq(reportHistory.id, reportId));
  return result[0] || null;
}

export async function createReportNotification(data: {
  reportId: number;
  notificationType: 'generation_started' | 'generation_completed' | 'delivery_success' | 'delivery_failed' | 'resend_requested';
  channel: 'whatsapp' | 'slack' | 'email';
  recipientPhone?: string;
  recipientSlackId?: string;
  messageContent?: string;
  messageId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db.insert(reportNotifications).values({
    ...data,
    status: 'pending',
    createdAt: new Date(),
  });
}

export async function updateNotificationStatus(
  notificationId: number,
  status: 'pending' | 'sent' | 'delivered' | 'failed',
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db
    .update(reportNotifications)
    .set({
      status,
      errorMessage: errorMessage || null,
      sentAt: status === 'sent' || status === 'delivered' ? new Date() : null,
    })
    .where(eq(reportNotifications.id, notificationId));
}

export async function getReportNotifications(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db
    .select()
    .from(reportNotifications)
    .where(eq(reportNotifications.reportId, reportId))
    .orderBy(desc(reportNotifications.createdAt));
}

export async function getPendingNotifications() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  return await db
    .select()
    .from(reportNotifications)
    .where(eq(reportNotifications.status, 'pending'))
    .orderBy(reportNotifications.createdAt);
}

export async function getReportsFromLastNDays(days: number) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');
  const date = new Date();
  date.setDate(date.getDate() - days);

  return await db
    .select()
    .from(reportHistory)
    .where(gte(reportHistory.generatedAt, date))
    .orderBy(desc(reportHistory.generatedAt));
}
