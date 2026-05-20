/**
 * Investor Insights Engine
 * Analyzes supply/demand data to generate actionable investment insights
 * for the Egypt real estate market.
 */

import { getDb } from "./db";
import { supply, demand, matches } from "../drizzle/schema";
import { sql, count, avg, desc, asc, eq, isNotNull, and, ne } from "drizzle-orm";
import {
  calculateMarketTemperature,
  getTemperatureLabel,
  getTemperatureEmoji,
  type MarketTemperature,
} from "../shared/formatters";

// === Types ===

export interface MarketInsight {
  type: 'opportunity' | 'warning' | 'trend' | 'info';
  priority: 'high' | 'medium' | 'low';
  location: string;
  messageEn: string;
  messageAr: string;
  actionableEn: string;
  actionableAr: string;
  metrics: {
    demandCount: number;
    supplyCount: number;
    demandSupplyRatio: number;
    avgPrice: number | null;
    matchCount: number;
    temperature: MarketTemperature;
  };
}

export interface AreaAnalysis {
  location: string;
  supplyCount: number;
  demandCount: number;
  matchCount: number;
  avgSupplyPrice: number | null;
  avgDemandBudget: number | null;
  demandSupplyRatio: number;
  temperature: MarketTemperature;
  topPropertyTypes: string[];
  avgMatchScore: number | null;
}

export interface InvestorDashboardData {
  insights: MarketInsight[];
  areaAnalysis: AreaAnalysis[];
  summary: {
    totalAreas: number;
    hotMarkets: number;
    warmMarkets: number;
    coolMarkets: number;
    coldMarkets: number;
    topOpportunity: string | null;
    highestDemandArea: string | null;
    avgMarketScore: number;
  };
  propertyTypeBreakdown: Array<{
    type: string;
    supplyCount: number;
    demandCount: number;
    ratio: number;
  }>;
}

// === Core Analysis Functions ===

export async function getAreaAnalysis(): Promise<AreaAnalysis[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get supply by location
    const supplyByArea = await db
      .select({
        location: supply.location,
        count: count(),
        avgPrice: avg(supply.price),
      })
      .from(supply)
      .where(and(isNotNull(supply.location), ne(supply.location, '')))
      .groupBy(supply.location)
      .orderBy(desc(count()));

    // Get demand by location
    const demandByArea = await db
      .select({
        location: demand.location,
        count: count(),
        avgBudget: avg(demand.priceMax),
      })
      .from(demand)
      .where(and(isNotNull(demand.location), ne(demand.location, '')))
      .groupBy(demand.location)
      .orderBy(desc(count()));

    // Get matches by supply location
    const matchesByArea = await db
      .select({
        location: supply.location,
        count: count(),
        avgScore: avg(matches.matchScore),
      })
      .from(matches)
      .innerJoin(supply, sql`${matches.supplyId} = ${supply.id}`)
      .where(and(isNotNull(supply.location), ne(supply.location, '')))
      .groupBy(supply.location);

    // Build lookup maps
    const demandMap = new Map(demandByArea.map(d => [d.location, d]));
    const matchMap = new Map(matchesByArea.map(m => [m.location, m]));

    // Combine into area analysis
    const areas: AreaAnalysis[] = [];
    const allLocationsSet = new Set([
      ...supplyByArea.map(s => s.location!),
      ...demandByArea.map(d => d.location!),
    ]);
    const allLocations = Array.from(allLocationsSet);

    for (const location of allLocations) {
      if (!location) continue;
      
      const supplyData = supplyByArea.find(s => s.location === location);
      const demandData = demandMap.get(location);
      const matchData = matchMap.get(location);

      const sCount = supplyData ? Number(supplyData.count) : 0;
      const dCount = demandData ? Number(demandData.count) : 0;
      const ratio = sCount > 0 ? dCount / sCount : dCount > 0 ? 10 : 0;

      areas.push({
        location,
        supplyCount: sCount,
        demandCount: dCount,
        matchCount: matchData ? Number(matchData.count) : 0,
        avgSupplyPrice: supplyData?.avgPrice ? Number(supplyData.avgPrice) : null,
        avgDemandBudget: demandData?.avgBudget ? Number(demandData.avgBudget) : null,
        demandSupplyRatio: Math.round(ratio * 100) / 100,
        temperature: calculateMarketTemperature(dCount, sCount),
        topPropertyTypes: [],
        avgMatchScore: matchData?.avgScore ? Math.min(100, Number(matchData.avgScore)) : null,
      });
    }

    // Sort by demand/supply ratio descending (hottest first)
    areas.sort((a, b) => b.demandSupplyRatio - a.demandSupplyRatio);

    return areas;
  } catch (error) {
    console.error("[InvestorInsights] Area analysis error:", error);
    return [];
  }
}

