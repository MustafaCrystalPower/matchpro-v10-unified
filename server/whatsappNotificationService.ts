import axios from 'axios';
import { createReportNotification, updateNotificationStatus } from './reportDb';

const GREEN_API_INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN;
const REPORT_TO_PHONE = process.env.REPORT_TO_PHONE || '201066505665'; // Default to owner's WhatsApp

interface WhatsAppNotificationPayload {
  reportId: number;
  reportName: string;
  demandsCount: number;
  status: 'generation_started' | 'generation_completed' | 'delivery_success' | 'delivery_failed';
  recipientPhone?: string;
  error?: string;
}

export async function sendWhatsAppNotification(payload: WhatsAppNotificationPayload) {
  if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
    console.warn('⚠️ WhatsApp credentials not configured, skipping notification');
    return null;
  }

  try {
    const recipientPhone = payload.recipientPhone || REPORT_TO_PHONE;
    const messageText = formatWhatsAppMessage(payload);

    console.log(`📱 Sending WhatsApp notification to ${recipientPhone}...`);

    // Create notification record
    const notificationResult = await createReportNotification({
      reportId: payload.reportId,
      notificationType: payload.status === 'generation_completed' ? 'generation_completed' : 'delivery_success',
      channel: 'whatsapp',
      recipientPhone,
      messageContent: messageText,
    });

    const notificationId = (notificationResult as any).insertId || 0;

    // Send via Green API
    const response = await axios.post(
      `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`,
      {
        chatId: `${recipientPhone}@c.us`,
        message: messageText,
      },
      { timeout: 10000 }
    );

    if (response.data && response.data.idMessage) {
      console.log(`✅ WhatsApp notification sent: ${response.data.idMessage}`);

      // Update notification status
      if (notificationId) {
        await updateNotificationStatus(notificationId, 'sent', undefined);
      }

      return {
        success: true,
        messageId: response.data.idMessage,
        notificationId,
      };
    } else {
      throw new Error('No message ID returned from Green API');
    }
  } catch (error: any) {
    console.error('❌ WhatsApp notification failed:', error.message);

    // Log the error
    if ((error.response?.data as any)?.error) {
      console.error('Green API Error:', (error.response.data as any).error);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

function formatWhatsAppMessage(payload: WhatsAppNotificationPayload): string {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' });

  switch (payload.status) {
    case 'generation_started':
      return `📊 *MatchPro Report Generation Started*\n\nReport: ${payload.reportName}\nTime: ${timestamp}\n\n⏳ Generating Excel report with demand data...`;

    case 'generation_completed':
      return `✅ *MatchPro Report Generated Successfully*\n\n📋 Report: ${payload.reportName}\n📊 Demands: ${payload.demandsCount}\n📁 Sheets: 21\n⏰ Time: ${timestamp}\n\n🚀 Report is ready for delivery!`;

    case 'delivery_success':
      return `📧 *MatchPro Report Delivered*\n\n✅ Report: ${payload.reportName}\n📊 Demands: ${payload.demandsCount}\n📁 Sheets: 21\n⏰ Delivered: ${timestamp}\n\n📧 Email sent to: maisaramoamen@gmail.com`;

    case 'delivery_failed':
      return `❌ *MatchPro Report Delivery Failed*\n\n📋 Report: ${payload.reportName}\n⚠️ Error: ${payload.error || 'Unknown error'}\n⏰ Time: ${timestamp}\n\n🔄 Please retry or check configuration.`;

    default:
      return `📊 *MatchPro Notification*\n\nReport: ${payload.reportName}\nTime: ${timestamp}`;
  }
}

export async function sendBulkWhatsAppNotifications(
  reportId: number,
  recipientPhones: string[],
  messageText: string
) {
  if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
    console.warn('⚠️ WhatsApp credentials not configured');
    return [];
  }

  const results = [];

  for (const phone of recipientPhones) {
    try {
      const response = await axios.post(
        `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`,
        {
          chatId: `${phone}@c.us`,
          message: messageText,
        },
        { timeout: 10000 }
      );

      if (response.data && response.data.idMessage) {
        results.push({
          phone,
          success: true,
          messageId: response.data.idMessage,
        });
      }
    } catch (error: any) {
      results.push({
        phone,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

export async function getWhatsAppConnectionStatus(): Promise<boolean> {
  if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) {
    return false;
  }

  try {
    const response = await axios.get(
      `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/getStatusInstance/${GREEN_API_TOKEN}`,
      { timeout: 5000 }
    );

    return response.data?.statusInstance === 'authorized';
  } catch (error) {
    console.error('WhatsApp connection check failed:', error);
    return false;
  }
}
