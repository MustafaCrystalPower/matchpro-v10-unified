import { getDb } from "./db";

/**
 * Create or update a user asset (raw SQL to match actual DB schema)
 */
export async function createUserAsset(data: {
  userId: number;
  propertyType: string;
  location: string;
  area?: string;
  size?: number;
  bedrooms?: number;
  bathrooms?: number;
  price?: number;
  priceType: "sale" | "rent";
  rentalPeriod?: "monthly" | "yearly";
  description?: string;
  contactPhone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await (db as any).$client.promise().execute(
    `INSERT INTO userAssets (userId, propertyType, location, area, size, bedrooms, bathrooms, price, priceType, rentalPeriod, description, contactPhone, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
    [
      data.userId,
      data.propertyType,
      data.location,
      data.area || null,
      data.size || null,
      data.bedrooms || null,
      data.bathrooms || null,
      data.price || null,
      data.priceType,
      data.rentalPeriod || null,
      data.description || null,
      data.contactPhone || null,
    ]
  );
  return (result as any)[0];
}

/**
 * Get all assets for a user (raw SQL)
 */
export async function getUserAssets(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await (db as any).$client.promise().execute(
    `SELECT ua.*,
      (SELECT COUNT(*) FROM assetMatches am WHERE am.assetId = ua.id) AS matchCount,
      (SELECT COUNT(*) FROM assetMatches am WHERE am.assetId = ua.id AND am.status = 'new') AS newMatchCount
     FROM userAssets ua WHERE ua.userId = ? ORDER BY ua.createdAt DESC`,
    [userId]
  );
  return (result as any[])[0] || [];
}

/**
 * Get single asset (raw SQL)
 */
export async function getAsset(assetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await (db as any).$client.promise().execute(
    `SELECT * FROM userAssets WHERE id = ? LIMIT 1`,
    [assetId]
  );
  return (result as any[])[0] || [];
}

/**
 * Match demand messages to user assets
 */
export async function matchDemandToAssets(assetId: number) {
  const assets = await getAsset(assetId);
  if (!assets || assets.length === 0) return [];

  const assetData = assets[0];
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await (db as any).$client.promise().execute(
    `SELECT * FROM demand WHERE purpose = ? LIMIT 100`,
    [assetData.priceType]
  );
  const matches = (result as any[])[0] || [];

  const scoredMatches = matches.map((m: any) => {
    let score = 0;
    if (m.location && assetData.location && m.location.toLowerCase().includes(assetData.location.toLowerCase())) {
      score += 40;
    }
    if (m.priceMax && m.priceMin && assetData.price) {
      const priceMax = parseFloat(String(m.priceMax));
      const priceMin = parseFloat(String(m.priceMin));
      const assetPrice = parseFloat(String(assetData.price));
      if (assetPrice >= priceMin && assetPrice <= priceMax) score += 35;
    }
    if (m.propertyType && assetData.propertyType && m.propertyType.toLowerCase() === assetData.propertyType.toLowerCase()) {
      score += 25;
    }
    return {
      ...m,
      matchScore: score,
      matchReason: `Location: ${score >= 40 ? "✓" : "✗"}, Price: ${score >= 35 ? "✓" : "✗"}, Type: ${score >= 25 ? "✓" : "✗"}`,
    };
  });

  return scoredMatches.filter((m: any) => m.matchScore >= 60);
}

/**
 * Create asset match record (raw SQL)
 */
export async function createAssetMatch(data: {
  assetId: number;
  demandId: number;
  matchScore: number;
  matchReasoning?: string;
  demandContact?: string;
  demandContactName?: string;
  demandSourceGroup?: string;
  demandRawMessage?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await (db as any).$client.promise().execute(
    `INSERT INTO assetMatches (assetId, demandId, matchScore, matchReasoning, demandContact, demandContactName, demandSourceGroup, demandRawMessage, status, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW())`,
    [
      data.assetId,
      data.demandId,
      data.matchScore,
      data.matchReasoning || null,
      data.demandContact || null,
      data.demandContactName || null,
      data.demandSourceGroup || null,
      data.demandRawMessage || null,
    ]
  );
  return (result as any)[0];
}

/**
 * Get asset matches (raw SQL)
 */
export async function getAssetMatches(assetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await (db as any).$client.promise().execute(
    `SELECT am.*, d.contact, d.contactName, d.location, d.propertyType, d.priceMin, d.priceMax, d.rawMessageText, d.sourceGroup
     FROM assetMatches am JOIN demand d ON am.demandId = d.id
     WHERE am.assetId = ? ORDER BY am.matchScore DESC, am.createdAt DESC`,
    [assetId]
  );
  return (result as any[])[0] || [];
}

/**
 * Update asset match status (raw SQL)
 */
export async function updateAssetMatchStatus(
  matchId: number,
  status: "new" | "viewed" | "contacted" | "closed"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await (db as any).$client.promise().execute(
    `UPDATE assetMatches SET status = ? WHERE id = ?`,
    [status, matchId]
  );
}

/**
 * Mark asset match as alert sent (raw SQL)
 */
export async function markAssetMatchSent(matchId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await (db as any).$client.promise().execute(
    `UPDATE assetMatches SET alertSent = 1, alertSentAt = NOW() WHERE id = ?`,
    [matchId]
  );
}
