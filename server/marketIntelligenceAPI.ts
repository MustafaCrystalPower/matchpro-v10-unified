/**
 * Market Intelligence API - Map Data Aggregation
 * Provides aggregated supply/demand data by location for map visualization
 */

import { getDb } from './db';
import { supply, demand, geoMarketData } from '../drizzle/schema';
import { sql, eq } from 'drizzle-orm';

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface LocationStats {
  location: string;
  lat: number;
  lng: number;
  supplyCount: number;
  demandCount: number;
  avgPrice?: any;
  avgBudget?: any;
  marketTemperature?: any;
  investmentScore?: any;
}

/**
 * Get aggregated map data for Market Intelligence visualization
 * Uses geoMarketData as coordinate source, aggregates supply/demand by location
 */
export async function getMapData() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    // Get all geo market data with coordinates
    const geoData = await db
      .select({
        location: geoMarketData.location,
        lat: geoMarketData.lat,
        lng: geoMarketData.lng,
        temperature: geoMarketData.marketTemperature,
        investmentScore: geoMarketData.investmentScore,
      })
      .from(geoMarketData)
      .execute();

    // Get supply count by location
    const supplyByLocation = await db
      .select({
        location: supply.location,
        count: sql<number>`COUNT(*)`,
        avgPrice: sql<number>`AVG(CAST(${supply.price} AS DECIMAL))`,
      })
      .from(supply)
      .where(sql`${supply.location} IS NOT NULL`)
      .groupBy(supply.location)
      .execute();

    // Get demand count by location
    const demandByLocation = await db
      .select({
        location: demand.location,
        count: sql<number>`COUNT(*)`,
        avgBudget: sql<number>`AVG(CAST(${demand.priceMax} AS DECIMAL))`,
      })
      .from(demand)
      .where(sql`${demand.location} IS NOT NULL`)
      .groupBy(demand.location)
      .execute();

    // Create maps for quick lookup
    const supplyMap = new Map(supplyByLocation.map((s) => [s.location, { count: s.count, avgPrice: s.avgPrice }]));
    const demandMap = new Map(demandByLocation.map((d) => [d.location, { count: d.count, avgBudget: d.avgBudget }]));

    // Merge all data
    const locationStats: LocationStats[] = geoData.map((geo) => {
      const supplyData = supplyMap.get(geo.location) || { count: 0, avgPrice: 0 };
      const demandData = demandMap.get(geo.location) || { count: 0, avgBudget: 0 };

      return {
        location: geo.location,
        lat: geo.lat ? parseFloat(geo.lat.toString()) : 30.0444,
        lng: geo.lng ? parseFloat(geo.lng.toString()) : 31.2357,
        supplyCount: supplyData.count,
        demandCount: demandData.count,
        avgPrice: supplyData.avgPrice,
        avgBudget: demandData.avgBudget,
        marketTemperature: geo.temperature,
        investmentScore: geo.investmentScore,
      };
    });

    // Create heatmap data with log scale weighting
    const heatmapData: HeatmapPoint[] = locationStats.map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      weight: Math.log(Math.max(loc.supplyCount + loc.demandCount, 1)) * 2,
    }));

    // Create supply pins
    const supplyPins = locationStats
      .filter((loc) => loc.supplyCount > 0)
      .map((loc) => ({
        lat: loc.lat,
        lng: loc.lng,
        title: `${loc.supplyCount} properties`,
        type: 'supply' as const,
        count: loc.supplyCount,
        location: loc.location,
        avgPrice: loc.avgPrice,
      }));

    // Create demand pins
    const demandPins = locationStats
      .filter((loc) => loc.demandCount > 0)
      .map((loc) => ({
        lat: loc.lat,
        lng: loc.lng,
        title: `${loc.demandCount} seekers`,
        type: 'demand' as const,
        count: loc.demandCount,
        location: loc.location,
        avgBudget: loc.avgBudget,
      }));

    const totalSupply = locationStats.reduce((sum, loc) => sum + loc.supplyCount, 0);
    const totalDemand = locationStats.reduce((sum, loc) => sum + loc.demandCount, 0);

    return {
      heatmapData,
      supplyPins,
      demandPins,
      locationStats,
      summary: {
        totalSupply,
        totalDemand,
        totalLocations: locationStats.length,
        supplyDemandRatio: totalSupply / Math.max(1, totalDemand),
      },
    };
  } catch (error) {
    console.error('[Market Intelligence] Error fetching map data:', error);
    throw error;
  }
}

/**
 * Get location-specific statistics for drill-down analysis
 */
export async function getLocationStats(location: string) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const supplyCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(supply)
      .where(eq(supply.location, location))
      .execute();

    const demandCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(demand)
      .where(eq(demand.location, location))
      .execute();

    const avgSupplyPrice = await db
      .select({ avg: sql<number>`AVG(CAST(${supply.price} AS DECIMAL))` })
      .from(supply)
      .where(eq(supply.location, location))
      .execute();

    const avgDemandBudget = await db
      .select({ avg: sql<number>`AVG(CAST(${demand.priceMax} AS DECIMAL))` })
      .from(demand)
      .where(eq(demand.location, location))
      .execute();

    return {
      location,
      supplyCount: supplyCount[0]?.count || 0,
      demandCount: demandCount[0]?.count || 0,
      avgSupplyPrice: avgSupplyPrice[0]?.avg || 0,
      avgDemandBudget: avgDemandBudget[0]?.avg || 0,
    };
  } catch (error) {
    console.error('[Market Intelligence] Error fetching location stats:', error);
    throw error;
  }
}

/**
 * Get hot zones (high opportunity areas)
 */
export async function getHotZones(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const hotZones = await db
      .select({
        location: geoMarketData.location,
        supply: geoMarketData.totalSupply,
        demand: geoMarketData.totalDemand,
        temperature: geoMarketData.marketTemperature,
        investmentScore: geoMarketData.investmentScore,
        lat: geoMarketData.lat,
        lng: geoMarketData.lng,
      })
      .from(geoMarketData)
      .orderBy(sql`${geoMarketData.investmentScore} DESC`)
      .limit(limit)
      .execute();

    return hotZones;
  } catch (error) {
    console.error('[Market Intelligence] Error fetching hot zones:', error);
    throw error;
  }
}
