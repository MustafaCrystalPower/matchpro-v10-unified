import { eq, desc, sql, and, gte, or, like, isNull, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  messages, InsertMessage, Message,
  supply, InsertSupply, Supply,
  demand, InsertDemand, Demand,
  matches, InsertMatch, Match,
  whatsappGroups, InsertWhatsappGroup, WhatsappGroup,
  notifications, InsertNotification, Notification,
  userProfiles, InsertUserProfile, UserProfile,
  customNotifications, InsertCustomNotification, CustomNotification,
  userOnboarding, InsertUserOnboarding, UserOnboarding,
  brokerAnalytics, InsertBrokerAnalytics, BrokerAnalytics,
  geoMarketData, InsertGeoMarketData, GeoMarketData,
  auditLogs, InsertAuditLog, AuditLog,
  conversionFunnel, InsertConversionFunnel, ConversionFunnel,
  systemHealth, InsertSystemHealth, SystemHealth,
  segmentedAnalytics, InsertSegmentedAnalytics, SegmentedAnalytics,
  systemSettings, SystemSetting
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ MESSAGE QUERIES ============
export async function insertMessage(msg: InsertMessage): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(messages).values(msg);
  return result[0].insertId;
}

export async function getRecentMessages(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
}

export async function getLiveMessageFeed(limit: number = 20, senderFilter?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const query = db.select({
    id: messages.id,
    sender: messages.sender,
    senderName: messages.senderName,
    groupName: messages.groupName,
    messageText: messages.messageText,
    classification: messages.classification,
    language: messages.language,
    hasImage: messages.hasImage,
    createdAt: messages.createdAt,
  }).from(messages);

  if (senderFilter) {
    const normalized = senderFilter.replace(/^\+/, '') + '@c.us';
    return query.where(eq(messages.sender, normalized))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  return query.orderBy(desc(messages.createdAt)).limit(limit);
}

export async function getMessagesByClassification(classification: 'supply' | 'demand' | 'unknown', limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(messages)
    .where(eq(messages.classification, classification))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

export async function markMessageProcessed(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(messages).set({ processed: 1 }).where(eq(messages.id, id));
}

// ============ SUPPLY QUERIES ============

/**
 * Build a deduplication fingerprint for a supply listing.
 * Two listings from the same sender, same location, and same price range are considered duplicates.
 * Price is rounded to the nearest 50K EGP to handle minor variations.
 */
function supplyFingerprint(s: InsertSupply): string {
  const sender = (s.contact || '').replace(/[^0-9]/g, '').slice(-10);
  const loc = (s.location || '').toLowerCase().replace(/\s+/g, '');
  const priceRounded = s.price ? Math.round(Number(s.price) / 50000) * 50000 : 0;
  const type = (s.propertyType || '').toLowerCase();
  return `${sender}|${loc}|${priceRounded}|${type}`;
}

export async function insertSupply(s: InsertSupply): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Deduplication: check if same sender already posted same property (same location + price ± 50K)
  if (s.contact && s.location) {
    const fp = supplyFingerprint(s);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    const existing = await db.select({ id: supply.id })
      .from(supply)
      .where(
        and(
          eq(supply.contact, s.contact),
          eq(supply.location, s.location || ''),
          gte(supply.createdAt, cutoff)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      console.log(`[Supply Dedup] Skipping duplicate supply from ${s.contact} at ${s.location} (fp: ${fp})`);
      return null; // Duplicate — skip insert
    }
  }
  
  const result = await db.insert(supply).values(s);
  const insertedId = result[0].insertId;

  // ── Below-market villa alert ──────────────────────────────────────────────────
  try {
    const msgLower = (s.rawMessageText || '').toLowerCase();
    const locLower = ((s.location || '') + ' ' + (s.area || '')).toLowerCase();
    const isVilla = ['villa','فيلا','فلل','twin','توين','townhouse','تاون','standalone','مستقل'].some(
      k => (s.propertyType || '').toLowerCase().includes(k) || msgLower.includes(k)
    );
    const isTargetArea = ['مدينتي','الرحاب','رحاب','madinaty','rehab'].some(
      k => msgLower.includes(k) || locLower.includes(k)
    );
    if (isVilla && isTargetArea && s.price) {
      const price = Number(s.price);
      const isMadinaty = msgLower.includes('مدينتي') || locLower.includes('madinaty');
      const isTownhouse = msgLower.includes('تاون') || msgLower.includes('townhouse');
      const isTwin = msgLower.includes('توين') || msgLower.includes('twin');
      const benchmarkMid = isMadinaty
        ? (isTownhouse ? 17_500_000 : isTwin ? 29_000_000 : 45_000_000)
        : (isTownhouse ? 13_500_000 : isTwin ? 25_000_000 : 35_000_000);
      const ratio = price / benchmarkMid;
      if (ratio <= 0.85 && price > 1_000_000) {
        const { notifyOwner } = await import('./_core/notification.js');
        const area = isMadinaty ? 'Madinaty' : 'Rehab';
        const villaType = isTownhouse ? 'Townhouse' : isTwin ? 'Twin House' : 'Standalone';
        const priceM = (price / 1_000_000).toFixed(2);
        const benchM = (benchmarkMid / 1_000_000).toFixed(1);
        const discount = Math.round((1 - ratio) * 100);
        await notifyOwner({
          title: `🔥 BELOW MARKET VILLA — ${area} — ${priceM}M EGP (${discount}% below market)`,
          content:
            `New villa listed at ${priceM}M EGP in ${area}.\n` +
            `Type: ${villaType}\n` +
            `Market benchmark: ~${benchM}M EGP\n` +
            `Discount: ${discount}% below market\n` +
            `Contact: ${s.contact || 'N/A'} — ${s.contactName || ''}\n` +
            `Group: ${s.sourceGroup || 'N/A'}\n\n` +
            `Message: ${(s.rawMessageText || '').slice(0, 300)}`,
        });
        console.log(`[BelowMarket Alert] Villa in ${area} at ${priceM}M (${discount}% below market) — owner notified`);
      }
    }
  } catch (alertErr) {
    console.error('[BelowMarket Alert] Notification failed:', alertErr);
  }
  // ─────────────────────────────────────────────────────────────────────────

  return insertedId;
}

export async function getRecentSupply(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(supply).orderBy(desc(supply.createdAt)).limit(limit);
}

export async function getUnmatchedSupply() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(supply).where(eq(supply.matched, 0)).orderBy(desc(supply.createdAt));
}

export async function markSupplyMatched(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(supply).set({ matched: 1 }).where(eq(supply.id, id));
}

export async function getSupplyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(supply).where(eq(supply.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ DEMAND QUERIES ============
export async function insertDemand(d: InsertDemand): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(demand).values(d);
  return result[0].insertId;
}

export async function getRecentDemand(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(demand).orderBy(desc(demand.createdAt)).limit(limit);
}

export async function getUnmatchedDemand() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(demand).where(eq(demand.matched, 0)).orderBy(desc(demand.createdAt));
}

export async function markDemandMatched(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(demand).set({ matched: 1 }).where(eq(demand.id, id));
}

export async function getDemandById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(demand).where(eq(demand.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ MATCH QUERIES ============

/**
 * P1: Normalize any price to total EGP for cross-unit comparison.
 * per_sqm  → price × area_sqm
 * per_month → price × 12 × 15 (gross yield factor)
 * total    → price as-is
 */
export function normalizePriceToTotal(
  price: number | null | undefined,
  unit: string | null | undefined,
  areaSqm?: number | null
): number | null {
  if (!price) return null;
  const u = (unit ?? 'total').toLowerCase();
  if (u === 'per_sqm' || u === 'per_sqm') return areaSqm ? price * areaSqm : null;
  if (u === 'per_month' || u === 'monthly_rent') return price * 12 * 15;
  return price; // total
}

export async function insertMatch(m: InsertMatch): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Deduplication by seller+buyer phone pair:
  // If a match already exists for this exact (supplyContactPhone, demandContactPhone) pair,
  // UPDATE it with the new (higher) score instead of inserting a duplicate row.
  const supplyPhone = m.supplyContactPhone ?? null;
  const demandPhone = m.demandContactPhone ?? null;

  if (supplyPhone && demandPhone) {
    const [existing] = await (db as any).$client.promise().execute(
      `SELECT id, matchScore FROM matches
       WHERE supplyContactPhone = ? AND demandContactPhone = ?
         AND deletedAt IS NULL
       ORDER BY CAST(matchScore AS DECIMAL) DESC
       LIMIT 1`,
      [supplyPhone, demandPhone]
    ) as any[];

    const existingRow = existing?.[0];
    if (existingRow) {
      // Only update if new score is strictly higher
      const newScore = parseFloat(String(m.matchScore ?? 0));
      const oldScore = parseFloat(String(existingRow.matchScore ?? 0));
      if (newScore > oldScore) {
        await (db as any).$client.promise().execute(
          `UPDATE matches SET
             supplyId = ?, demandId = ?,
             matchScore = ?, locationScore = ?, priceScore = ?, specsScore = ?,
             matchSummary = ?, matchExplanation = ?,
             updatedAt = NOW()
           WHERE id = ?`,
          [
            m.supplyId ?? null, m.demandId ?? null,
            m.matchScore ?? 0, m.locationScore ?? null, m.priceScore ?? null, m.specsScore ?? null,
            m.matchSummary ?? null, m.matchExplanation ?? null,
            existingRow.id
          ]
        );
      }
      // Return existing id so callers can still reference the match
      return existingRow.id as number;
    }
  }

  // No existing pair — insert fresh row
  const result = await db.execute(
    sql`INSERT INTO matches (
      supplyId, demandId, matchScore, locationScore, priceScore, specsScore,
      status, notified, matchSummary, matchExplanation, notes,
      supplyContactPhone, supplyContactName, demandContactPhone, demandContactName,
      organizationId, createdAt, updatedAt
    ) VALUES (
      ${m.supplyId ?? null}, ${m.demandId ?? null},
      ${m.matchScore ?? 0}, ${m.locationScore ?? null}, ${m.priceScore ?? null}, ${m.specsScore ?? null},
      ${m.status ?? 'new'}, ${m.notified ?? 0},
      ${m.matchSummary ?? null}, ${m.matchExplanation ?? null}, ${m.notes ?? null},
      ${m.supplyContactPhone ?? null}, ${m.supplyContactName ?? null},
      ${m.demandContactPhone ?? null}, ${m.demandContactName ?? null},
      ${m.organizationId ?? null}, NOW(), NOW()
    )`
  ) as any;
  const insertId = result[0]?.insertId ?? 0;
  return insertId > 0 ? insertId : null;
}

export async function getRecentMatches(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  // Join supply/demand for purpose, phone, name, original message text, and notification audit
  // NOTE: $client is a non-promise Pool; must use .promise() wrapper
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT m.*,
            s.purpose AS supplyPurpose, s.contact AS supplyPhone, s.contactName AS supplyName,
            s.location AS supplyLocation, s.area AS supplyArea, s.city AS supplyCity,
            s.propertyType AS supplyPropertyType, s.price AS supplyPrice,
            s.bedrooms AS supplyBedrooms, s.size AS supplySize,
            d.purpose AS demandPurpose, d.contact AS demandPhone, d.contactName AS demandName,
            d.location AS demandLocation, d.area AS demandArea, d.city AS demandCity,
            d.propertyType AS demandPropertyType, d.priceMax AS demandPriceMax,
            d.bedrooms AS demandBedrooms,
            ms.messageText AS supplyOriginalMessage, ms.groupName AS supplyGroupName,
            md.messageText AS demandOriginalMessage, md.groupName AS demandGroupName,
            m.notifiedAt, m.brokerPhone
     FROM matches m
     LEFT JOIN supply s ON m.supplyId = s.id
     LEFT JOIN demand d ON m.demandId = d.id
     LEFT JOIN messages ms ON ms.id = s.messageId
     LEFT JOIN messages md ON md.id = d.messageId
     WHERE m.deletedAt IS NULL
     ORDER BY m.createdAt DESC, CAST(m.matchScore AS DECIMAL) DESC
     LIMIT ${limit}`
  );
  return rows as any[];
}

export async function getHighConfidenceMatches(minScore: number = 85, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  // Use raw SQL to join messages for original text (Drizzle doesn't support aliased joins easily)
  // NOTE: $client is a non-promise Pool; must use .promise() wrapper
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT m.id, m.supplyId, m.demandId, m.matchScore, m.locationScore, m.priceScore, m.specsScore,
            m.supplyContactPhone, m.supplyContactName, m.demandContactPhone, m.demandContactName,
            m.status, m.matchSummary, m.matchExplanation, m.createdAt,
            s.location AS supplyLocation, s.area AS supplyArea, s.city AS supplyCity,
            s.propertyType AS supplyPropertyType, s.price AS supplyPrice,
            s.bedrooms AS supplyBedrooms, s.size AS supplySize, s.purpose AS supplyPurpose,
            s.contact AS supplyPhone, s.contactName AS supplyName, s.messageId AS supplyMessageId,
            d.location AS demandLocation, d.area AS demandArea, d.city AS demandCity,
            d.propertyType AS demandPropertyType, d.priceMax AS demandPriceMax,
            d.bedrooms AS demandBedrooms, d.purpose AS demandPurpose,
            d.contact AS demandPhone, d.contactName AS demandName, d.messageId AS demandMessageId,
            ms.messageText AS supplyOriginalMessage, ms.groupName AS supplyGroupName,
            md.messageText AS demandOriginalMessage, md.groupName AS demandGroupName
     FROM matches m
     LEFT JOIN supply s ON m.supplyId = s.id
     LEFT JOIN demand d ON m.demandId = d.id
     LEFT JOIN messages ms ON ms.id = s.messageId
     LEFT JOIN messages md ON md.id = d.messageId
     WHERE CAST(m.matchScore AS DECIMAL) >= ${minScore} AND m.deletedAt IS NULL
     ORDER BY CAST(m.matchScore AS DECIMAL) DESC
     LIMIT ${limit}`
  );
  return rows as any[];
}

export async function getUnnotifiedHighMatches(minScore: number = 85) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(matches)
    .where(and(
      gte(matches.matchScore, minScore.toString()),
      eq(matches.notified, 0)
    ))
    .orderBy(desc(matches.matchScore));
}

