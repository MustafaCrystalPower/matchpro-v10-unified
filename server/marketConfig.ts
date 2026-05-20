/**
 * MatchPro Unified — Multi-Market Configuration
 * Ported from V3 Source. Supports: Real Estate, Jobs, Logistics, Wholesale, Medical Equipment.
 * Markets are stored in the marketConfig DB table (seeded on first run).
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

export interface MarketConfig {
  marketKey: string;
  name: string;
  icon: string;
  supplyLabel: string;
  demandLabel: string;
  currency: string;
  fields: string[];
  isActive: boolean;
}

// In-memory cache (refreshed from DB periodically)
let marketCache: MarketConfig[] | null = null;
let currentMarket: string = "real_estate";

export async function loadMarketConfig(): Promise<MarketConfig[]> {
  const db = await getDb();
  if (!db) return getDefaultMarkets();

  try {
    const rows = await (db as any).$client.promise().execute(
      `SELECT marketKey, name, icon, supplyLabel, demandLabel, currency, fields, isActive FROM marketConfig ORDER BY marketKey`
    ) as any[];
    
    if (rows?.[0]?.length > 0) {
      marketCache = rows[0].map((r: any) => ({
        marketKey: r.marketKey,
        name: r.name,
        icon: r.icon,
        supplyLabel: r.supplyLabel,
        demandLabel: r.demandLabel,
        currency: r.currency,
        fields: JSON.parse(r.fields || '[]'),
        isActive: Boolean(r.isActive),
      }));
      // Set current market to the active one
      const active = marketCache.find(m => m.isActive);
      if (active) currentMarket = active.marketKey;
      return marketCache;
    }
  } catch (err) {
    console.warn('[Market Config] Failed to load from DB, using defaults:', err);
  }

  return getDefaultMarkets();
}

export function getDefaultMarkets(): MarketConfig[] {
  return [
    { marketKey: 'real_estate', name: 'Real Estate', icon: '🏠', supplyLabel: 'Property Listing', demandLabel: 'Buyer/Renter Request', currency: 'EGP', fields: ['location','price','propertyType','bedrooms','purpose'], isActive: true },
    { marketKey: 'jobs', name: 'Job Market', icon: '💼', supplyLabel: 'Job Opening', demandLabel: 'Job Seeker', currency: 'USD', fields: ['role','salary','location','experience','type'], isActive: false },
    { marketKey: 'logistics', name: 'Logistics', icon: '🚛', supplyLabel: 'Available Truck/Route', demandLabel: 'Shipping Request', currency: 'USD', fields: ['route','weight','date','type','price'], isActive: false },
    { marketKey: 'wholesale', name: 'Wholesale Trade', icon: '📦', supplyLabel: 'Product Available', demandLabel: 'Buyer Need', currency: 'USD', fields: ['product','quantity','price','location','quality'], isActive: false },
    { marketKey: 'medical_equipment', name: 'Medical Equipment', icon: '🏥', supplyLabel: 'Equipment Available', demandLabel: 'Hospital Need', currency: 'USD', fields: ['equipment','condition','quantity','price','location'], isActive: false },
  ];
}

export function getCurrentMarket(): string {
  return currentMarket;
}

export function getAllMarkets(): MarketConfig[] {
  return marketCache || getDefaultMarkets();
}

export async function setActiveMarket(marketKey: string): Promise<boolean> {
  const markets = marketCache || getDefaultMarkets();
  if (!markets.find(m => m.marketKey === marketKey)) return false;

  const db = await getDb();
  if (!db) return false;

  try {
    await (db as any).$client.promise().execute(
      `UPDATE marketConfig SET isActive = 0`
    );
    await (db as any).$client.promise().execute(
      `UPDATE marketConfig SET isActive = 1 WHERE marketKey = ?`, [marketKey]
    );
    currentMarket = marketKey;
    // Refresh cache
    await loadMarketConfig();
    return true;
  } catch (err) {
    console.error('[Market Config] Failed to switch market:', err);
    return false;
  }
}
