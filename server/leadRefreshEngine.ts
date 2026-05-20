/**
 * Automated Lead Refresh Engine
 * Refreshes leads every 48-72 hours, applies filters, calculates confidence scores
 */

import { getDb } from './db';
import { detectBroker, aggregateBrokerDetection } from './brokerDetection';

export interface LeadRefreshConfig {
  locations: string[];
  propertyTypes?: string[];
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  excludeBrokers?: boolean;
  minConfidenceScore?: number;
}

export interface ProcessedLead {
  id: number;
  type: 'supply' | 'demand';
  title: string;
  location: string;
  propertyType: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  contact: string;
  contactName: string;
  message: string;
  source: 'whatsapp' | 'facebook';
  createdAt: Date;
  freshness: 'today' | 'yesterday' | '2-3 days' | 'older';
  confidenceScore: number;
  brokerScore: number;
  isBroker: boolean;
  messageCount: number;
}

export async function refreshLeads(config: LeadRefreshConfig): Promise<ProcessedLead[]> {
  const db = await getDb();
  if (!db) return [];

  const leads: ProcessedLead[] = [];
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  try {
    // Fetch recent supply records (properties for sale/rent)
    const [supplyRecords] = await (db as any).$client.promise().execute(
      `SELECT * FROM supply 
       WHERE createdAt >= ? 
       AND (${config.locations.map(() => 'location LIKE ?').join(' OR ')})
       ORDER BY createdAt DESC`,
      [threeDaysAgo, ...config.locations.map(l => `%${l}%`)]
    );

    // Fetch recent demand records (buyers/renters looking)
    const [demandRecords] = await (db as any).$client.promise().execute(
      `SELECT * FROM demand 
       WHERE createdAt >= ? 
       AND (${config.locations.map(() => 'location LIKE ?').join(' OR ')})
       ORDER BY createdAt DESC`,
      [threeDaysAgo, ...config.locations.map(l => `%${l}%`)]
    );

    // Process supply records
    for (const record of (supplyRecords as any[])) {
      if (config.propertyTypes && !config.propertyTypes.includes(record.propertyType)) continue;
      if (config.minPrice && record.price < config.minPrice) continue;
      if (config.maxPrice && record.price > config.maxPrice) continue;

      // Detect if this is a broker
      const brokerDetection = detectBroker({
        message: record.message || '',
        contactName: record.contactName,
        contact: record.contact,
      });

      if (config.excludeBrokers && brokerDetection.isBroker) continue;

      const freshness = calculateFreshness(record.createdAt);
      const confidenceScore = calculateConfidenceScore(record, brokerDetection);

      if (config.minConfidenceScore && confidenceScore < config.minConfidenceScore) continue;

      leads.push({
        id: record.id,
        type: 'supply',
        title: record.title || `${record.bedrooms}BR ${record.propertyType}`,
        location: record.location,
        propertyType: record.propertyType,
        price: record.price,
        bedrooms: record.bedrooms,
        bathrooms: record.bathrooms,
        contact: record.contact,
        contactName: record.contactName,
        message: record.message,
        source: 'whatsapp',
        createdAt: new Date(record.createdAt),
        freshness,
        confidenceScore,
        brokerScore: brokerDetection.brokerScore,
        isBroker: brokerDetection.isBroker,
        messageCount: 1,
      });
    }

    // Process demand records
    for (const record of (demandRecords as any[])) {
      if (config.propertyTypes && !config.propertyTypes.includes(record.propertyType)) continue;
      if (config.minBedrooms && record.bedrooms < config.minBedrooms) continue;
      if (config.maxBedrooms && record.bedrooms > config.maxBedrooms) continue;

      // Detect if this is a broker
      const brokerDetection = detectBroker({
        message: record.message || '',
        contactName: record.contactName,
        contact: record.contact,
      });

      if (config.excludeBrokers && brokerDetection.isBroker) continue;

      const freshness = calculateFreshness(record.createdAt);
      const confidenceScore = calculateConfidenceScore(record, brokerDetection);

      if (config.minConfidenceScore && confidenceScore < config.minConfidenceScore) continue;

      leads.push({
        id: record.id,
        type: 'demand',
        title: record.title || `Looking for ${record.bedrooms}BR ${record.propertyType}`,
        location: record.location,
        propertyType: record.propertyType,
        bedrooms: record.bedrooms,
        bathrooms: record.bathrooms,
        contact: record.contact,
        contactName: record.contactName,
        message: record.message,
        source: 'whatsapp',
        createdAt: new Date(record.createdAt),
        freshness,
        confidenceScore,
        brokerScore: brokerDetection.brokerScore,
        isBroker: brokerDetection.isBroker,
        messageCount: 1,
      });
    }

    // Sort by freshness and confidence
    leads.sort((a, b) => {
      const freshnessOrder = { today: 0, yesterday: 1, '2-3 days': 2, older: 3 };
      const freshnessCompare = freshnessOrder[a.freshness] - freshnessOrder[b.freshness];
      if (freshnessCompare !== 0) return freshnessCompare;
      return b.confidenceScore - a.confidenceScore;
    });

    return leads;
  } catch (error) {
    console.error('[leadRefreshEngine] Error:', error);
    return [];
  }
}