export async function markMatchNotified(id: number, brokerPhone?: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(matches).set({
    notified: 1,
    notifiedAt: new Date(),
    ...(brokerPhone ? { brokerPhone } : {})
  }).where(eq(matches.id, id));
}

export async function updateMatchStatus(id: number, status: 'new' | 'viewed' | 'contacted' | 'viewing_scheduled' | 'negotiating' | 'closed') {
  const db = await getDb();
  if (!db) return;
  
  await db.update(matches).set({ status }).where(eq(matches.id, id));
}

export async function updateMatchNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(matches).set({ notes }).where(eq(matches.id, id));
}

export async function getMatchWithDetails(matchId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const matchResult = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (matchResult.length === 0) return null;
  
  const match = matchResult[0];
  const supplyResult = match.supplyId ? await db.select().from(supply).where(eq(supply.id, match.supplyId)).limit(1) : [];
  const demandResult = match.demandId ? await db.select().from(demand).where(eq(demand.id, match.demandId)).limit(1) : [];
  
  // Get original messages
  let supplyMessage: string | null = null;
  let demandMessage: string | null = null;
  
  if (supplyResult[0]?.messageId) {
    const msgResult = await db.select().from(messages).where(eq(messages.id, Number(supplyResult[0].messageId))).limit(1);
    supplyMessage = msgResult[0]?.messageText || null;
  }
  
  if (demandResult[0]?.messageId) {
    const msgResult = await db.select().from(messages).where(eq(messages.id, Number(demandResult[0].messageId))).limit(1);
    demandMessage = msgResult[0]?.messageText || null;
  }
  
  return {
    match,
    supply: supplyResult[0] || null,
    demand: demandResult[0] || null,
    supplyMessage,
    demandMessage
  };
}

// ============ WHATSAPP GROUP QUERIES ============
export async function upsertWhatsappGroup(group: InsertWhatsappGroup) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(whatsappGroups).values(group).onDuplicateKeyUpdate({
    set: {
      groupName: group.groupName,
      lastMessageAt: new Date()
    }
  });
}

export async function incrementGroupCounts(chatId: string, type: 'supply' | 'demand' | 'message') {
  const db = await getDb();
  if (!db) return;
  
  if (type === 'supply') {
    await db.update(whatsappGroups)
      .set({ 
        supplyCount: sql`${whatsappGroups.supplyCount} + 1`,
        messageCount: sql`${whatsappGroups.messageCount} + 1`,
        lastMessageAt: new Date()
      })
      .where(eq(whatsappGroups.chatId, chatId));
  } else if (type === 'demand') {
    await db.update(whatsappGroups)
      .set({ 
        demandCount: sql`${whatsappGroups.demandCount} + 1`,
        messageCount: sql`${whatsappGroups.messageCount} + 1`,
        lastMessageAt: new Date()
      })
      .where(eq(whatsappGroups.chatId, chatId));
  } else {
    await db.update(whatsappGroups)
      .set({ 
        messageCount: sql`${whatsappGroups.messageCount} + 1`,
        lastMessageAt: new Date()
      })
      .where(eq(whatsappGroups.chatId, chatId));
  }
}

export async function getActiveGroups() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(whatsappGroups)
    .where(eq(whatsappGroups.isActive, 1))
    .orderBy(desc(whatsappGroups.messageCount));
}

// ============ NOTIFICATION QUERIES ============
export async function insertNotification(n: InsertNotification): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(notifications).values(n);
  return result[0].insertId;
}

export async function getUnreadNotifications(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(notifications)
    .where(eq(notifications.isRead, 0))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  if (!db) return;
  
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.isRead, 0));
}

export async function getUnreadNotificationCount() {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, 0));
  
  return result[0]?.count || 0;
}