export async function getPropertyTypeBreakdown(): Promise<Array<{
  type: string;
  supplyCount: number;
  demandCount: number;
  ratio: number;
}>> {
  const db = await getDb();
  if (!db) return [];

  try {
    const supplyTypes = await db
      .select({
        type: supply.propertyType,
        count: count(),
      })
      .from(supply)
      .where(sql`${supply.propertyType} IS NOT NULL`)
      .groupBy(supply.propertyType);

    const demandTypes = await db
      .select({
        type: demand.propertyType,
        count: count(),
      })
      .from(demand)
      .where(sql`${demand.propertyType} IS NOT NULL`)
      .groupBy(demand.propertyType);

    const demandTypeMap = new Map(demandTypes.map(d => [d.type, Number(d.count)]));
    const allTypesSet = new Set([
      ...supplyTypes.map(s => s.type!),
      ...demandTypes.map(d => d.type!),
    ]);
    const allTypesArr = Array.from(allTypesSet);

    const breakdown = allTypesArr.map(type => {
      const sCount = supplyTypes.find(s => s.type === type)?.count || 0;
      const dCount = demandTypeMap.get(type) || 0;
      return {
        type: type || 'unknown',
        supplyCount: Number(sCount),
        demandCount: Number(dCount),
        ratio: Number(sCount) > 0 ? Math.round((Number(dCount) / Number(sCount)) * 100) / 100 : 0,
      };
    });

    breakdown.sort((a, b) => b.ratio - a.ratio);
    return breakdown;
  } catch (error) {
    console.error("[InvestorInsights] Property type breakdown error:", error);
    return [];
  }
}

