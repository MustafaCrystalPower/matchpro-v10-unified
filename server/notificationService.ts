/**
 * MatchPro Notification Service
 *
 * POLICY: MatchPro does not send messages to individuals.
 * All results are available internally via the dashboard only.
 * All outbound WhatsApp and email send functions are permanently disabled.
 *
 * This file retains the payload formatting utilities for internal logging
 * and future audit purposes, but no messages leave the system.
 */

import { getAdminEmails, getNotificationPreferences, getMatchWithDetails } from './db';

interface NotificationPayload {
  title: string;
  message: string;
  matchId?: number;
  matchScore?: number;
  supplyLocation?: string;
  demandLocation?: string;
  supplyPrice?: string;
  demandPriceRange?: string;
  sellerName?: string;
  sellerPhone?: string;
  buyerName?: string;
  buyerPhone?: string;
  supplyMessage?: string;
  demandMessage?: string;
  propertyType?: string;
  bedrooms?: number;
  size?: number;
}

/**
 * Send WhatsApp notification via Green API
 */
export async function sendWhatsAppNotification(
  phoneNumber: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const instanceId = process.env.GREEN_API_INSTANCE_ID;
    const token = process.env.GREEN_API_TOKEN;
    
    if (!instanceId || !token) {
      console.warn('[Notification] Green API credentials not configured');
      return false;
    }

    const message = `${payload.title}\n${payload.message}`;
    const response = await fetch(
      `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${phoneNumber}@c.us`,
          message,
        }),
      }
    );

    if (response.ok) {
      console.log(`[Notification] WhatsApp sent to ${phoneNumber}`);
      return true;
    } else {
      console.error(`[Notification] Failed to send WhatsApp: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('[Notification] Error sending WhatsApp:', error);
    return false;
  }
}

/**
 * Send email notification via SMTP
 */
export async function sendEmailNotification(
  toEmail: string,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    
    if (!user || !pass) {
      console.warn('[Notification] SMTP credentials not configured');
      return false;
    }

    const nodemailer = await import('nodemailer');
    const domain = (user.split('@')[1] || '').toLowerCase();
    let host = process.env.SMTP_HOST;
    if (!host) {
      if (domain.includes('gmail')) host = 'smtp.gmail.com';
      else if (domain.includes('outlook') || domain.includes('hotmail')) host = 'smtp.office365.com';
      else if (domain.includes('yahoo')) host = 'smtp.mail.yahoo.com';
      else host = `mail.${domain}`;
    }

    const transporter = nodemailer.default.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    await transporter.sendMail({
      from: user,
      to: toEmail,
      subject: payload.title,
      text: payload.message,
      html: `<h2>${payload.title}</h2><p>${payload.message.replace(/\n/g, '<br>')}</p>`,
    });

    console.log(`[Notification] Email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('[Notification] Error sending email:', error);
    return false;
  }
}

/**
 * DISABLED — admin notifications via outbound channels are not permitted.
 * High-confidence matches are visible in the dashboard only.
 */
export async function notifyAdmins(_payload: NotificationPayload): Promise<void> {
  console.log('[Notification] DISABLED: notifyAdmins — all match results are available in the dashboard.');
}

/**
 * DISABLED — high-confidence match outbound notifications are not permitted.
 * Results are displayed in the Matches page only.
 */
export async function notifyHighConfidenceMatch(_matchId: number): Promise<void> {
  console.log('[Notification] DISABLED: notifyHighConfidenceMatch — match visible in dashboard.');
}

/**
 * DISABLED — user-level outbound notifications are not permitted.
 */
export async function sendUserNotification(
  _userId: number,
  _payload: NotificationPayload
): Promise<{ whatsapp: boolean; email: boolean }> {
  console.log('[Notification] DISABLED: sendUserNotification — no outbound messaging permitted.');
  return { whatsapp: false, email: false };
}

/**
 * Internal log formatter — formats match payload for server-side logging only.
 * No data leaves the system.
 */
export function formatMatchSummaryForLog(payload: NotificationPayload): string {
  const lines = [
    `[MatchPro Internal Log] ${payload.title}`,
    `Score: ${payload.matchScore ?? 'N/A'}%`,
    `Supply: ${payload.sellerName ?? 'Unknown'} | ${payload.supplyLocation ?? 'N/A'} | ${payload.supplyPrice ?? 'N/A'}`,
    `Demand: ${payload.buyerName ?? 'Unknown'} | ${payload.demandLocation ?? 'N/A'} | ${payload.demandPriceRange ?? 'N/A'}`,
    payload.message,
  ];
  return lines.join('\n');
}