// ============ STATISTICS QUERIES ============
export async function getDashboardStats(area?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const areaFilter = area ? sql`location LIKE ${'%' + area + '%'}` : undefined;
  
  const [supplyCount] = await db.select({ count: sql<number>`count(*)` }).from(supply).where(areaFilter ? sql`(matched = 0 OR matched IS NULL) AND ${areaFilter}` : sql`matched = 0 OR matched IS NULL`);
  const [demandCount] = await db.select({ count: sql<number>`count(*)` }).from(demand).where(areaFilter ? areaFilter : undefined);
  const [matchCount] = await db.select({ count: sql<number>`count(*)` }).from(matches).where(sql`deletedAt IS NULL`);
  const [highMatchCount] = await db.select({ count: sql<number>`count(*)` }).from(matches).where(sql`deletedAt IS NULL AND CAST(matchScore AS DECIMAL) >= 85`);
  const [messageCount] = await db.select({ count: sql<number>`count(*)` }).from(messages);
  const [todayMessages] = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(gte(messages.createdAt, sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`));
  
  // Get latest message metadata
  const latestMsgRows = await db.select({
    createdAt: messages.createdAt,
    sender: messages.sender,
    senderName: messages.senderName,
    groupName: messages.groupName,
  }).from(messages).orderBy(desc(messages.createdAt)).limit(1);
  const latestMsg = latestMsgRows[0] ?? null;
  
  // Get latest match timestamp
  const latestMatchRows = await db.select({ createdAt: matches.createdAt })
    .from(matches).orderBy(desc(matches.createdAt)).limit(1);
  const latestMatch = latestMatchRows[0] ?? null;
  
  return {
    totalSupply: supplyCount?.count || 0,
    totalDemand: demandCount?.count || 0,
    totalMatches: matchCount?.count || 0,
    highConfidenceMatches: highMatchCount?.count || 0,
    totalMessages: messageCount?.count || 0,
    todayMessages: todayMessages?.count || 0,
    supplyDemandRatio: demandCount?.count ? (supplyCount?.count || 0) / demandCount.count : 0,
    lastMessageAt: latestMsg?.createdAt ?? null,
    lastMessageSender: latestMsg?.sender ?? null,
    lastMessageSenderName: latestMsg?.senderName ?? null,
    lastMessageGroup: latestMsg?.groupName ?? null,
    lastMatchAt: latestMatch?.createdAt ?? null,
  };
}

export async function getLocationStats() {
  const db = await getDb();
  if (!db) return [];
  
  const supplyLocs = await db.select({
    location: supply.location,
    count: sql<number>`count(*)`
  }).from(supply)
    .where(sql`${supply.location} IS NOT NULL`)
    .groupBy(supply.location)
    .orderBy(desc(sql`count(*)`))
    .limit(10);
  
  return supplyLocs;
}

export async function getPropertyTypeStats() {
  const db = await getDb();
  if (!db) return { supply: [], demand: [] };
  
  const supplyTypes = await db.select({
    propertyType: supply.propertyType,
    count: sql<number>`count(*)`
  }).from(supply)
    .where(sql`${supply.propertyType} IS NOT NULL`)
    .groupBy(supply.propertyType);
  
  const demandTypes = await db.select({
    propertyType: demand.propertyType,
    count: sql<number>`count(*)`
  }).from(demand)
    .where(sql`${demand.propertyType} IS NOT NULL`)
    .groupBy(demand.propertyType);
  
  return { supply: supplyTypes, demand: demandTypes };
}

export async function getPriceStats() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    propertyType: supply.propertyType,
    avgPrice: sql<number>`AVG(${supply.price})`,
    minPrice: sql<number>`MIN(${supply.price})`,
    maxPrice: sql<number>`MAX(${supply.price})`,
    count: sql<number>`count(*)`
  }).from(supply)
    .where(sql`${supply.price} IS NOT NULL AND ${supply.propertyType} IS NOT NULL`)
    .groupBy(supply.propertyType);
}


// ============ BOOKMARK QUERIES ============
import { bookmarks, InsertBookmark, Bookmark, matchFeedback, InsertMatchFeedback, MatchFeedback, amenities, InsertAmenity, Amenity } from "../drizzle/schema";

export async function addBookmark(b: InsertBookmark): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(bookmarks).values(b);
  return result[0].insertId;
}

export async function removeBookmark(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(bookmarks).where(eq(bookmarks.id, id));
}

export async function getUserBookmarks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));
}

export async function getBookmarksWithDetails(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const userBookmarks = await getUserBookmarks(userId);
  const results = [];
  
  for (const bookmark of userBookmarks) {
    let supplyData = null;
    let demandData = null;
    
    if (bookmark.supplyId) {
      const s = await db.select().from(supply).where(eq(supply.id, bookmark.supplyId)).limit(1);
      supplyData = s[0] || null;
    }
    if (bookmark.demandId) {
      const d = await db.select().from(demand).where(eq(demand.id, bookmark.demandId)).limit(1);
      demandData = d[0] || null;
    }
    
    results.push({
      bookmark,
      supply: supplyData,
      demand: demandData
    });
  }
  
  return results;
}

export async function isBookmarked(userId: number, supplyId?: number, demandId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  let result;
  if (supplyId) {
    result = await db.select().from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.supplyId, supplyId)))
      .limit(1);
  } else if (demandId) {
    result = await db.select().from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.demandId, demandId)))
      .limit(1);
  }
  
  return !!(result && result.length > 0);
}

// ============ MATCH FEEDBACK QUERIES ============
export async function addMatchFeedback(f: InsertMatchFeedback): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(matchFeedback).values(f);
  return result[0].insertId;
}

export async function getMatchFeedback(matchId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(matchFeedback)
    .where(eq(matchFeedback.matchId, matchId))
    .orderBy(desc(matchFeedback.createdAt));
}

export async function getAverageMatchRating(matchId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    avgRating: sql<number>`AVG(${matchFeedback.rating})`
  }).from(matchFeedback)
    .where(eq(matchFeedback.matchId, matchId));
  
  return result[0]?.avgRating || null;
}

export async function getUserFeedbackForMatch(matchId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(matchFeedback)
    .where(and(
      eq(matchFeedback.matchId, matchId),
      eq(matchFeedback.userId, userId)
    ))
    .limit(1);
  
  return result[0] || null;
}

// ============ AMENITY QUERIES ============
export async function insertAmenities(a: InsertAmenity): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(amenities).values(a);
  return result[0].insertId;
}

export async function getSupplyAmenities(supplyId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(amenities)
    .where(eq(amenities.supplyId, supplyId))
    .limit(1);
  
  return result[0] || null;
}

export async function getDemandAmenities(demandId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(amenities)
    .where(eq(amenities.demandId, demandId))
    .limit(1);
  
  return result[0] || null;
}

export async function getSupplyWithAmenityFilters(filters: {
  hasPool?: boolean;
  hasBalcony?: boolean;
  hasGarden?: boolean;
  hasParking?: boolean;
  hasElevator?: boolean;
  hasSecurity?: boolean;
  hasGym?: boolean;
  hasFurnished?: boolean;
  hasAC?: boolean;
}, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters.hasPool) conditions.push(eq(amenities.hasPool, 1));
  if (filters.hasBalcony) conditions.push(eq(amenities.hasBalcony, 1));
  if (filters.hasGarden) conditions.push(eq(amenities.hasGarden, 1));
  if (filters.hasParking) conditions.push(eq(amenities.hasParking, 1));
  if (filters.hasElevator) conditions.push(eq(amenities.hasElevator, 1));
  if (filters.hasSecurity) conditions.push(eq(amenities.hasSecurity, 1));
  if (filters.hasGym) conditions.push(eq(amenities.hasGym, 1));
  if (filters.hasFurnished) conditions.push(eq(amenities.hasFurnished, 1));
  if (filters.hasAC) conditions.push(eq(amenities.hasAC, 1));
  
  if (conditions.length === 0) {
    return db.select().from(supply).orderBy(desc(supply.createdAt)).limit(limit);
  }
  
  // Join supply with amenities and filter
  const result = await db.select({
    supply: supply,
    amenities: amenities
  })
    .from(supply)
    .innerJoin(amenities, eq(supply.id, amenities.supplyId))
    .where(and(...conditions))
    .orderBy(desc(supply.createdAt))
    .limit(limit);
  
  return result.map(r => ({ ...r.supply, amenities: r.amenities }));
}


// ============ NOTIFICATION PREFERENCES QUERIES ============
import { notificationPreferences, InsertNotificationPreference, authorizedAdmins, marketIntelligence, InsertMarketIntelligence, investorSubscriptions, InsertInvestorSubscription } from "../drizzle/schema";

export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  
  return result[0] || null;
}

export async function upsertNotificationPreferences(prefs: InsertNotificationPreference) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(notificationPreferences).values(prefs).onDuplicateKeyUpdate({
    set: {
      emailEnabled: prefs.emailEnabled,
      emailAddress: prefs.emailAddress,
      whatsappEnabled: prefs.whatsappEnabled,
      whatsappNumber: prefs.whatsappNumber,
      highMatchThreshold: prefs.highMatchThreshold,
      notifyNewSupply: prefs.notifyNewSupply,
      notifyNewDemand: prefs.notifyNewDemand,
      notifyHighMatch: prefs.notifyHighMatch,
    }
  });
}

// ============ AUTHORIZED ADMIN QUERIES ============
export async function isAuthorizedAdmin(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select().from(authorizedAdmins)
    .where(and(
      eq(authorizedAdmins.email, email),
      eq(authorizedAdmins.isActive, 1)
    ))
    .limit(1);
  
  return result.length > 0;
}

export async function getAuthorizedAdmins() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(authorizedAdmins)
    .where(eq(authorizedAdmins.isActive, 1));
}

export async function addAuthorizedAdmin(data: { email: string; name?: string; phone?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(authorizedAdmins).values({
    email: data.email,
    name: data.name ?? null,
    phone: data.phone ?? null,
    isActive: 1,
  });
  return result[0].insertId;
}

export async function deactivateAuthorizedAdmin(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(authorizedAdmins).set({ isActive: 0 }).where(eq(authorizedAdmins.id, id));
}

export async function reactivateAuthorizedAdmin(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(authorizedAdmins).set({ isActive: 1 }).where(eq(authorizedAdmins.id, id));
}

export async function getAllAuthorizedAdmins() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(authorizedAdmins).orderBy(desc(authorizedAdmins.createdAt));
}

export async function getAdminEmails(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  const admins = await db.select({ email: authorizedAdmins.email })
    .from(authorizedAdmins)
    .where(eq(authorizedAdmins.isActive, 1));
  
  return admins.map(a => a.email);
}

// ============ MARKET INTELLIGENCE QUERIES ============
export async function getMarketIntelligence(city?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (city) {
    return db.select().from(marketIntelligence)
      .where(eq(marketIntelligence.city, city))
      .orderBy(desc(marketIntelligence.hotScore));
  }
  
  return db.select().from(marketIntelligence)
    .orderBy(desc(marketIntelligence.hotScore));
}

export async function upsertMarketIntelligence(data: InsertMarketIntelligence) {
  const db = await getDb();
  if (!db) return;
  
  // Check if location exists
  const existing = await db.select().from(marketIntelligence)
    .where(and(
      eq(marketIntelligence.location, data.location),
      eq(marketIntelligence.city, data.city || 'Cairo')
    ))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(marketIntelligence)
      .set({
        supplyCount: data.supplyCount,
        demandCount: data.demandCount,
        avgSupplyPrice: data.avgSupplyPrice,
        avgDemandPriceMin: data.avgDemandPriceMin,
        avgDemandPriceMax: data.avgDemandPriceMax,
        supplyDemandRatio: data.supplyDemandRatio,
        hotScore: data.hotScore,
        propertyTypes: data.propertyTypes,
      })
      .where(eq(marketIntelligence.id, existing[0].id));
  } else {
    await db.insert(marketIntelligence).values(data);
  }
}

export async function refreshMarketIntelligence() {
  const db = await getDb();
  if (!db) return;
  
  // Get aggregated supply data by location
  const supplyByLocation = await db.select({
    location: supply.location,
    city: supply.city,
    count: sql<number>`count(*)`,
    avgPrice: sql<number>`AVG(${supply.price})`,
    propertyTypes: sql<string>`GROUP_CONCAT(DISTINCT ${supply.propertyType})`
  }).from(supply)
    .where(sql`${supply.location} IS NOT NULL`)
    .groupBy(supply.location, supply.city);
  
  // Get aggregated demand data by location
  const demandByLocation = await db.select({
    location: demand.location,
    city: demand.city,
    count: sql<number>`count(*)`,
    avgPriceMin: sql<number>`AVG(${demand.priceMin})`,
    avgPriceMax: sql<number>`AVG(${demand.priceMax})`
  }).from(demand)
    .where(sql`${demand.location} IS NOT NULL`)
    .groupBy(demand.location, demand.city);
  
  // Create a map of demand by location
  const demandMap = new Map<string, { count: number; avgPriceMin: number; avgPriceMax: number }>();
  for (const d of demandByLocation) {
    if (d.location) {
      demandMap.set(`${d.location}-${d.city || 'Cairo'}`, {
        count: d.count,
        avgPriceMin: d.avgPriceMin,
        avgPriceMax: d.avgPriceMax
      });
    }
  }
  
  // Update market intelligence for each location
  for (const s of supplyByLocation) {
    if (!s.location) continue;
    
    const key = `${s.location}-${s.city || 'Cairo'}`;
    const demandData = demandMap.get(key) || { count: 0, avgPriceMin: 0, avgPriceMax: 0 };
    
    const supplyCount = s.count || 0;
    const demandCount = demandData.count || 0;
    const ratio = demandCount > 0 ? supplyCount / demandCount : supplyCount;
    
    // Calculate hot score (0-100) based on activity
    const totalActivity = supplyCount + demandCount;
    const hotScore = Math.min(100, Math.round(totalActivity * 5));
    
    await upsertMarketIntelligence({
      location: s.location,
      city: s.city || 'Cairo',
      supplyCount,
      demandCount,
      avgSupplyPrice: s.avgPrice?.toString(),
      avgDemandPriceMin: demandData.avgPriceMin?.toString(),
      avgDemandPriceMax: demandData.avgPriceMax?.toString(),
      supplyDemandRatio: ratio.toFixed(2),
      hotScore,
      propertyTypes: s.propertyTypes ? { types: s.propertyTypes.split(',') } : null,
    });
  }
  
  // Also add demand-only locations
  for (const d of demandByLocation) {
    if (!d.location) continue;
    
    const key = `${d.location}-${d.city || 'Cairo'}`;
    const existing = supplyByLocation.find(s => `${s.location}-${s.city || 'Cairo'}` === key);
    
    if (!existing) {
      const hotScore = Math.min(100, Math.round(d.count * 5));
      
      await upsertMarketIntelligence({
        location: d.location,
        city: d.city || 'Cairo',
        supplyCount: 0,
        demandCount: d.count,
        avgDemandPriceMin: d.avgPriceMin?.toString(),
        avgDemandPriceMax: d.avgPriceMax?.toString(),
        supplyDemandRatio: '0',
        hotScore,
      });
    }
  }
}

export async function getMarketHeatmap() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    location: marketIntelligence.location,
    city: marketIntelligence.city,
    supplyCount: marketIntelligence.supplyCount,
    demandCount: marketIntelligence.demandCount,
    hotScore: marketIntelligence.hotScore,
    supplyDemandRatio: marketIntelligence.supplyDemandRatio,
    avgSupplyPrice: marketIntelligence.avgSupplyPrice,
  }).from(marketIntelligence)
    .orderBy(desc(marketIntelligence.hotScore))
    .limit(50);
}

// ============ INVESTOR SUBSCRIPTION QUERIES ============
export async function getInvestorSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(investorSubscriptions)
    .where(eq(investorSubscriptions.userId, userId))
    .limit(1);
  
  return result[0] || null;
}

export async function hasMarketIntelligenceAccess(userId: number, userEmail?: string): Promise<boolean> {
  // Admins always have access
  if (userEmail) {
    const isAdmin = await isAuthorizedAdmin(userEmail);
    if (isAdmin) return true;
  }
  
  // Check subscription
  const subscription = await getInvestorSubscription(userId);
  if (!subscription) return false;
  
  return subscription.isActive === 1 && subscription.accessLevel !== 'none';
}


// ============ USER PROFILE QUERIES ============
export async function upsertUserProfile(profile: InsertUserProfile): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(userProfiles).values(profile).onDuplicateKeyUpdate({
      set: {
        phoneNumber: profile.phoneNumber,
        whatsappNumber: profile.whatsappNumber,
        userType: profile.userType,
        propertyType: profile.propertyType,
        location: profile.location,
        area: profile.area,
        city: profile.city,
        priceMin: profile.priceMin,
        priceMax: profile.priceMax,
        sizeMin: profile.sizeMin,
        sizeMax: profile.sizeMax,
        bedrooms: profile.bedrooms,
        bathrooms: profile.bathrooms,
        purpose: profile.purpose,
        requirements: profile.requirements,
        notifyOnMatch: profile.notifyOnMatch,
        notifyViaWhatsapp: profile.notifyViaWhatsapp,
        notifyViaEmail: profile.notifyViaEmail,
        updatedAt: new Date(),
      },
    });
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to upsert user profile:", error);
    return null;
  }
}

export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get user profile:", error);
    return null;
  }
}

// ============ CUSTOM NOTIFICATION QUERIES ============
export async function createCustomNotification(notification: InsertCustomNotification): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(customNotifications).values(notification);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create custom notification:", error);
    return null;
  }
}

export async function getUserNotifications(userId: number, limit: number = 50): Promise<CustomNotification[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(customNotifications)
      .where(eq(customNotifications.userId, userId))
      .orderBy(desc(customNotifications.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get user notifications:", error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db
      .update(customNotifications)
      .set({ isRead: 1, readAt: new Date() })
      .where(eq(customNotifications.id, notificationId));
  } catch (error) {
    console.error("[Database] Failed to mark notification as read:", error);
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db
      .update(customNotifications)
      .set({ isRead: 1, readAt: new Date() })
      .where(and(eq(customNotifications.userId, userId), eq(customNotifications.isRead, 0)));
  } catch (error) {
    console.error("[Database] Failed to mark all notifications as read:", error);
  }
}

export async function getUserUnreadNotificationCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  try {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(customNotifications)
      .where(and(eq(customNotifications.userId, userId), eq(customNotifications.isRead, 0)));
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Failed to get unread notification count:", error);
    return 0;
  }
}

// ============ USER ONBOARDING QUERIES ============
export async function createUserOnboarding(onboarding: InsertUserOnboarding): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(userOnboarding).values(onboarding);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create user onboarding:", error);
    return null;
  }
}

export async function getUserOnboardingByToken(token: string): Promise<UserOnboarding | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.invitationToken, token))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get user onboarding by token:", error);
    return null;
  }
}

export async function completeUserOnboarding(onboardingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db
      .update(userOnboarding)
      .set({ isCompleted: 1, completedAt: new Date() })
      .where(eq(userOnboarding.id, onboardingId));
  } catch (error) {
    console.error("[Database] Failed to complete user onboarding:", error);
  }
}


// ============ CONTACT VALIDATION QUERIES ============
/**
 * Verify if supply has complete contact information
 */
export async function verifySupplyContact(supplyId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db
      .select()
      .from(supply)
      .where(eq(supply.id, supplyId))
      .limit(1);
    
    if (result.length === 0) return false;
    
    const item = result[0];
    // Contact must have both name and phone
    const hasValidContact = !!(item.contactName && item.contactName.trim().length > 0 && 
                           item.contact && item.contact.trim().length > 0);
    
    if (hasValidContact) {
      // Mark as verified
      await db
        .update(supply)
        .set({ contactVerified: 1, verifiedAt: new Date() })
        .where(eq(supply.id, supplyId));
    }
    
    return hasValidContact;
  } catch (error) {
    console.error("[Database] Failed to verify supply contact:", error);
    return false;
  }
}

/**
 * Verify if demand has complete contact information
 */
export async function verifyDemandContact(demandId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db
      .select()
      .from(demand)
      .where(eq(demand.id, demandId))
      .limit(1);
    
    if (result.length === 0) return false;
    
    const item = result[0];
    // Contact must have both name and phone
    const hasValidContact = !!(item.contactName && item.contactName.trim().length > 0 && 
                           item.contact && item.contact.trim().length > 0);
    
    if (hasValidContact) {
      // Mark as verified
      await db
        .update(demand)
        .set({ contactVerified: 1, verifiedAt: new Date() })
        .where(eq(demand.id, demandId));
    }
    
    return hasValidContact;
  } catch (error) {
    console.error("[Database] Failed to verify demand contact:", error);
    return false;
  }
}

/**
 * Qualify a match - both contacts must be verified
 */
export async function qualifyMatch(matchId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  try {
    const result = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    
    if (result.length === 0) return false;
    
    const match = result[0];
    
    // Verify both supply and demand contacts
    const supplyVerified = match.supplyId ? await verifySupplyContact(match.supplyId) : false;
    const demandVerified = match.demandId ? await verifyDemandContact(match.demandId) : false;
    
    const isQualified = supplyVerified && demandVerified;
    
    // Update match qualification status
    await db
      .update(matches)
      .set({ 
        qualificationStatus: isQualified ? "qualified" : "rejected",
        contactsVerified: isQualified ? 1 : 0
      })
      .where(eq(matches.id, matchId));
    
    return isQualified;
  } catch (error) {
    console.error("[Database] Failed to qualify match:", error);
    return false;
  }
}

/**
 * Get only qualified matches (both contacts verified)
 */
export async function getQualifiedMatches(limit: number = 50): Promise<Match[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(matches)
      .where(eq(matches.qualificationStatus, "qualified"))
      .orderBy(desc(matches.matchScore))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get qualified matches:", error);
    return [];
  }
}

// ============ BROKER ANALYTICS QUERIES ============
/**
 * Track or update broker activity
 */
export async function upsertBrokerAnalytics(brokerPhone: string, brokerName?: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const existing = await db
      .select()
      .from(brokerAnalytics)
      .where(eq(brokerAnalytics.brokerPhone, brokerPhone))
      .limit(1);
    
    if (existing.length > 0) {
      // Update last active
      await db
        .update(brokerAnalytics)
        .set({ lastActiveAt: new Date() })
        .where(eq(brokerAnalytics.brokerPhone, brokerPhone));
      return existing[0].id;
    } else {
      // Create new broker record
      const result = await db.insert(brokerAnalytics).values({
        brokerPhone,
        brokerName,
        lastActiveAt: new Date(),
      });
      return result[0].insertId;
    }
  } catch (error) {
    console.error("[Database] Failed to upsert broker analytics:", error);
    return null;
  }
}

/**
 * Increment broker message count
 */
export async function incrementBrokerMessageCount(brokerPhone: string, type: "supply" | "demand"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const field = type === "supply" ? brokerAnalytics.supplyCount : brokerAnalytics.demandCount;
    await db
      .update(brokerAnalytics)
      .set({ 
        [type === "supply" ? "supplyCount" : "demandCount"]: sql`${field} + 1`,
        lastActiveAt: new Date()
      })
      .where(eq(brokerAnalytics.brokerPhone, brokerPhone));
  } catch (error) {
    console.error("[Database] Failed to increment broker message count:", error);
  }
}

/**
 * Get broker analytics
 */
export async function getBrokerAnalytics(brokerPhone: string): Promise<BrokerAnalytics | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db
      .select()
      .from(brokerAnalytics)
      .where(eq(brokerAnalytics.brokerPhone, brokerPhone))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get broker analytics:", error);
    return null;
  }
}

/**
 * Get top brokers by successful matches
 */
export async function getTopBrokers(limit: number = 10): Promise<BrokerAnalytics[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(brokerAnalytics)
      .orderBy(desc(brokerAnalytics.successfulMatches))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get top brokers:", error);
    return [];
  }
}

// ============ GEO-MARKET INTELLIGENCE QUERIES ============
/**
 * Get or create geo-market data for location
 */
export async function upsertGeoMarketData(location: string, data: Partial<InsertGeoMarketData>): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const existing = await db
      .select()
      .from(geoMarketData)
      .where(eq(geoMarketData.location, location))
      .limit(1);
    
    if (existing.length > 0) {
      await db
        .update(geoMarketData)
        .set(data)
        .where(eq(geoMarketData.location, location));
      return existing[0].id;
    } else {
      const result = await db.insert(geoMarketData).values({
        location,
        ...data
      });
      return result[0].insertId;
    }
  } catch (error) {
    console.error("[Database] Failed to upsert geo-market data:", error);
    return null;
  }
}

/**
 * Get hot zones (high investment score locations)
 */
export async function getHotZones(limit: number = 20): Promise<GeoMarketData[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const result = await db
      .select()
      .from(geoMarketData)
      .where(eq(geoMarketData.marketTemperature, "hot"))
      .orderBy(desc(geoMarketData.investmentScore))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get hot zones:", error);
    return [];
  }
}

/**
 * Get market data for location
 */
export async function getMarketDataByLocation(location: string): Promise<GeoMarketData | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db
      .select()
      .from(geoMarketData)
      .where(eq(geoMarketData.location, location))
      .limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get market data by location:", error);
    return null;
  }
}


// ============ P0: SYSTEM HEALTH & WHATSAPP RELIABILITY ============

/**
 * Get or create system health record
 */
export async function getSystemHealth(): Promise<SystemHealth | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    let result = await db.select().from(systemHealth).limit(1);
    if (result.length === 0) {
      // Create default health record if doesn't exist
      await db.insert(systemHealth).values({
        whatsappStatus: "disconnected",
        databaseStatus: "ok",
        matchingEngineStatus: "ok",
        emailStatus: "ok",
        overallStatus: "healthy"
      });
      result = await db.select().from(systemHealth).limit(1);
    }

    const health = result.length > 0 ? { ...result[0] } as SystemHealth : null;
    if (!health) return null;

    // Always overlay with REAL timestamps from live tables so the widget never shows stale data
    try {
      // db.execute returns [rows, fields] — rows is result[0], first row is result[0][0]
      const msgResult = await db.execute(sql`SELECT MAX(createdAt) AS lastMsgAt FROM messages`) as any;
      const lastMsgAt = msgResult[0]?.[0]?.lastMsgAt;
      if (lastMsgAt) health.whatsappLastMessageAt = new Date(lastMsgAt);

      const matchResult = await db.execute(sql`SELECT MAX(createdAt) AS lastMatchAt FROM matches WHERE \`deletedAt\` IS NULL`) as any;
      const lastMatchAt = matchResult[0]?.[0]?.lastMatchAt;
      if (lastMatchAt) health.matchingEngineLastRunAt = new Date(lastMatchAt);
    } catch (overlayErr) {
      // Non-fatal: fall back to stored values
      console.warn("[SystemHealth] Could not overlay live timestamps:", overlayErr);
    }

    return health;
  } catch (error) {
    console.error("[Database] Failed to get system health:", error);
    return null;
  }
}

