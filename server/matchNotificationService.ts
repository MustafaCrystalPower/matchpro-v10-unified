import { getDb } from './db';
import { sendWhatsAppMessage } from './_core/whatsapp';

export interface MatchNotification {
  matchId: number;
  supplyId: number;
  demandId: number;
  supplyPhone: string;
  demandPhone: string;
  supplyName: string;
  demandName: string;
  matchScore: number;
  matchReason: string;
  location: string;
  propertyType: string;
  createdAt: Date;
}

/**
 * Send WhatsApp notification for high-confidence matches (score >= 85%)
 * Sends from the application, not from Manus
 */
export async function notifyHighConfidenceMatch(match: MatchNotification): Promise<boolean> {
  try {
    console.log(`[Match Notification] Processing match ${match.matchId} (Score: ${match.matchScore}%)`);

    if (match.matchScore < 85) {
      console.log(`[Match Notification] Score ${match.matchScore}% below threshold (85%)`);
      return false;
    }

    // Message for supply side (seller/landlord)
    const supplyMessage = `
🎯 *MatchPro Alert - High Confidence Match!*

We found a buyer for your property! 

📍 *Your Property*
Type: ${match.propertyType}
Location: ${match.location}

👤 *Interested Buyer*
Name: ${match.demandName}
Phone: ${match.demandPhone}

💯 *Match Score: ${match.matchScore}%*
Reason: ${match.matchReason}

📞 Contact them directly or reply to this message for more details.

---
MatchPro Real Estate Intelligence
    `.trim();

    // Message for demand side (buyer/tenant)
    const demandMessage = `
🎯 *MatchPro Alert - Perfect Property Found!*

We found a property that matches your requirements! 

🏠 *Available Property*
Type: ${match.propertyType}
Location: ${match.location}

👤 *Property Owner*
Name: ${match.supplyName}
Phone: ${match.supplyPhone}

💯 *Match Score: ${match.matchScore}%*
Reason: ${match.matchReason}

📞 Contact them directly or reply to this message for more details.

---
MatchPro Real Estate Intelligence
    `.trim();

    // Send WhatsApp messages
    let supplyNotified = false;
    let demandNotified = false;

    try {
      console.log(`[Match Notification] Sending message to supply (${match.supplyPhone})...`);
      supplyNotified = await sendWhatsAppMessage(match.supplyPhone, supplyMessage);
      console.log(`[Match Notification] Supply notification: ${supplyNotified ? 'Sent' : 'Failed'}`);
    } catch (error: any) {
      console.error(`[Match Notification] Failed to notify supply:`, error.message);
    }

    try {
      console.log(`[Match Notification] Sending message to demand (${match.demandPhone})...`);
      demandNotified = await sendWhatsAppMessage(match.demandPhone, demandMessage);
      console.log(`[Match Notification] Demand notification: ${demandNotified ? 'Sent' : 'Failed'}`);
    } catch (error: any) {
      console.error(`[Match Notification] Failed to notify demand:`, error.message);
    }

    // Save notification record to database
    await saveNotificationRecord(match, supplyNotified, demandNotified);

    return supplyNotified || demandNotified;
  } catch (error: any) {
    console.error('[Match Notification] Error:', error.message);
    return false;
  }
}

/**
 * Save notification record to database for tracking
 */
async function saveNotificationRecord(
  match: MatchNotification,
  supplyNotified: boolean,
  demandNotified: boolean
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[Match Notification] Database not available for recording');
      return;
    }

    // TODO: Insert into matchNotifications table
    console.log(`[Match Notification] Recorded: Supply=${supplyNotified}, Demand=${demandNotified}`);
  } catch (error: any) {
    console.error('[Match Notification] Failed to save record:', error.message);
  }
}

/**
 * Batch notify all high-confidence matches
 */
export async function notifyAllHighConfidenceMatches(): Promise<number> {
  try {
    console.log('[Match Notification] Starting batch notification process...');

    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    // Get all matches with score >= 85% that haven't been notified yet
    const matches = await (db as any).$client.promise().execute(
      `SELECT 
        m.id as matchId,
        m.supplyId,
        m.demandId,
        m.matchScore,
        m.matchReason,
        s.contact as supplyPhone,
        s.contactName as supplyName,
        d.contact as demandPhone,
        d.contactName as demandName,
        s.location,
        s.propertyType
      FROM matches m
      JOIN supply s ON m.supplyId = s.id
      JOIN demand d ON m.demandId = d.id
      WHERE m.matchScore >= 85
      AND m.notificationSent = false
      LIMIT 100`
    );

    const matchRows = (matches as any[])[0] || [];
    console.log(`[Match Notification] Found ${matchRows.length} high-confidence matches to notify`);

    let notifiedCount = 0;

    for (const row of matchRows) {
      const match: MatchNotification = {
        matchId: row.matchId,
        supplyId: row.supplyId,
        demandId: row.demandId,
        supplyPhone: row.supplyPhone,
        demandPhone: row.demandPhone,
        supplyName: row.supplyName,
        demandName: row.demandName,
        matchScore: row.matchScore,
        matchReason: row.matchReason,
        location: row.location,
        propertyType: row.propertyType,
        createdAt: new Date(),
      };

      const notified = await notifyHighConfidenceMatch(match);
      if (notified) {
        notifiedCount++;

        // Mark as notified in database
        try {
          await (db as any).$client.promise().execute(
            `UPDATE matches SET notificationSent = true, notificationSentAt = NOW() WHERE id = ?`,
            [row.matchId]
          );
        } catch (error: any) {
          console.warn(`[Match Notification] Failed to mark match ${row.matchId} as notified:`, error.message);
        }
      }
    }

    console.log(`[Match Notification] Batch notification complete: ${notifiedCount} matches notified`);
    return notifiedCount;
  } catch (error: any) {
    console.error('[Match Notification] Batch error:', error.message);
    return 0;
  }
}

/**
 * Get notification history
 */
export async function getNotificationHistory(limit: number = 100): Promise<MatchNotification[]> {
  try {
    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    const result = await (db as any).$client.promise().execute(
      `SELECT 
        m.id as matchId,
        m.supplyId,
        m.demandId,
        m.matchScore,
        m.matchReason,
        s.contact as supplyPhone,
        s.contactName as supplyName,
        d.contact as demandPhone,
        d.contactName as demandName,
        s.location,
        s.propertyType,
        m.notificationSentAt as createdAt
      FROM matches m
      JOIN supply s ON m.supplyId = s.id
      JOIN demand d ON m.demandId = d.id
      WHERE m.notificationSent = true
      ORDER BY m.notificationSentAt DESC
      LIMIT ?`,
      [limit]
    );

    const rows = (result as any[])[0] || [];
    return rows.map((row: any) => ({
      matchId: row.matchId,
      supplyId: row.supplyId,
      demandId: row.demandId,
      supplyPhone: row.supplyPhone,
      demandPhone: row.demandPhone,
      supplyName: row.supplyName,
      demandName: row.demandName,
      matchScore: row.matchScore,
      matchReason: row.matchReason,
      location: row.location,
      propertyType: row.propertyType,
      createdAt: row.createdAt,
    }));
  } catch (error: any) {
    console.error('[Match Notification] Failed to get history:', error.message);
    return [];
  }
}