export async function generateInsights(areas: AreaAnalysis[]): Promise<MarketInsight[]> {
  const insights: MarketInsight[] = [];

  // 1. High Demand / Low Supply Opportunities
  const hotAreas = areas.filter(a => a.temperature === 'hot' && a.demandCount >= 3);
  for (const area of hotAreas.slice(0, 5)) {
    const emoji = getTemperatureEmoji(area.temperature);
    const pricePart = area.avgSupplyPrice
      ? ` Average price: ${(area.avgSupplyPrice / 1_000_000).toFixed(1)}M EGP.`
      : '';
    const pricPartAr = area.avgSupplyPrice
      ? ` متوسط السعر: ${(area.avgSupplyPrice / 1_000_000).toFixed(1)} مليون ج.م.`
      : '';

    insights.push({
      type: 'opportunity',
      priority: 'high',
      location: area.location,
      messageEn: `${emoji} Hot Market: ${area.location} has ${area.demandCount} buyers competing for ${area.supplyCount} listings.${pricePart} High investment potential!`,
      messageAr: `${emoji} سوق ساخن: ${area.location} به ${area.demandCount} مشتري يتنافسون على ${area.supplyCount} عقار.${pricPartAr} فرصة استثمارية عالية!`,
      actionableEn: `Consider acquiring properties in ${area.location} — demand exceeds supply by ${Math.round((area.demandSupplyRatio - 1) * 100)}%.`,
      actionableAr: `ننصح بالاستثمار في ${area.location} — الطلب يفوق العرض بنسبة ${Math.round((area.demandSupplyRatio - 1) * 100)}%.`,
      metrics: {
        demandCount: area.demandCount,
        supplyCount: area.supplyCount,
        demandSupplyRatio: area.demandSupplyRatio,
        avgPrice: area.avgSupplyPrice,
        matchCount: area.matchCount,
        temperature: area.temperature,
      },
    });
  }

  // 2. Warm Markets — Growing Demand
  const warmAreas = areas.filter(a => a.temperature === 'warm' && a.demandCount >= 2);
  for (const area of warmAreas.slice(0, 3)) {
    insights.push({
      type: 'trend',
      priority: 'medium',
      location: area.location,
      messageEn: `☀️ Growing Demand: ${area.location} shows ${area.demandCount} active buyers with ${area.supplyCount} available listings. Market warming up.`,
      messageAr: `☀️ طلب متزايد: ${area.location} يظهر ${area.demandCount} مشتري نشط مع ${area.supplyCount} عقار متاح. السوق يسخن.`,
      actionableEn: `Monitor ${area.location} closely — early entry could yield strong returns as demand grows.`,
      actionableAr: `راقب ${area.location} عن كثب — الدخول المبكر قد يحقق عوائد قوية مع نمو الطلب.`,
      metrics: {
        demandCount: area.demandCount,
        supplyCount: area.supplyCount,
        demandSupplyRatio: area.demandSupplyRatio,
        avgPrice: area.avgSupplyPrice,
        matchCount: area.matchCount,
        temperature: area.temperature,
      },
    });
  }

  // 3. Oversupply Warnings
  const coldAreas = areas.filter(a => a.temperature === 'cold' && a.supplyCount >= 5);
  for (const area of coldAreas.slice(0, 3)) {
    insights.push({
      type: 'warning',
      priority: 'medium',
      location: area.location,
      messageEn: `❄️ Oversupply Alert: ${area.location} has ${area.supplyCount} listings but only ${area.demandCount} buyers. Consider waiting or negotiating.`,
      messageAr: `❄️ تنبيه فائض عرض: ${area.location} به ${area.supplyCount} عقار لكن ${area.demandCount} مشتري فقط. ننصح بالانتظار أو التفاوض.`,
      actionableEn: `Avoid new acquisitions in ${area.location} until demand recovers. Focus on competitive pricing.`,
      actionableAr: `تجنب الاستثمار الجديد في ${area.location} حتى يتعافى الطلب. ركز على الأسعار التنافسية.`,
      metrics: {
        demandCount: area.demandCount,
        supplyCount: area.supplyCount,
        demandSupplyRatio: area.demandSupplyRatio,
        avgPrice: area.avgSupplyPrice,
        matchCount: area.matchCount,
        temperature: area.temperature,
      },
    });
  }

  // 4. High Match Rate Areas
  const highMatchAreas = areas
    .filter(a => a.avgMatchScore && a.avgMatchScore >= 80 && a.matchCount >= 5)
    .sort((a, b) => (b.avgMatchScore || 0) - (a.avgMatchScore || 0));
  
  for (const area of highMatchAreas.slice(0, 3)) {
    insights.push({
      type: 'info',
      priority: 'low',
      location: area.location,
      messageEn: `🎯 High Match Rate: ${area.location} averages ${area.avgMatchScore?.toFixed(0)}% match score across ${area.matchCount} matches. Strong buyer-seller alignment.`,
      messageAr: `🎯 نسبة تطابق عالية: ${area.location} بمتوسط ${area.avgMatchScore?.toFixed(0)}% تطابق عبر ${area.matchCount} تطابق. توافق قوي بين البائع والمشتري.`,
      actionableEn: `${area.location} shows efficient market dynamics — ideal for quick transactions.`,
      actionableAr: `${area.location} يظهر ديناميكيات سوق فعالة — مثالي للمعاملات السريعة.`,
      metrics: {
        demandCount: area.demandCount,
        supplyCount: area.supplyCount,
        demandSupplyRatio: area.demandSupplyRatio,
        avgPrice: area.avgSupplyPrice,
        matchCount: area.matchCount,
        temperature: area.temperature,
      },
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}

export async function getInvestorDashboardData(): Promise<InvestorDashboardData> {
  const areas = await getAreaAnalysis();
  const insights = await generateInsights(areas);
  const propertyTypeBreakdown = await getPropertyTypeBreakdown();

  const hotMarkets = areas.filter(a => a.temperature === 'hot').length;
  const warmMarkets = areas.filter(a => a.temperature === 'warm').length;
  const coolMarkets = areas.filter(a => a.temperature === 'cool').length;
  const coldMarkets = areas.filter(a => a.temperature === 'cold').length;

  const topOpportunity = insights.find(i => i.type === 'opportunity')?.location || null;
  const highestDemandArea = [...areas].sort((a, b) => b.demandCount - a.demandCount)[0]?.location || null;

  const matchScores = areas.filter(a => a.avgMatchScore != null).map(a => a.avgMatchScore!);
  const avgMarketScore = matchScores.length > 0
    ? Math.round(matchScores.reduce((a, b) => a + b, 0) / matchScores.length)
    : 0;

  return {
    insights,
    areaAnalysis: areas.slice(0, 20), // Top 20 areas
    summary: {
      totalAreas: areas.length,
      hotMarkets,
      warmMarkets,
      coolMarkets,
      coldMarkets,
      topOpportunity,
      highestDemandArea,
      avgMarketScore,
    },
    propertyTypeBreakdown,
  };
}