/**
 * Update WhatsApp status in system health
 */
export async function updateWhatsappHealth(status: "connected" | "disconnected" | "error", errorMessage?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const health = await getSystemHealth();
    if (!health) return;
    
    const updateData: any = {
      whatsappStatus: status,
      whatsappLastMessageAt: status === "connected" ? new Date() : health.whatsappLastMessageAt
    };
    
    if (status === "error" && errorMessage) {
      updateData.whatsappLastErrorAt = new Date();
      updateData.whatsappErrorMessage = errorMessage;
    }
    
    await db.update(systemHealth).set(updateData).where(eq(systemHealth.id, health.id));
  } catch (error) {
    console.error("[Database] Failed to update WhatsApp health:", error);
  }
}

/**
 * Record WhatsApp message received
 */
export async function recordWhatsappMessage(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const health = await getSystemHealth();
    if (!health) return;
    
    await db.update(systemHealth)
      .set({
        whatsappLastMessageAt: new Date(),
        whatsappMessageCount: (health.whatsappMessageCount || 0) + 1,
        whatsappStatus: "connected"
      })
      .where(eq(systemHealth.id, health.id));
  } catch (error) {
    console.error("[Database] Failed to record WhatsApp message:", error);
  }
}

/**
 * Record match generation
 */
export async function recordMatchGeneration(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const health = await getSystemHealth();
    if (!health) return;
    
    await db.update(systemHealth)
      .set({
        matchingEngineLastRunAt: new Date(),
        matchesGeneratedToday: (health.matchesGeneratedToday || 0) + 1,
        matchingEngineStatus: "ok"
      })
      .where(eq(systemHealth.id, health.id));
  } catch (error) {
    console.error("[Database] Failed to record match generation:", error);
  }
}