function calculateFreshness(createdAt: Date | string): 'today' | 'yesterday' | '2-3 days' | 'older' {
  const date = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) return 'today';
  if (diffHours < 48) return 'yesterday';
  if (diffHours < 72) return '2-3 days';
  return 'older';
}

interface BrokerDetectionResult {
  isBroker: boolean;
  brokerScore: number;
  confidence: number;
}

function calculateConfidenceScore(
  record: any,
  brokerDetection: BrokerDetectionResult
): number {
  let score = 50; // Base score

  // Freshness bonus
  const createdAt = new Date(record.createdAt);
  const now = new Date();
  const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) score += 25;
  else if (diffHours < 48) score += 15;
  else if (diffHours < 72) score += 5;

  // Completeness bonus
  if (record.title) score += 5;
  if (record.price) score += 5;
  if (record.bedrooms) score += 3;
  if (record.bathrooms) score += 2;
  if (record.size) score += 3;

  // Broker penalty
  if (brokerDetection.isBroker) {
    score -= brokerDetection.brokerScore / 2;
  } else {
    score += brokerDetection.confidence / 10;
  }

  // Message quality
  const messageLength = (record.message || '').length;
  if (messageLength > 50) score += 5;
  if (messageLength > 100) score += 3;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Get leads that need to be refreshed (older than 48-72 hours)
 */
export async function getLeadsToRefresh(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const refreshThreshold = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // Get supply records that haven't been refreshed
    const [supplyToRefresh] = await (db as any).$client.promise().execute(
      `SELECT * FROM supply 
       WHERE lastRefreshed < ? OR lastRefreshed IS NULL
       ORDER BY lastRefreshed ASC
       LIMIT 100`,
      [refreshThreshold]
    );

    // Get demand records that haven't been refreshed
    const [demandToRefresh] = await (db as any).$client.promise().execute(
      `SELECT * FROM demand 
       WHERE lastRefreshed < ? OR lastRefreshed IS NULL
       ORDER BY lastRefreshed ASC
       LIMIT 100`,
      [refreshThreshold]
    );

    return [...(supplyToRefresh as any[]), ...(demandToRefresh as any[])];
  } catch (error) {
    console.error('[getLeadsToRefresh] Error:', error);
    return [];
  }
}

/**
 * Mark leads as refreshed
 */
export async function markLeadsAsRefreshed(leadIds: number[], type: 'supply' | 'demand'): Promise<void> {
  const db = await getDb();
  if (!db || leadIds.length === 0) return;

  try {
    const table = type === 'supply' ? 'supply' : 'demand';
    const placeholders = leadIds.map(() => '?').join(',');

    await (db as any).$client.promise().execute(
      `UPDATE ${table} SET lastRefreshed = NOW() WHERE id IN (${placeholders})`,
      leadIds
    );
  } catch (error) {
    console.error('[markLeadsAsRefreshed] Error:', error);
  }
}
