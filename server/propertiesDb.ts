import { getDb } from './db';
import { eq, desc } from 'drizzle-orm';

export interface PropertyRecord {
  id: number;
  name: string;
  phone: string;
  type: string;
  location: string;
  priceMin: number;
  priceMax: number;
  bedrooms?: number;
  bathrooms?: number;
  status: 'available' | 'matched' | 'pending';
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyerRequest {
  id: number;
  name: string;
  phone: string;
  type: string;
  location: string;
  budgetMin: number;
  budgetMax: number;
  bedrooms?: number;
  bathrooms?: number;
  status: 'available' | 'matched' | 'pending';
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all active properties (supply)
 */
export async function getActiveProperties(limit: number = 2000): Promise<PropertyRecord[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const rows = await (db as any).$client.promise().execute(
      `SELECT 
        s.id, 
        s.contactName as name,
        s.contact as phone,
        s.propertyType as type,
        s.location,
        s.cashPrice as priceMin,
        s.price as priceMax,
        s.bedrooms,
        s.bathrooms,
        s.reviewStatus as status,
        CASE WHEN s.priority = 'high' THEN 100 WHEN s.priority = 'medium' THEN 50 ELSE 10 END as priority,
        s.rawMessageText as originalMessage,
        s.createdAt,
        s.createdAt as updatedAt
      FROM supply s
      WHERE s.reviewStatus IN ('auto_approved', 'approved', 'pending_review')
      ORDER BY s.priority DESC, s.createdAt DESC
      LIMIT ${Math.min(limit, 2000)}`
    );

    return (rows as any[])[0] || [];
  } catch (error: any) {
    console.error('[getActiveProperties] Error:', error.message);
    return [];
  }
}

/**
 * Get all active buyer requests (demand)
 */
export async function getActiveBuyerRequests(limit: number = 2000): Promise<BuyerRequest[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const rows = await (db as any).$client.promise().execute(
      `SELECT 
        d.id,
        d.contactName as name,
        d.contact as phone,
        d.propertyType as type,
        d.location,
        d.priceMin as budgetMin,
        d.priceMax as budgetMax,
        d.bedrooms,
        d.bathrooms,
        d.reviewStatus as status,
        CASE WHEN d.priority = 'high' THEN 100 WHEN d.priority = 'medium' THEN 50 ELSE 10 END as priority,
        d.rawMessageText as originalMessage,
        d.createdAt,
        d.createdAt as updatedAt
      FROM demand d
      WHERE d.reviewStatus IN ('auto_approved', 'approved', 'pending_review')
      ORDER BY d.priority DESC, d.createdAt DESC
      LIMIT ${Math.min(limit, 2000)}`
    );

    return (rows as any[])[0] || [];
  } catch (error: any) {
    console.error('[getActiveBuyerRequests] Error:', error.message);
    return [];
  }
}

/**
 * Get properties statistics
 */
export async function getPropertiesStats() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const stats = await (db as any).$client.promise().execute(
      `SELECT 
        COUNT(*) as totalProperties,
        SUM(CASE WHEN reviewStatus = 'auto_approved' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN matched = 1 THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN reviewStatus = 'pending_review' THEN 1 ELSE 0 END) as pending
      FROM supply`
    );

    return (stats as any[])[0]?.[0] || {
      totalProperties: 0,
      available: 0,
      matched: 0,
      pending: 0,
    };
  } catch (error: any) {
    console.error('[getPropertiesStats] Error:', error.message);
    return { totalProperties: 0, available: 0, matched: 0, pending: 0 };
  }
}

/**
 * Get buyer requests statistics
 */
export async function getBuyerRequestsStats() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const stats = await (db as any).$client.promise().execute(
      `SELECT 
        COUNT(*) as totalRequests,
        SUM(CASE WHEN reviewStatus = 'auto_approved' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN matched = 1 THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN reviewStatus = 'pending_review' THEN 1 ELSE 0 END) as pending
      FROM demand`
    );

    return (stats as any[])[0]?.[0] || {
      totalRequests: 0,
      available: 0,
      matched: 0,
      pending: 0,
    };
  } catch (error: any) {
    console.error('[getBuyerRequestsStats] Error:', error.message);
    return { totalRequests: 0, available: 0, matched: 0, pending: 0 };
  }
}

/**
 * Get properties by location
 */
export async function getPropertiesByLocation(location: string, limit: number = 500): Promise<PropertyRecord[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const rows = await (db as any).$client.promise().execute(
      `SELECT 
        s.id, 
        s.contactName as name,
        s.contact as phone,
        s.propertyType as type,
        s.location,
        s.cashPrice as priceMin,
        s.price as priceMax,
        s.bedrooms,
        s.bathrooms,
        s.reviewStatus as status,
        CASE WHEN s.priority = 'high' THEN 100 WHEN s.priority = 'medium' THEN 50 ELSE 10 END as priority,
        s.createdAt,
        s.createdAt as updatedAt
      FROM supply s
      WHERE s.location LIKE ? AND s.reviewStatus IN ('auto_approved', 'approved', 'pending_review')
      ORDER BY s.priority DESC, s.createdAt DESC
      LIMIT ?`,
      [`%${location}%`, limit]
    );

    return (rows as any[])[0] || [];
  } catch (error: any) {
    console.error('[getPropertiesByLocation] Error:', error.message);
    return [];
  }
}

/**
 * Get buyer requests by location
 */
export async function getBuyerRequestsByLocation(location: string, limit: number = 500): Promise<BuyerRequest[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const rows = await (db as any).$client.promise().execute(
      `SELECT 
        d.id,
        d.contactName as name,
        d.contact as phone,
        d.propertyType as type,
        d.location,
        d.priceMin as budgetMin,
        d.priceMax as budgetMax,
        d.bedrooms,
        d.bathrooms,
        d.reviewStatus as status,
        CASE WHEN d.priority = 'high' THEN 100 WHEN d.priority = 'medium' THEN 50 ELSE 10 END as priority,
        d.createdAt,
        d.createdAt as updatedAt
      FROM demand d
      WHERE d.location LIKE ? AND d.reviewStatus IN ('auto_approved', 'approved', 'pending_review')
      ORDER BY d.priority DESC, d.createdAt DESC
      LIMIT ?`,
      [`%${location}%`, limit]
    );

    return (rows as any[])[0] || [];
  } catch (error: any) {
    console.error('[getBuyerRequestsByLocation] Error:', error.message);
    return [];
  }
}