// ============ P1: AUDIT LOGS ============

/**
 * Create audit log entry
 */
export async function createAuditLog(log: InsertAuditLog): Promise<AuditLog | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(auditLogs).values(log);
    const created: any = await (db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(1) as any);
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create audit log:", error);
    return null;
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters: {
  entityType?: string;
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
} = {}): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    let query: any = db.select().from(auditLogs);
    const conditions = [];
    
    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType as any));
    }
    if (filters.userId) {
      conditions.push(eq(auditLogs.createdBy, filters.userId));
    }
    if (filters.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(gte(auditLogs.createdAt, filters.endDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(auditLogs.createdAt)).limit(filters.limit || 100);
    return await query;
  } catch (error) {
    console.error("[Database] Failed to get audit logs:", error);
    return [];
  }
}

// ============ P2: CONVERSION FUNNEL ============

/**
 * Create conversion funnel entry for a match
 */
export async function createConversionFunnel(funnel: InsertConversionFunnel): Promise<ConversionFunnel | null> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    await db.insert(conversionFunnel).values(funnel);
    const created = await (db.select().from(conversionFunnel).orderBy(desc(conversionFunnel.id)).limit(1) as any);
    return created.length > 0 ? created[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create conversion funnel:", error);
    return null;
  }
}

/**
 * Update conversion funnel stage
 */
export async function updateConversionStage(matchId: number, stage: string, timestamp: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const funnel = await db.select().from(conversionFunnel).where(eq(conversionFunnel.matchId, matchId)).limit(1);
    if (funnel.length === 0) return;
    
    const updateData: any = { currentStage: stage };
    
    if (stage === "replied") {
      updateData.firstReplyAt = timestamp;
      updateData.daysToFirstReply = Math.floor((timestamp.getTime() - funnel[0].matchGeneratedAt.getTime()) / (1000 * 60 * 60 * 24));
    } else if (stage === "viewing_scheduled") {
      updateData.viewingScheduledAt = timestamp;
      updateData.daysToViewing = Math.floor((timestamp.getTime() - funnel[0].matchGeneratedAt.getTime()) / (1000 * 60 * 60 * 24));
    } else if (stage === "deal_closed") {
      updateData.dealClosedAt = timestamp;
      updateData.daysToDeal = Math.floor((timestamp.getTime() - funnel[0].matchGeneratedAt.getTime()) / (1000 * 60 * 60 * 24));
    } else if (stage === "deal_lost") {
      updateData.dealLostAt = timestamp;
    }
    
    await db.update(conversionFunnel).set(updateData).where(eq(conversionFunnel.id, funnel[0].id));
  } catch (error) {
    console.error("[Database] Failed to update conversion stage:", error);
  }
}

/**
 * Get conversion funnel metrics
 */
export async function getConversionMetrics(period: "today" | "7days" | "30days" = "30days"): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const startDate = new Date();
    if (period === "today") startDate.setHours(0, 0, 0, 0);
    else if (period === "7days") startDate.setDate(startDate.getDate() - 7);
    else if (period === "30days") startDate.setDate(startDate.getDate() - 30);
    
    const funnels = await db.select().from(conversionFunnel).where(gte(conversionFunnel.matchGeneratedAt, startDate));
    
    const metrics = {
      generated: funnels.length,
      replied: funnels.filter(f => f.firstReplyAt).length,
      viewingScheduled: funnels.filter(f => f.viewingScheduledAt).length,
      dealClosed: funnels.filter(f => f.dealClosedAt).length,
      dealLost: funnels.filter(f => f.dealLostAt).length
    };
    
    return {
      ...metrics,
      replyRate: metrics.generated > 0 ? ((metrics.replied / metrics.generated) * 100).toFixed(2) : 0,
      viewingRate: metrics.replied > 0 ? ((metrics.viewingScheduled / metrics.replied) * 100).toFixed(2) : 0,
      closureRate: metrics.viewingScheduled > 0 ? ((metrics.dealClosed / metrics.viewingScheduled) * 100).toFixed(2) : 0,
      avgDaysToReply: funnels.filter(f => f.daysToFirstReply).reduce((sum, f) => sum + (f.daysToFirstReply || 0), 0) / Math.max(funnels.filter(f => f.daysToFirstReply).length, 1),
      avgDaysToViewing: funnels.filter(f => f.daysToViewing).reduce((sum, f) => sum + (f.daysToViewing || 0), 0) / Math.max(funnels.filter(f => f.daysToViewing).length, 1),
      avgDaysToDeal: funnels.filter(f => f.daysToDeal).reduce((sum, f) => sum + (f.daysToDeal || 0), 0) / Math.max(funnels.filter(f => f.daysToDeal).length, 1)
    };
  } catch (error) {
    console.error("[Database] Failed to get conversion metrics:", error);
    return null;
  }
}

// ============ P2: SEGMENTED ANALYTICS ============

/**
 * Upsert segmented analytics for an area/type/price combination
 */
export async function upsertSegmentedAnalytics(analytics: InsertSegmentedAnalytics): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    const existing = await db.select().from(segmentedAnalytics)
      .where(and(
        eq(segmentedAnalytics.area, analytics.area || ""),
        eq(segmentedAnalytics.propertyType, analytics.propertyType || ""),
        eq(segmentedAnalytics.priceBand, analytics.priceBand || "")
      ));
    
    if (existing.length > 0) {
      await db.update(segmentedAnalytics).set(analytics).where(eq(segmentedAnalytics.id, existing[0].id));
    } else {
      await db.insert(segmentedAnalytics).values(analytics);
    }
  } catch (error) {
    console.error("[Database] Failed to upsert segmented analytics:", error);
  }
}

/**
 * Get segmented analytics with filters
 */
export async function getSegmentedAnalytics(filters: {
  area?: string;
  propertyType?: string;
  priceBand?: string;
  period?: string;
  limit?: number;
} = {}): Promise<SegmentedAnalytics[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const conditions = [];
    
    if (filters.area) conditions.push(eq(segmentedAnalytics.area, filters.area));
    if (filters.propertyType) conditions.push(eq(segmentedAnalytics.propertyType, filters.propertyType));
    if (filters.priceBand) conditions.push(eq(segmentedAnalytics.priceBand, filters.priceBand));
    if (filters.period) conditions.push(eq(segmentedAnalytics.period, filters.period as any));
    
    let baseQuery: any = db.select().from(segmentedAnalytics);
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }
    
    const result = await baseQuery.orderBy(desc(segmentedAnalytics.updatedAt)).limit(filters.limit || 100);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get segmented analytics:", error);
    return [];
  }
}

/**
 * Get top opportunities (high demand, low supply)
 */
export async function getTopOpportunities(limit: number = 3): Promise<SegmentedAnalytics[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db.select().from(segmentedAnalytics)
      .where(eq(segmentedAnalytics.insightType, "opportunity"))
      .orderBy(desc(segmentedAnalytics.supplyDemandRatio))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get top opportunities:", error);
    return [];
  }
}

/**
 * Get oversupply areas
 */
export async function getOversupplyAreas(limit: number = 3): Promise<SegmentedAnalytics[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    return await db.select().from(segmentedAnalytics)
      .where(eq(segmentedAnalytics.insightType, "oversupply"))
      .orderBy(desc(segmentedAnalytics.supplyDemandRatio))
      .limit(limit);
  } catch (error) {
    console.error("[Database] Failed to get oversupply areas:", error);
    return [];
  }
}

// ============ ORGANIZATION QUERIES (Multi-Tenant) ============

import {
  organizations,
  Organization,
  InsertOrganization,
  whatsappMagicLinks,
  WhatsappMagicLink,
  InsertWhatsappMagicLink,
} from "../drizzle/schema";

/**
 * Create a new organization
 */
export async function createOrganization(org: InsertOrganization): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.insert(organizations).values(org);
    return result[0].insertId;
  } catch (error) {
    console.error("[Database] Failed to create organization:", error);
    return null;
  }
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(id: number): Promise<Organization | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get organization:", error);
    return null;
  }
}

/**
 * Get all organizations (admin only)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(organizations).orderBy(desc(organizations.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get organizations:", error);
    return [];
  }
}

/**
 * Update user's organization
 */
export async function setUserOrganization(userId: number, organizationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.update(users).set({ organizationId }).where(eq(users.id, userId));
  } catch (error) {
    console.error("[Database] Failed to set user organization:", error);
  }
}

/**
 * Get supply filtered by organization (multi-tenant)
 */
export async function getSupplyByOrg(organizationId: number | null, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId === null) {
    return db.select().from(supply).orderBy(desc(supply.createdAt)).limit(limit);
  }
  return db.select().from(supply)
    .where(eq(supply.organizationId, organizationId))
    .orderBy(desc(supply.createdAt))
    .limit(limit);
}

/**
 * Get demand filtered by organization (multi-tenant)
 */
export async function getDemandByOrg(organizationId: number | null, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId === null) {
    return db.select().from(demand).orderBy(desc(demand.createdAt)).limit(limit);
  }
  return db.select().from(demand)
    .where(eq(demand.organizationId, organizationId))
    .orderBy(desc(demand.createdAt))
    .limit(limit);
}

/**
 * Get matches filtered by organization (multi-tenant)
 */
export async function getMatchesByOrg(organizationId: number | null, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId === null) {
    return db.select().from(matches).orderBy(desc(matches.matchScore)).limit(limit);
  }
  return db.select().from(matches)
    .where(eq(matches.organizationId, organizationId))
    .orderBy(desc(matches.matchScore))
    .limit(limit);
}

/**
 * Get dashboard stats filtered by organization (multi-tenant)
 */
export async function getDashboardStatsByOrg(organizationId: number | null) {
  const db = await getDb();
  if (!db) return null;

  const orgFilter = organizationId !== null;

  const [supplyCount] = await db.select({ count: sql<number>`count(*)` }).from(supply)
    .where(orgFilter ? and(eq(supply.organizationId, organizationId!), sql`(matched = 0 OR matched IS NULL)`) : sql`matched = 0 OR matched IS NULL`);
  const [demandCount] = await db.select({ count: sql<number>`count(*)` }).from(demand)
    .where(orgFilter ? eq(demand.organizationId, organizationId!) : sql`1=1`);
  const [matchCount] = await db.select({ count: sql<number>`count(*)` }).from(matches)
    .where(orgFilter ? and(eq(matches.organizationId, organizationId!), sql`deletedAt IS NULL`) : sql`deletedAt IS NULL`);
  const [highMatchCount] = await db.select({ count: sql<number>`count(*)` }).from(matches)
    .where(orgFilter
      ? and(eq(matches.organizationId, organizationId!), sql`deletedAt IS NULL AND CAST(matchScore AS DECIMAL) >= 85`)
      : sql`deletedAt IS NULL AND CAST(matchScore AS DECIMAL) >= 85`);
  const [messageCount] = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(orgFilter ? eq(messages.organizationId, organizationId!) : sql`1=1`);
  const [todayMessages] = await db.select({ count: sql<number>`count(*)` }).from(messages)
    .where(orgFilter
      ? and(eq(messages.organizationId, organizationId!), gte(messages.createdAt, sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`))
      : gte(messages.createdAt, sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`));

  return {
    totalSupply: supplyCount?.count || 0,
    totalDemand: demandCount?.count || 0,
    totalMatches: matchCount?.count || 0,
    highConfidenceMatches: highMatchCount?.count || 0,
    totalMessages: messageCount?.count || 0,
    todayMessages: todayMessages?.count || 0,
    supplyDemandRatio: demandCount?.count ? (supplyCount?.count || 0) / demandCount.count : 0
  };
}

/**
 * Get WhatsApp magic link by token
 */
export async function getMagicLinkByToken(token: string): Promise<WhatsappMagicLink | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(whatsappMagicLinks)
      .where(eq(whatsappMagicLinks.token, token))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get magic link:", error);
    return null;
  }
}

// ============ LIVE MAP PIN QUERIES ============

/**
 * Returns up to 500 active supply listings with location data for the live market map.
 * Joins to messages to get groupName. Only returns unmatched listings with a location.
 */
export async function getLiveSupplyPins() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: supply.id,
    location: supply.location,
    price: supply.price,
    bedrooms: supply.bedrooms,
    propertyType: supply.propertyType,
    purpose: supply.purpose,
    contactName: supply.contactName,
    contact: supply.contact,
    groupName: messages.groupName,
    createdAt: supply.createdAt,
  })
  .from(supply)
  .leftJoin(messages, eq(supply.messageId, messages.id))
  .orderBy(desc(supply.createdAt))
  .limit(2000);
  return rows.filter(r => r.location);
}

/**
 * Returns up to 2000 demand requests with location data for the live market map.
 * Joins to messages to get groupName. Shows ALL demand (not just unmatched).
 */
export async function getLiveDemandPins() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: demand.id,
    location: demand.location,
    budget: demand.priceMax,
    bedrooms: demand.bedrooms,
    propertyType: demand.propertyType,
    purpose: demand.purpose,
    contactName: demand.contactName,
    contact: demand.contact,
    groupName: messages.groupName,
    createdAt: demand.createdAt,
  })
  .from(demand)
  .leftJoin(messages, eq(demand.messageId, messages.id))
  .orderBy(desc(demand.createdAt))
  .limit(2000);
  return rows.filter(r => r.location);
}

/**
 * Returns live aggregated supply/demand counts per location for the heatmap.
 * Queries directly from supply + demand tables — always reflects current DB state.
 */
export async function getLiveHeatmapData(): Promise<Array<{
  location: string;
  supplyCount: number;
  demandCount: number;
  hotScore: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  // Aggregate supply counts per location
  const supplyRows = await db
    .select({ location: supply.location, cnt: sql<number>`COUNT(*)` })
    .from(supply)
    .where(isNotNull(supply.location))
    .groupBy(supply.location);

  // Aggregate demand counts per location
  const demandRows = await db
    .select({ location: demand.location, cnt: sql<number>`COUNT(*)` })
    .from(demand)
    .where(isNotNull(demand.location))
    .groupBy(demand.location);

  // Merge into a single map
  const locationMap: Record<string, { supplyCount: number; demandCount: number }> = {};
  for (const row of supplyRows) {
    if (!row.location) continue;
    if (!locationMap[row.location]) locationMap[row.location] = { supplyCount: 0, demandCount: 0 };
    locationMap[row.location].supplyCount += Number(row.cnt);
  }
  for (const row of demandRows) {
    if (!row.location) continue;
    if (!locationMap[row.location]) locationMap[row.location] = { supplyCount: 0, demandCount: 0 };
    locationMap[row.location].demandCount += Number(row.cnt);
  }

  return Object.entries(locationMap)
    .map(([location, counts]) => {
      const total = counts.supplyCount + counts.demandCount;
      const hotScore = Math.min(100, Math.round((total / 20) * 100));
      return { location, ...counts, hotScore };
    })
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 100);
}

/**
 * Deduplicate existing matches by phone pair.
 * For each (supplyContactPhone, demandContactPhone) pair, keep the row with
 * the highest matchScore and soft-delete all others (set deletedAt = NOW()).
 * Returns { kept, removed, totalBefore } counts.
 */
export async function deduplicateExistingMatches(): Promise<{ kept: number; removed: number; totalBefore: number }> {
  const db = await getDb();
  if (!db) return { kept: 0, removed: 0, totalBefore: 0 };

  // Step 1: Count total before
  const [[countRow]] = await (db as any).$client.promise().execute(
    `SELECT COUNT(*) AS cnt FROM matches WHERE deletedAt IS NULL`
  ) as any[];
  const totalBefore = Number(countRow?.cnt ?? 0);

  // Step 2: Get all non-deleted matches ordered by score desc
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT id, supplyContactPhone, demandContactPhone, CAST(matchScore AS DECIMAL(5,2)) AS score
     FROM matches
     WHERE deletedAt IS NULL
     ORDER BY supplyContactPhone, demandContactPhone, CAST(matchScore AS DECIMAL(5,2)) DESC`
  ) as any[];

  // Step 3: Group by phone pair, keep highest score (first row per pair)
  const pairMap = new Map<string, { keepId: number; duplicateIds: number[] }>();
  for (const row of rows as any[]) {
    const key = `${row.supplyContactPhone || ''}||${row.demandContactPhone || ''}`;
    if (!pairMap.has(key)) {
      pairMap.set(key, { keepId: row.id, duplicateIds: [] });
    } else {
      pairMap.get(key)!.duplicateIds.push(row.id);
    }
  }

  // Step 4: Collect all IDs to soft-delete
  const toDelete: number[] = [];
  for (const { duplicateIds } of Array.from(pairMap.values())) {
    toDelete.push(...duplicateIds);
  }

  if (toDelete.length === 0) {
    return { kept: pairMap.size, removed: 0, totalBefore };
  }

  // Step 5: Soft-delete duplicates in batches of 500
  const batchSize = 500;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(',');
    await (db as any).$client.promise().execute(
      `UPDATE matches SET deletedAt = NOW() WHERE id IN (${placeholders})`,
      batch
    );
  }

  console.log(`[Dedup] Complete: ${pairMap.size} unique pairs kept, ${toDelete.length} duplicates removed from ${totalBefore} total`);
  return { kept: pairMap.size, removed: toDelete.length, totalBefore };
}

// ============ REVIEW WORKFLOW QUERIES ============

/**
 * Get supply records pending review (low confidence or missing contact)
 */
export async function getPendingReviewSupply(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT s.*, m.messageText as originalMessage
     FROM supply s
     LEFT JOIN messages m ON s.messageId = m.id
     WHERE s.reviewStatus = 'pending_review'
     ORDER BY s.createdAt DESC
     LIMIT ?`,
    [limit]
  ) as any[];
  return rows || [];
}

/**
 * Get demand records pending review
 */
export async function getPendingReviewDemand(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT d.*, m.messageText as originalMessage
     FROM demand d
     LEFT JOIN messages m ON d.messageId = m.id
     WHERE d.reviewStatus = 'pending_review'
     ORDER BY d.createdAt DESC
     LIMIT ?`,
    [limit]
  ) as any[];
  return rows || [];
}

/**
 * Approve a pending supply record
 */
export async function approveSupplyRecord(id: number, reviewedBy: string) {
  const db = await getDb();
  if (!db) return false;
  await (db as any).$client.promise().execute(
    `UPDATE supply SET reviewStatus = 'approved', reviewedAt = NOW(), reviewedBy = ? WHERE id = ?`,
    [reviewedBy, id]
  );
  return true;
}

/**
 * Reject a pending supply record
 */
export async function rejectSupplyRecord(id: number, reviewedBy: string) {
  const db = await getDb();
  if (!db) return false;
  await (db as any).$client.promise().execute(
    `UPDATE supply SET reviewStatus = 'rejected', reviewedAt = NOW(), reviewedBy = ? WHERE id = ?`,
    [reviewedBy, id]
  );
  return true;
}

/**
 * Approve a pending demand record
 */
export async function approveDemandRecord(id: number, reviewedBy: string) {
  const db = await getDb();
  if (!db) return false;
  await (db as any).$client.promise().execute(
    `UPDATE demand SET reviewStatus = 'approved', reviewedAt = NOW(), reviewedBy = ? WHERE id = ?`,
    [reviewedBy, id]
  );
  return true;
}

/**
 * Reject a pending demand record
 */
export async function rejectDemandRecord(id: number, reviewedBy: string) {
  const db = await getDb();
  if (!db) return false;
  await (db as any).$client.promise().execute(
    `UPDATE demand SET reviewStatus = 'rejected', reviewedAt = NOW(), reviewedBy = ? WHERE id = ?`,
    [reviewedBy, id]
  );
  return true;
}

/**
 * Get count of pending review items
 */
export async function getPendingReviewCount() {
  const db = await getDb();
  if (!db) return { supply: 0, demand: 0, total: 0 };
  const [sRows] = await (db as any).$client.promise().execute(
    `SELECT COUNT(*) as cnt FROM supply WHERE reviewStatus = 'pending_review'`
  ) as any[];
  const [dRows] = await (db as any).$client.promise().execute(
    `SELECT COUNT(*) as cnt FROM demand WHERE reviewStatus = 'pending_review'`
  ) as any[];
  const s = Number(sRows?.[0]?.cnt || 0);
  const d = Number(dRows?.[0]?.cnt || 0);
  return { supply: s, demand: d, total: s + d };
}

/**
 * Get supply with advanced filters for Properties page
 */
export async function getFilteredSupply(filters: {
  propertyType?: string;
  location?: string;
  purpose?: string;
  priority?: string;
  reviewStatus?: string;
  minConfidence?: number;
  maxConfidence?: number;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  sourceGroup?: string;
  matched?: boolean;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  
  if (filters.propertyType) { conditions.push('s.propertyType = ?'); params.push(filters.propertyType); }
  if (filters.location) { conditions.push('s.location LIKE ?'); params.push(`%${filters.location}%`); }
  if (filters.purpose) { conditions.push('s.purpose = ?'); params.push(filters.purpose); }
  if (filters.priority) { conditions.push('s.priority = ?'); params.push(filters.priority); }
  if (filters.reviewStatus) { conditions.push('s.reviewStatus = ?'); params.push(filters.reviewStatus); }
  if (filters.minConfidence !== undefined) { conditions.push('CAST(s.confidence AS DECIMAL) >= ?'); params.push(filters.minConfidence); }
  if (filters.maxConfidence !== undefined) { conditions.push('CAST(s.confidence AS DECIMAL) <= ?'); params.push(filters.maxConfidence); }
  if (filters.minPrice !== undefined) { conditions.push('CAST(s.price AS DECIMAL) >= ?'); params.push(filters.minPrice); }
  if (filters.maxPrice !== undefined) { conditions.push('CAST(s.price AS DECIMAL) <= ?'); params.push(filters.maxPrice); }
  if (filters.bedrooms !== undefined) { conditions.push('s.bedrooms = ?'); params.push(filters.bedrooms); }
  if (filters.sourceGroup) { conditions.push('s.sourceGroup LIKE ?'); params.push(`%${filters.sourceGroup}%`); }
  if (filters.matched !== undefined) { conditions.push('s.matched = ?'); params.push(filters.matched ? 1 : 0); }
  
  const limit = parseInt(String(filters.limit || 100), 10);
  
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT s.*, m.messageText as originalMessage, m.groupName as msgGroup
     FROM supply s
     LEFT JOIN messages m ON s.messageId = m.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.createdAt DESC
     LIMIT ${limit}`,
    params
  ) as any[];
  return rows || [];
}

/**
 * Get demand with advanced filters for Buyer Requests page
 */
export async function getFilteredDemand(filters: {
  propertyType?: string;
  location?: string;
  purpose?: string;
  priority?: string;
  reviewStatus?: string;
  minConfidence?: number;
  maxConfidence?: number;
  minBudget?: number;
  maxBudget?: number;
  bedrooms?: number;
  sourceGroup?: string;
  matched?: boolean;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: string[] = ['1=1'];
  const params: any[] = [];
  
  if (filters.propertyType) { conditions.push('d.propertyType = ?'); params.push(filters.propertyType); }
  if (filters.location) { conditions.push('d.location LIKE ?'); params.push(`%${filters.location}%`); }
  if (filters.purpose) { conditions.push('d.purpose = ?'); params.push(filters.purpose); }
  if (filters.priority) { conditions.push('d.priority = ?'); params.push(filters.priority); }
  if (filters.reviewStatus) { conditions.push('d.reviewStatus = ?'); params.push(filters.reviewStatus); }
  if (filters.minConfidence !== undefined) { conditions.push('CAST(d.confidence AS DECIMAL) >= ?'); params.push(filters.minConfidence); }
  if (filters.maxConfidence !== undefined) { conditions.push('CAST(d.confidence AS DECIMAL) <= ?'); params.push(filters.maxConfidence); }
  if (filters.minBudget !== undefined) { conditions.push('CAST(d.priceMax AS DECIMAL) >= ?'); params.push(filters.minBudget); }
  if (filters.maxBudget !== undefined) { conditions.push('CAST(d.priceMin AS DECIMAL) <= ?'); params.push(filters.maxBudget); }
  if (filters.bedrooms !== undefined) { conditions.push('d.bedrooms = ?'); params.push(filters.bedrooms); }
  if (filters.sourceGroup) { conditions.push('d.sourceGroup LIKE ?'); params.push(`%${filters.sourceGroup}%`); }
  if (filters.matched !== undefined) { conditions.push('d.matched = ?'); params.push(filters.matched ? 1 : 0); }
  
  const limit = filters.limit || 100;
  params.push(limit);
  
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT d.*, COALESCE(d.buyerIntentScore, 50) as buyerIntentScore, COALESCE(d.buyerTier, 'broker_with_request') as buyerTier,
            m.messageText as originalMessage, m.groupName as msgGroup
     FROM demand d
     LEFT JOIN messages m ON d.messageId = m.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.createdAt DESC
     LIMIT ?`,
    params
  ) as any[];
  return rows || [];
}

// ─── Source Group Helpers ──────────────────────────────────────────────────────

/** Returns distinct non-null sourceGroup values from the supply table, ordered by count desc */
export async function getSupplySourceGroups(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT sourceGroup, COUNT(*) as cnt
     FROM supply
     WHERE sourceGroup IS NOT NULL AND sourceGroup != ''
     GROUP BY sourceGroup
     ORDER BY cnt DESC
     LIMIT 100`
  ) as any[];
  return (rows || []).map((r: any) => r.sourceGroup as string);
}

/** Returns distinct non-null sourceGroup values from the demand table, ordered by count desc */
export async function getDemandSourceGroups(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const [rows] = await (db as any).$client.promise().execute(
    `SELECT sourceGroup, COUNT(*) as cnt
     FROM demand
     WHERE sourceGroup IS NOT NULL AND sourceGroup != ''
     GROUP BY sourceGroup
     ORDER BY cnt DESC
     LIMIT 100`
  ) as any[];
  return (rows || []).map((r: any) => r.sourceGroup as string);
}

// ─── Daily Digest & Match Feedback Analytics ─────────────────────────────────

export interface DailyDigestData {
  date: string;
  messagesReceived: number;
  listingsCreated: number;
  requestsCreated: number;
  matchesFound: number;
  spamRejected: number;
  pendingReview: number;
  avgConfidence: number;
  topLocations: { location: string; count: number }[];
  topGroups: { group: string; count: number }[];
  feedbackStats: {
    totalRated: number;
    goodMatches: number;
    badMatches: number;
    avgRating: number;
  };
  matchAccuracyTrend: { date: string; accuracy: number; total: number }[];
}

export async function getDailyDigest(daysBack = 1): Promise<DailyDigestData> {
  const db = await getDb();
  const empty: DailyDigestData = {
    date: new Date().toISOString().split("T")[0],
    messagesReceived: 0, listingsCreated: 0, requestsCreated: 0,
    matchesFound: 0, spamRejected: 0, pendingReview: 0, avgConfidence: 0,
    topLocations: [], topGroups: [],
    feedbackStats: { totalRated: 0, goodMatches: 0, badMatches: 0, avgRating: 0 },
    matchAccuracyTrend: [],
  };
  if (!db) return empty;
  const client = (db as any).$client.promise();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    const [[msgR]] = await client.execute(`SELECT COUNT(*) as cnt FROM messages WHERE DATE(createdAt) >= ?`, [since]) as any;
    const [[supR]] = await client.execute(`SELECT COUNT(*) as cnt FROM supply WHERE DATE(createdAt) >= ?`, [since]) as any;
    const [[demR]] = await client.execute(`SELECT COUNT(*) as cnt FROM demand WHERE DATE(createdAt) >= ?`, [since]) as any;
    const [[matR]] = await client.execute(`SELECT COUNT(*) as cnt FROM matches WHERE DATE(createdAt) >= ?`, [since]) as any;
    const [[spamR]] = await client.execute(`SELECT COUNT(*) as cnt FROM messages WHERE classification = 'spam' AND DATE(createdAt) >= ?`, [since]) as any;
    const [[pendR]] = await client.execute(
      `SELECT (SELECT COUNT(*) FROM supply WHERE reviewStatus = 'pending_review') + (SELECT COUNT(*) FROM demand WHERE reviewStatus = 'pending_review') as cnt`
    ) as any;
    const [[confR]] = await client.execute(
      `SELECT AVG(CAST(confidence AS DECIMAL(5,4))) as avg FROM (
        SELECT confidence FROM supply WHERE DATE(createdAt) >= ? AND confidence IS NOT NULL
        UNION ALL
        SELECT confidence FROM demand WHERE DATE(createdAt) >= ? AND confidence IS NOT NULL
      ) t`, [since, since]
    ) as any;
    const [locRows] = await client.execute(
      `SELECT location, COUNT(*) as cnt FROM (
        SELECT location FROM supply WHERE DATE(createdAt) >= ? AND location IS NOT NULL AND location != ''
        UNION ALL
        SELECT location FROM demand WHERE DATE(createdAt) >= ? AND location IS NOT NULL AND location != ''
      ) t GROUP BY location ORDER BY cnt DESC LIMIT 5`, [since, since]
    ) as any;
    const [grpRows] = await client.execute(
      `SELECT sourceGroup as grp, COUNT(*) as cnt FROM (
        SELECT sourceGroup FROM supply WHERE DATE(createdAt) >= ? AND sourceGroup IS NOT NULL AND sourceGroup != ''
        UNION ALL
        SELECT sourceGroup FROM demand WHERE DATE(createdAt) >= ? AND sourceGroup IS NOT NULL AND sourceGroup != ''
      ) t GROUP BY grp ORDER BY cnt DESC LIMIT 5`, [since, since]
    ) as any;

    // Feedback stats — matchFeedback table may not exist yet, guard with try/catch
    let feedbackStats = { totalRated: 0, goodMatches: 0, badMatches: 0, avgRating: 0 };
    let matchAccuracyTrend: { date: string; accuracy: number; total: number }[] = [];
    try {
      const [[fbR]] = await client.execute(
        `SELECT COUNT(*) as total,
          SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as good,
          SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as bad,
          AVG(rating) as avg
         FROM matchFeedback WHERE DATE(createdAt) >= ?`, [since]
      ) as any;
      feedbackStats = {
        totalRated: Number(fbR?.total || 0),
        goodMatches: Number(fbR?.good || 0),
        badMatches: Number(fbR?.bad || 0),
        avgRating: Math.round((Number(fbR?.avg || 0)) * 10) / 10,
      };
      const [trendRows] = await client.execute(
        `SELECT DATE(createdAt) as day,
          AVG(rating) as avg_rating,
          COUNT(*) as total
         FROM matchFeedback
         WHERE DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY day ORDER BY day ASC`
      ) as any;
      matchAccuracyTrend = (trendRows || []).map((r: any) => ({
        date: r.day,
        accuracy: Math.round((Number(r.avg_rating || 0) / 5) * 100),
        total: Number(r.total),
      }));
    } catch {}

    return {
      date: new Date().toISOString().split("T")[0],
      messagesReceived: Number(msgR?.cnt || 0),
      listingsCreated: Number(supR?.cnt || 0),
      requestsCreated: Number(demR?.cnt || 0),
      matchesFound: Number(matR?.cnt || 0),
      spamRejected: Number(spamR?.cnt || 0),
      pendingReview: Number(pendR?.cnt || 0),
      avgConfidence: Math.round((Number(confR?.avg || 0)) * 100),
      topLocations: (locRows || []).map((r: any) => ({ location: r.location, count: Number(r.cnt) })),
      topGroups: (grpRows || []).map((r: any) => ({ group: r.grp, count: Number(r.cnt) })),
      feedbackStats,
      matchAccuracyTrend,
    };
  } catch (e) {
    console.error("[getDailyDigest] error:", e);
    return empty;
  }
}

export async function getMatchAccuracyTrend(days = 30): Promise<{ date: string; accuracy: number; total: number; goodPct: number }[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const [rows] = await (db as any).$client.promise().execute(
      `SELECT DATE(createdAt) as day,
        AVG(rating) as avg_rating,
        COUNT(*) as total,
        SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as good
       FROM matchFeedback
       WHERE DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY day ORDER BY day ASC`, [days]
    ) as any[];
    return (rows || []).map((r: any) => ({
      date: r.day,
      accuracy: Math.round((Number(r.avg_rating || 0) / 5) * 100),
      total: Number(r.total),
      goodPct: r.total > 0 ? Math.round((Number(r.good || 0) / Number(r.total)) * 100) : 0,
    }));
  } catch { return []; }
}

// ── System Settings ──────────────────────────────────────────────────────────

export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings).orderBy(systemSettings.key);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function upsertSetting(key: string, value: string, userId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(systemSettings).values({ key, value, updatedByUserId: userId ?? null } as any)
    .onDuplicateKeyUpdate({ set: { value, updatedByUserId: userId ?? null } });
}

// ── Auth Helpers (Local Auth — replaces Manus OAuth) ──────────────────────────

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

// getUserByOpenId already defined above (line ~96)

export async function getUserPasswordHash(openId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await (db as any).$client.promise().execute(
      `SELECT passwordHash FROM userPasswords WHERE openId = ? LIMIT 1`, [openId]
    ) as any[];
    return rows?.[0]?.[0]?.passwordHash ?? null;
  } catch {
    return null;
  }
}

export async function setUserPasswordHash(openId: string, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await (db as any).$client.promise().execute(
      `INSERT INTO userPasswords (openId, passwordHash) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE passwordHash = VALUES(passwordHash)`,
      [openId, passwordHash]
    );
  } catch (err) {
    console.error('[DB] setUserPasswordHash error:', err);
  }
}

export async function getUserCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(users);
  return Number(rows[0]?.count ?? 0);
}

export async function setUserRole(openId: string, role: 'user' | 'admin'): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.openId, openId));
}

export async function setUserPhone(openId: string, phone: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ whatsappNumber: phone }).where(eq(users.openId, openId));
}

export async function updateUserLastSignIn(openId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.openId, openId));
}
